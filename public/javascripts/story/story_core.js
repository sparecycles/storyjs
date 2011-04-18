/*
 | Module: Story.Core
 | Requires: Layer
 | Author: Adam Freidin
 |
-- Introduction
 |
-| >{Story} is a framework for scripting behaviour over time.
 | 
 | Most programming languages lack the ability to keep track of
 | actions over time, story provides patterns for dealing with 
 | multi-stage tasks, like ajax handling, user input, and dialog flow:
 | problems which can't be addressed in one run of code.
 |
 | Story can address these kinds of tasks with modular,
 | composable nodes.  The main advantage being that a story
 | can represent something complicated like a UI flow 
 | with AJAX request response handling compactly, with no
 | need to trace through callback spaghetti.
 |
 | The original Story engine was written in the C language 
 | at the now defunct Santa Cruz Games for scripting 
 | tutorials.  The paradigm lends itself naturally 
 | to other uses and other languages.  
 
-- Overview
 |
 | The original concept of story is a representation 
 | of sequenced things that
 | need to be done one after another, and compounded things that 
 | happen together.
 | The first requirement lead to the concept of a node which needs to
 | be able to indicate completion.  Sequences and compounds can both
 | be nodes and so they are.
 |
 | A node indicates completion by returning false from its 
 | >{Story.Plot.update|update} method.  Note that a node may be updated
 | after it indicates completion or be ended prematurely, depending
 | on the structure. Also, completion isn't necessarily sticky, 
 | for instance a form validation node might go back and forth on its
 | status.
 | 
 | A Story holds a single plot node, the root of the plot tree.
 | Generally, internal nodes are container nodes which control execution, 
 | while the leaves of the tree are action nodes which perform tasks.
 | But exceptions are not uncommon, a dialog node might
 | have a few buttons, each button might hold a branch of the story,
 | but the dialog itself does something.
 |
 | The internal API for construction of the plot node tree 
 | is the job of >{Story.Plot}, which, by the way, is the base class for
 | all plot nodes.
 |
 | The plot in a story is a rigid, declarative structure,
 | So we must >{Story.tell|tell} a Story to use it.
 | A >{Story.Tale} represents an active story. Any number of tales can 
 | be created from a story, and each operate independently.
 | When a story is told, plot >{Story.Plot.Device|devices} are created
 | using javascript's prototypal inheritance from the plot node,
 | (betcha this is the first time you've
 | seen a non-trivial use of prototyping!).
 | If you don't know about prototyping
 | check out >{Story.Plot.Device.setup} to see how it's done.
 |
 | By the way, when implementing your own plot container nodes, 
 | >{Story.Plot.Device} has the API functions that manage
 | devices.
 |
 | Javascript lacks constructors and destructors, but Story does not.
 | A plot device's lifetime spans the time it is >{Story.Plot.setup}
 | to the time it runs >{Story.Plot.teardown}.  
 |
-- API/Interface
 | Each story plot node must handle a few basic functions
 |   setup       => constructor
 |   update      => update, returns false to indicate completion
 |   teardown    => destructor
 |   handle(arg) => process events sent to the tale (not used yet!)
 |
 | Let's illustrate with the two basic collection plot nodes: 
 |   <{?story#Story.Sequence|Story.Sequence} and 
 |   <{?story#Story.Compound|Story.Compound}.
 |
 | A Sequence node acts as each of its children in turn, setting up and
 | tearing down each one.
 | A sequeunce is complete when it is no longer updating any children.
 |
 | A Compound acts as all of its children, all their setups and
 | teardowns are done together, and the compound is complete when all
 | the children are complete.  One common pairing for compounds
 | is one node to display, while another performs some sort of 
 | asynchronous task (like AJAX, or <{?story#Story.Delay|Delay}).
 |
 | Example:
 |
 >! jQuery.fn.click_and_tell = function(story, target) {
 >!   return this.click(function() {
 >!     new Story([story.plot, 
 >!       function() { $(this).attr('disabled', false); }.bind(this)
 >!     ]).tell({where: this, target: target}); 
 >!     $(this).attr('disabled', true);
 >!   });
 >! };
 >! Story.Plot.Define('WithStyle_', function(selector, style) {
 >!   this.selector = selector;
 >!   this.style = style;
 >! }, {
 >!   setup: function() {
 >!     this.selector = typeof this.selector === 'function' 
 >!       ? this.selector() 
 >!       : jQuery(this.selector);
 >!     this.restore = _.map(this.selector, function(elem) { 
 >!       return elem.getAttribute('style');
 >!     });
 >!     _.each.call(this, this.selector, function(elem) {
 >!       jQuery(elem).css(this.style);
 >!     });
 >!   },
 >!   teardown: function() {
 >!     _.each.call(this, this.selector, function(elem, index) {
 >!       elem.setAttribute('style', this.restore[index]);
 >!     });
 >!   }
 >! });
 >! window['TryIt'] = function(story, title, target) {
 >!   var button = jQuery('<button/>')
 >!     .appendTo(Litijs.context.node)
 >!     .text(title || 'Try It!');
 >!   if(!target) target = jQuery('<div/>').addClass('target');
 >!   target.insertAfter(button);
 >!   button.click_and_tell(story, target);
 >! };
 >! Litijs.annotate = function(nodeid, type, thing) {
 >!   switch(type) {
 >!   case 'e': 
 >!      var animation = new Story([[Story.Delay(10), Story.WithStyle_(nodeid, {
 >!       'border-radius': '10px',
 >!       'background-color': '#A88',
 >!       'padding' : '4px',
 >!       'margin' : '-4px',
 >!       'opacity' : '1',
 >!       'webkit-transition-duration' : '0'
 >!     })],[Story.Delay(1000), Story.WithStyle_(nodeid, {
 >!       'webkit-transition-duration' : '1s',
 >!       'border-radius': '10px',
 >!       'padding' : '10px',
 >!       'margin' : '-10px',
 >!       'background-color': 'none',
 >!       'webkit-transition-property' : 'all'
 >!     })]]);
 >!     var running;
 >!     return function() {
 >!       if(running) running.stop();
 >!       running = animation.tell();
 >!       return thing.call(this);
 >!     };
 >!   default:
 >!     return function() { return Story.Compound(thing.call(this), Story.WithStyle_(nodeid, {
 >!       'border-left': '3px solid #373',
 >!       'border-right': '3px solid #373',
 >!       'border-radius': '10px',
 >!       'background-color': '#8A8',
 >!       'padding' : '4px',
 >!       'margin' : '-7px',
 >!       'opacity' : '1'
 >!     })); };
 >!   }
 >! };
 >!TryIt(
 > new Story({
 >   setup: function() { 
 >     @e(this.style = Story.read('target')[0].getAttribute('style') || ''@);
 >     @e(Story.read('target').css('background-color', 'red')@);
 >   },
 >   teardown: function() {
 >     @e(Story.read('target')[0].setAttribute('style', this.style)@);
 >   }
 > }, @(Story.Delay(1000)@))
 >!);
 |
 | Here we defined a custom action as just an object with setup and teardown calls,
 | the argument list of a story is put into a Compound.  Arrays in a Compound are 
 | automatically converted to Sequences, and vice-versa.  
 |
 | Any non-array object or function that doesn't satisfy 
 | >>>thing instanceof Story.Plot<<< will be converted to
 | a Story.Action, a function will become the update, an object can
 | specify a setup, teardown, update and/or handle as needed.
 |
 | You might like this pattern with saving and 
 | restoring css useful, but find specifying 
 | the setup and teardown calls tedious for each one, 
 | then by all means, please, >{Story.Plot.Define|define} new Plot node types.
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
 >!TryIt(
 > new Story(
 >   @(Story.WithStyle(function() { 
 >     return Story.read('target'); 
 >   }, { 'background-color': '#8B00FF' })@),
 >   @(Story.Delay(3000)@)
 > )
 >!);
 |
 | Pretty slick, eh?
 |
 | Another blocking mechanism we can use is a check against a scope variable.
 | A Tale has a scope, which is just a javascript object 
 | which can be used to pass information between plot nodes.
 | 
 >!TryIt(
 > new Story({
 >   setup: function() {
 >     @e(this.button = jQuery('<button/>').click(Story.callback(function() {
 >       @e(Story.write('done', true)@);
 >     })).text('End Test!').insertAfter(this.scope.where)@);
 >   }, 
 >   teardown: function() { @e(this.button.remove()@); }
 > }, @(Story.WithStyle(function() { return Story.read('target'); }, { 
 >   'background-color': '#8B00FF' 
 > })@), function() {
 >   return @e(!Story.read('done')@);
 > })
 >!);
 |
 | Communication between nodes is ideally limited to up, down to direct children, 
 | across through scope variables, and to the entire tree by handle.  This should allow reuse of
 | nodes across stories.
 |
 | Plot nodes can introduce new scopes, too, which inherit 
 | their parent scope and shadow it (just like local variables).
 |
 | Stories are executed with a context, which means that the current tale is
 | set in Story.Tale.context.tale, and the current node 
 | is Story.Tale.context.device.
 | Hopefully, you won't need to know that specifically,
 | but that's what's preserved when
 | you wrap a callback function with Story.callback.
 |
 | Let's see how to make a container node.  The following
 | defines a button which runs a plot node which it is clicked.
 | Essentially this is doing what the "Try It" buttons are doing,
 | but in a composible node form.
 > Story.Plot.Define("Button", function(text) {
 >   this.text = text;
 >   this.plot = Story.Plot.Build(["#Compound"].concat(__args()));
 > }, {
 >   setup: function() {
 >     this.button = jQuery('<button/>')
 >     .text(this.text)
 >     .click(Story.callback(function() {
 >       this.button.attr('disabled', true);
 >       this.clicked = true;
 >       this.device = Story.Plot.Device.setup(this.plot);
 >     })).insertAfter(Story.read('where'));
 >   },
 >   teardown: function() {
 >     if(this.device) Story.Plot.Device.teardown(this.device);
 >     this.button.remove();
 >   },
 >   update: function() {
 >     return !this.clicked || Story.Plot.Device.update(this.device);
 >   },
 >   handle: function(arg) {
 >     return this.device && Story.Plot.Device.handle(this.device);
 >   }
 > });
 |
 | This node lets us
 |
 
 |
 >
 > function Color(color) { 
 >   return Story.WithStyle(function() { 
 >     return Story.read('target'); 
 >   }, { 'background-color' : color });
 > }
 >! TryIt(
 >  new Story(
 >   @(Story.Button('Compound X')@),
 >   @(Story.Button('Compound Y')@),
 >   [ 
 >     @(Story.Button('Sequence')@),
 >     [@(Story.Button('Sequence green')@), @(Color('green')@)],
 >     [@(Story.Button('Sequence red', 
 >       @(Story.Delay(1000)@), @(Color('black')@)
 >     )@), @(Color('red')@)]
 >   ]
 >  )
 >! )
 |
-| Story
 | @{Story|}
 */
 
