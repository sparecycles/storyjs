/**
 | Module: Story.Core
 | Requires: Layer
 | Author: Adam Freidin
 |
-- Introduction
 |
 | >{Story} is a framework for scripting behaviour over time.
 | 
 | Most programming languages lack the ability to keep track of
 | actions over time, story provides patterns for dealing with 
 | asynchronous tasks, user input, dialog flow, and other multi-stage
 | problems which can't be addressed in one run of code.
 |
 | A particular Story is made of a tree of plot nodes.
 | Internal nodes are container nodes which control execution, 
 | leaves are action nodes which perform tasks.
 | Construction of the tree is the job of Story.Plot
 |
 | A Story must be >{Story.tell|told} to function. A Story.Tale represents this.
 | Any number of tales can be created from a single story.
 | Representation and control of a live story is in the domain of Story.Tale
 |
-- API/Interface
 | Each story plot node must handle a few basic functions:
 |   setup       : constructor inside a tale 
 |   update      : update inside a tale, return a truthy expression if the node is not "done".
 |   teardown    : destructor inside a tale
 |   handle(arg) : process events sent to the tale (this hasn't been used yet!)
 |
 | Let's illustrate with the two basic collection plot nodes: 
 |   Story.Sequence and Story.Compound.
 |
 | A Sequence node acts as each of its children in turn, setting up and
 | tearing down each one, and updating each one until it is "done".
 | A sequeunce which has run off then end of its children is "done".
 |
 | A Compound acts as all of its children, all their setups and
 | teardowns are done with the compound, and when all of them are
 | "done" then the compound is too.  A common pairing for compounds
 | is one node for delaying (fixed timeout, until click, until ajax
 | response), and another for displaying.
 |
 | Sequence and Compound are foundational patterns, complementing each other
 | like horizontal and vertical boxes in typesetting, unions and structs in 
 | memory.  They are the time-vs-space tradeoff made useful.
 |
 | Example:
 |
 >! jQuery.fn.click_and_tell = function(story) {
 >!   return this.click(function() {
 >!     new Story([story.plot, 
 >!       function() { $(this).attr('disabled', false); }.bind(this)
 >!     ]).tell({where: this}); 
 >!     $(this).attr('disabled', true);
 >!   });
 >! };
 >! window['TryIt'] = function(story) {
 >!   jQuery('<button/>')
 >!   .appendTo(this)
 >!   .text('Try It!')
 >!   .click_and_tell(story);
 >! };
 > TurnTheBackgroundBlueFor3Seconds = new Story({
 >   setup: function() { 
 >     var body = jQuery('body');
 >     this.style = body[0].getAttribute('style') || '';
 >     body.css('color', '#8B00FF');
 >   },
 >   teardown: function() {
 >     var body = jQuery('body');
 >     body[0].setAttribute('style', this.style);
 >   }
 > }, Story.Delay(1000));
 >! TryIt.call(this, TurnTheBackgroundBlueFor3Seconds);
 |
 | Here we defined a custom action as just an object with setup and teardown calls,
 | the argument list of a story is put into a Compound.  Arrays in a Compound are 
 | automatically converted to Sequences, and vice-versa.  
 |
 | Any non-array object or function that doesn't satisfy 
 | >>>thing instanceof Story.Plot<<< will | be converted to
 | a Story.Action, a function will become the update, an object can
 | specify a setup, teardown, update and/or handle as needed.
 |
 | You might like this pattern with saving and restoring css useful, but find specifying 
 | the setup and teardown calls tedious.  By all means, please, define new Plot node types.
 |
 | But make them as general as possible, you won't regret it.
 |
 > Story.Plot.Define('WithStyle', function(selector, style) {
 >   this.selector = selector;
 >   this.style = style;
 > }, {
 >   setup: function() {
 >     this.selector = typeof this.selector === 'function' 
 >       ? this.selector() 
 >       : jQuery(this.selector);
 >     this.restore = _.map(this.selector, function(elem) { 
 >       return elem.getAttribute('style');
 >     });
 >     _.each.call(this, this.selector, function(elem) {
 >       jQuery(elem).css(this.style);
 >     });
 >   },
 >   teardown: function() {
 >     _.each.call(this, this.selector, function(elem, index) {
 >       elem.setAttribute('style', this.restore[index]);
 >     });
 >   }
 > });
 |
 | And then we can define the same story as
 |
 > WithStyleExample = new Story(
 >   Story.WithStyle('body', { color: '#8B00FF' }),
 >   Story.Delay(3000)
 > );
 >! TryIt.call(this, WithStyleExample);
 |
 | Pretty slick, eh?
 |
 | Another blocking mechanism we can use is a check against a scope variable.
 | A Tale has a scope, which is just a javascript object which can be used to pass 
 | information between plot nodes.
 | 
 > ButtonExample = new Story({
 >   setup: function() {
 >     this.button = jQuery('<button/>').click(Story.callback(function() {
 >       this.scope.done = true;
 >     })).text('End Test!').insertAfter(this.scope.where);
 >   }, 
 >   teardown: function() { this.button.remove(); }
 > }, Story.WithStyle('body', { color: '#8B00FF' }), function() {
 >   return !this.scope.done;
 > });
 >! TryIt.call(this, ButtonExample);
 |
 | Communication between nodes is ideally limited to up, down to direct children, 
 | across through scope variables, and to the entire tree by handle.  This should allow reuse of
 | nodes across stories.
 |
 | Plot nodes can introduce new scopes, too, which inherit their parent scope and shadow it.
 | (just like local variables).
 |
 | Stories are executed with a context, which means that the current tale is
 | set in Story.Tale.context.tale, and the current node 
 | is Story.Tale.context.device.
 | Hopefully, you won't need to know that specifically,
 | but that's what's preserved when
 | you wrap a callback function with Story.callback.
 |
 */
 