/// 
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
    /// it is executed.  It preserves the operation of class methods 
    /// of Story and "this" inside the function. 
    /// After running, the tale will be updated.
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
    /// @{Story.update} runs the update function again on the active tale.
    update: function() {
      return Story.Tale.context.tale.update();
    },
    /// @{Story.handle} propagates >{Story.Plot.handle|handle} calls through all the active plot nodes.
    handle: function(arg) {
      return Story.Tale.context.tale.handle(arg);
    },
    /// @{Story.find} finds a parent node with the specified name.
    /// Sometimes you gotta mess with things directly.
    find: function(name) {
      var root = Story.Tale.context.device;
      while(root.parent && root.story.options.name != name) {
        root = root.parent;
      }
      return root;
    },
    /// @{Story.scope} finds a parent scope with the specified name.
    /// If it's not found, return the root scope.
    scope: function(name) {
      if(name == '.') return Story.Tale.context.device.scope;
      var node = Story.find(name);
      return node ? node.scope : Story.Tale.context.tale.scope;
    },
    /// @{Story.read} reads a key (or "key@scope") from the scope.
    read: function(key) {
      var scope = '.';
      /// Split off the scope from the key if there's a scope
      if(/@/.test(key)) {
        var parts = key.split('@');
        key = parts[0];
        scope = parts[1];
      }
      scope = Story.scope(scope);
      if(scope) return scope[key];
      else throw new Error("Story.access: No scope named " + scope);
    },
    /// @{Story.write} writes a value to key (or "key@scope") to the scope.
    write: function(key, value) {
      var scope = '.';
      /// Split off the scope from the key if there's a scope
      if(/@/.test(key)) {
        var parts = key.split('@');
        key = parts[0];
        scope = parts[1];
      }
      scope = Story.scope(scope);
      if(scope) {
        var old_value = scope[key];
        scope[key] = value;
        return old_value;
      } else throw new Error("Story.access: No scope named " + scope);
    },
/*
-| Story.Plot
 | Plot is responsible for definition of nodes and story construction.
 | It is also the root class of all story nodes.
 */
    Plot: _.Class(function(arg) {
      this.story = {
        options: {},
        children: {}
      };
    }, {
      /// base implementations of plot node functions. 
      /// (see >{Story.Tale} for the public API to these)
      /// @{Story.Plot.update|}
      /// @{Story.Plot.setup|}
      /// @{Story.Plot.teardown|}
      /// @{Story.Plot.handle|}
      /// You actually NEVER want to call these functions directly,
      /// go through >{Story.Plot.Device} to make sure
      /// they are called with their 
      /// >{Story.Tale.Context|context}
      proto: {
        update: function() { return false; },
        setup: function() { },
        teardown: function() { },
        handle: function(arg) { },
        /// Options is used to setup the plot node,
        /// and is called directly.
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
        /// This gets hidden by subclases,
        /// for informational purposes only.
        type: 'node'
      },
      classic: {
        /// @{Story.Plot.Define}(name, constructor, {...proto...})
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
        /// @{Story.Plot.Register}()
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
        /// @{Story.Plot.Build} takes an array and makes it into Sequence
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
        },
/*
-| Story.Plot.Device
 |
 | 
 */
        Device: _.Class(function() {
        }, {
          classic: {
            /// @{Story.Plot.Device.update|}
            update: function(device) {
              return Story.Tale.Context(device).run('update');
            },
            /// @{Story.Plot.Device.setup|}
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
            /// @{Story.Plot.Device.teardown|}
            teardown: function(device) {
              Story.Tale.Context(device).run('teardown');
            },
            /// @{Story.Plot.Device.handle|}
            handle: function(device, arg) {
              return Story.Tale.Context(device).run('handle', arg);
            }
          }
        })
      }
    }),