/// @{Story}
/// A story's root node is a compound. To make a sequence, pass an array.
Story = _.Class(function() {
  this.plot = Story.Compound.apply(null, __args());
}, {
  proto: {
    /// @{Story.tell} begins telling a tale, update it and return it
    tell: function(scope) {
      var tale = new Story.Tale(this.plot, scope);
      tale.update();
      return tale;
    }
  },
  classic: { 
/// @{Story.callback} wraps a function so it can restore tale context when
/// it is executed.  It preserves static methods of Story and "this" 
/// inside the function.  After running, the story will be updated.
    callback: function(fn) {
      var args = __args();
      var device = Story.Tale.context.device;
      if(typeof fn === 'string') fn = device[fn];
      return Story.Tale.Context(device).bind(function() {
        try {
          return fn.apply(
            Story.Tale.context.device,
            args.concat(__args())
          );
        } finally {
          Story.Tale.context.tale.update();
        }
      });
    },
///
/// Story.update runs the update function again on the active tale.
///
    update: function() {
      return Story.Tale.context.tale.update();
    },
///
///handle propagates handle(arg) calls through all the active plot nodes.
///
    handle: function(arg) {
      return Story.Tale.context.tale.handle(arg);
    },
///
///Plot is responsible for definition of nodes and story construction.
///It is also the root class of all story nodes.
///
    Plot: _.Class(function(arg) {
      this.story = {
        options: {},
        children: {}
      };
    }, {
      proto: {
        /// These are the default implementations of 
        /// plot node functions. (used by Story.Tale)
        update: function() { return false; },
        setup: function() { },
        teardown: function() { },
        handle: function(arg) { },
        /// Options is a setup function,
        /// the only option right now is 'name'.
        Options: function(opts) { 
          var opts = _.overlay({}, opts);
          if(opts.name) {
            var own_scope = true;
            var name = opts.name;
            if(name.slice(0,1) === '+') {
              name = name.slice(1);
            } else if(name.slice(0,1) === '-') {
              own_scope = false;
              name = name.slice(1);
            } 
            opts.name = name;
            opts.own_scope = own_scope;
          }
          _.overlay(this.story.options, opts);
          return this; 
        },
        type: 'node'
      },
      classic: {
        /// Story.Plot.Define(name, constructor, {...proto...}}
        /// Defines a new plot node type, which you can use as Story[name].
        Define: function(name, init, prototype, options) {
          var base = Story.Plot;
          if(/:/.test(name)) {
            var parts = name.split(':');
            base = Story[parts[1]];
            name = parts[0];
          }
          if(Story[name]) {
            throw new Error("Story." + name + " already defined!");
          }
          Story[name] = _.Class(function() { 
            if(options) this.Options(options); 
            init.apply(this, arguments); 
          }, {
            base: base,
            proto: _.overlay({}, prototype, { type: name })
          });
        },
        /// Story.Plot.Register()
        /// Registers a node, and ensures that it IS a node.
        /// Registration doesn't do anything critical yet,
        /// but it provides the place we'll use to build
        /// visual debuggers and stuff.
        Register: function(parent, device, options) {
          _.push(parent.story.children, 
            (options || {}).name || "list", 
            device);
          if(!(device instanceof Story.Plot)) try {
            if(device instanceof Array) {
              device = Story.Plot.Build(device);
            } else {
              device = new Story.Action(device);
            }
          } catch(ex) {
            console.warn(
              "story(plot): %o failed to convert to a Story.Plot",
              device
            );
            debugger;
            var old_device = device;
            device = new Story.Action(function() {
              console.warn(
                "story(tale): %o failed to convert to a Story.Plot",
                old_device
              );
              debugger;
            });
          }
          device.story.parent = parent;
          return device;
        },
        /// Build takes an array and makes it into Sequence
        /// leading elements of the array which are strings beginning with
        /// '#' and '@' allow the type of container and the name of the
        /// array, respectively, to be easily specified.
        Build: function(list) {
          var type = "Sequence", 
              name;
          while(
            list.length > 0 && typeof list[0] === 'string'
          ) switch(list[0].slice(0,1)) {
          case '#':
            type = list[0].slice(1); 
            list = list.slice(1);
            break;
          case '@':
            name = list[0].slice(1);
            list = list.slice(1);
            break;
          default:
            debugger
            // fall out
          }
          var plot = Story[type].apply(null, list);

          if(name) plot.Options({name:name}); 
          return plot;
        }
      }
    }),
    /// The Story Tale class is responsible for running stories.
    Tale: _.Class(function(plot, scope) {
      this.device = Object.create(plot);
      this.scope = this.device.scope = scope || {};
      Story.Tale.Context(this.device, this).run('setup');
    }, {
      proto: {
        /// A tale knows how to update itself.
        update: function() { 
          if(!this.device) return false;

          var result = Story.Tale.Context(
            this.device, this
          ).run('update');

          if(!result) this.stop();
          return result;
        },
        handle: function(arg) {
          if(this.device) {
            return Story.Tale.Context(
              this.device, this
            ).run('handle', arg);
          }
        },
        stop: function() { 
          if(!this.device) return false;

          try {
            return Story.Tale.Context(
              this.device, this
            ).run('teardown');
          } finally {
            delete this.device;
          }
        }
      },
      classic: {
        /// Use Story.Tale.update(device)
        /// to update nodes from your own Story.Plot.Define nodes.
        update: function(device) {
          return Story.Tale.Context(device).run('update');
        },
        /// Use Story.Tale.setup(node)
        /// to get a device for that node.
        setup: function(node) {
          if(!node) { debugger; return null; }
          var device = Object.create(node);
          device.parent = Story.Tale.context.device;
          if(node.story.options.own_scope) {
            device.scope = Object.create(device.parent.scope);
          } else {
            device.scope = device.parent.scope; 
          }
          Story.Tale.Context(device).run('setup');
          return device;
        },
        /// Use Story.Tale.teardown(device)
        /// to destroy devices that you setup.
        teardown: function(device) {
          Story.Tale.Context(device).run('teardown');
        },
        /// Use Story.Tale.handle(device, arg)
        /// to pass on handle(...) to your active device(s).
        handle: function(device, arg) {
          return Story.Tale.Context(device).run('handle', arg);
        },
        /// Story.Tale.Context maintains the active 
        /// tale and the active plot device.
        /// An instance of it is set in Story.Tale.context 
        /// when a tale is being told.
        Context: _.Class(function(device, tale) {
          this.device = device || Story.Tale.context.device;
          this.tale = tale || Story.Tale.context.tale;
        }, {
          proto: {
            /// Context().run(function() { ... }) 
            /// executes that action with the context set.
            run: function(action) {
              return this.bind(action).apply(this, __args());
            },
            /// Context().bind(function() { ... }) returns a function 
            /// which executes with the context.
            bind: function(action) {
              if(typeof action !== 'function') {
                action = this.device[action];
              }
              var args = __args();
              return _.local.call(Story.Tale, {
                context: this
              }, function() {
                return action.apply(
                  Story.Tale.context.device,
                  args.concat(__args())
                );
              });
            }
          }
        })
      }
    }),
    /// Finds a parent node with the specified name.
    /// Sometimes you gotta mess with things directly.
    find: function(name) {
      var root = Story.Tale.context.device;
      while(root.parent && root.story.options.name != name) {
        root = root.parent;
      }
      return root;
    },
    /// Finds a parent scope with the specified name.
    /// If it's not found, return the root scope.
    scope: function(name) {
      if(name == '.') return Story.Tale.context.device.scope;
      var node = Story.find(name);
      return node ? node.scope : Story.Tale.context.tale.scope;
    },
    /// Reads a key (or "key@scope") from the scope.
    read: function(key) {
      var scope = '.';
      if(/@/.test(key)) {
        var parts = key.split('@');
        key = parts[0];
        scope = parts[1];
      }
      scope = Story.Tale.scope(scope);
      if(scope) return scope[key];
      else throw new Error("Story.access: No scope named " + scope);
    },
    /// Writes a value to key (or "key@scope") to the scope.
    write: function(key, value) {
      var scope = '.';
      if(/@/.test(key)) {
        var parts = key.split('@');
        key = parts[0];
        scope = parts[1];
      }
      scope = Story.Tale.scope(scope);
      if(scope) {
        var old_value = scope[key];
        scope[key] = value;
        return old_value;
      } else throw new Error("Story.access: No scope named " + scope);
    }
  }
});

/**
-- License
 | Copyright (c) 2011 Adam Freidin
 |
 | Permission is hereby granted, free of charge, to any person obtaining a copy
 | of this software and associated documentation files (the "Software"), to deal
 | in the Software without restriction, including without limitation the rights
 | to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 | copies of the Software, and to permit persons to whom the Software is
 | furnished to do so, subject to the following conditions:
 |
 | The above copyright notice and this permission notice shall be included in
 | all copies or substantial portions of the Software.
 |
 | THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 | IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 | FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 | AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 | LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 | OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 | THE SOFTWARE.
 |
 */
/* vim: set sw=2 ts=2 expandtab : */