/*
-| Story.Tale
 | Story.Tale is responsible for running stories.
 |
 | A tale can be >{Story.Tale.update|updated}, sent events through >{Story.Tale.handle|handle} and
 | >{Story.Tale.stop|stopped}.
 */
    Tale: _.Class(function(plot, scope) {
      this.device = Object.create(plot);
      this.scope = this.device.scope = scope || {};
      Story.Tale.Context(this.device, this).run('setup');
    }, {
      proto: {
        /// @{Story.Tale.update|} 
        /// These functions control a running story.
        update: function() { 
          if(!this.device) return false;

          var result = Story.Tale.Context(
            this.device, this
          ).run('update');

          if(!result) this.stop();
          return result;
        },
        /// @{Story.Tale.handle|} 
        handle: function(arg) {
          if(this.device) {
            return Story.Tale.Context(
              this.device, this
            ).run('handle', arg);
          }
        },
        /// @{Story.Tale.stop|} 
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
/*
-| Story.Tale.Context
 | @{Story.Tale.Context} maintains the active 
 | tale and the active plot device.
 | An instance of it is set in Story.Tale.context 
 | when a tale is being told.
 */
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
        }) // -- Story.Tale.Context
      }
    }) // -- Story.Tale
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
-- Git it
 | <{http://github.com/adam-f/storyjs}
 */
/* vim: set sw=2 ts=2 expandtab : */
