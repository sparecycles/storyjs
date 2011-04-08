Story = _.Class({
  init: function() {
    this.story = Story.Node.Build(Story.Group, __args());
  }, 
  proto: {
    tell: function(scope) { 
      return new Story.Tale(this.story, scope);
    }
  },
  classic: {
    callback: function(fn) {
      var args = __args();
      var phrase = Story.Tale.context.phrase;
      if(typeof fn === 'string') fn = phrase[fn];
      return _.local.call(Story.Tale, {
        context: Story.Tale.Context(phrase),
      }, function() {
        try {
          return fn.apply(Story.Tale.context.phrase, args.concat(__args()));
        } finally {
          Story.Tale.context.tale.update();
        }
      });
    },
    update: function() {
      return Story.Tale.context.tale.update();
    },
    handle: function(arg) {
      return Story.Tale.context.tale.handle(arg);
    },
    Node: _.Class({
      init: function() {
        this.story = {
          options: {}
        };
      },
      proto: {
        update: function() { return false; },
        setup: function() { },
        teardown: function() { },
        handle: function(arg) { },
        Options: function(opts) { _.overlay(this.story.options, opts); return this; },
        type: 'node'
      },
      classic: {
        Define: function(name, init, prototype, options) {
          // use eval to build function which has a decent name.
          Story[name] = _.Class({ 
            init: function() { 
              if(options) this.Options(options); 
              init.apply(this, arguments); 
            },
            base: Story.Node,
            proto: _.overlay({}, prototype, { type: name })
          });
        },
        register: function(parent, node) {
          if(!(node instanceof Story.Node)) {
            node = new Story.Action(node);
          }
          node.parent = parent;
          return node;
        },
        Build: function(DefaultType, list) {
          if(list.length > 0 && typeof list[0] === 'string') switch(list[0].slice(0,1)) {
          case '#':
            return Story.Node.Build(Story[list[0].slice(1)], list.slice(1));
          case '@':
            var subgroup = Story.Node.Build(DefaultType, list.slice(1));
            subgroup.story.options.name = list[0].slice(1);
            return subgroup;
          default:
            // fall out
          }
          return DefaultType.apply(null, list);
        }
      }
    }),
    Tale: _.Class({
      init: function(story, scope) {
        this.phrase = Object.create(story);
        this.phrase.scope = Object.create(scope || {});
        Story.Tale.Context(this.phrase, this).run('setup');
        this.update();
      },
      proto: {
        update: function() { 
          if(!this.phrase) return false;
          var result = Story.Tale.Context(this.phrase, this).run('update');
          if(!result) this.stop();
          return result;
        },
        handle: function(arg) {
          if(this.phrase) {
            return Story.Tale.Context(this.phrase, this).run('handle', arg);
          }
        },
        stop: function() { 
          if(!this.phrase) return false;

          try {
            return Story.Tale.Context(this.phrase, this).run('teardown');
          } finally {
            delete this.phrase;
          }
        },
      },
      classic: {
        Context: _.Class({
          init: function() {
            var args = __args(), phrase, tale;
            for(var index = 0; index < args.length; index++) switch(index) {
            case 0: phrase = args[index]; break;
            case 1: tale = args[index]; break;
            default: debugger;
            }
            this.phrase = phrase || Story.Tale.context.phrase;
            this.tale = tale || Story.Tale.context.tale;
          },
          proto: {
            run: function(action) {
              if(typeof action !== 'function') {
                action = this.phrase[action];
              }

              return _.local.call(Story.Tale, {
                context: this
              }, action).call(this.phrase, __args);
            }
          }
        }),
        update: function(phrase) {
          var success = false;
          return Story.Tale.Context(phrase).run('update');
        },
        instance_call: function(phrase, action) {
          return Story.Tale.Context(phrase).run(action);
        },
        setup: function(node) {
          if(!node) { debugger; return null; }
          var phrase = Object.create(node);
          phrase.parent = Story.Tale.context.phrase;
          if(node.story.options.name) {
            phrase.scope = Object.create(phrase.parent.scope);
          } else {
            phrase.scope = phrase.parent.scope; 
          }
          Story.Tale.Context(phrase).run('setup');
          return phrase;
        },
        teardown: function(phrase) {
          Story.Tale.Context(phrase).run('teardown');
        },
        handle: function(phrase, arg) {
          return Story.Tale.Context(phrase).run('handle', arg);
        }
      }
    }),
    find: function(name) {
      var root = Story.Tale.context.phrase;
      while(root.parent && root.story.options.name != name) {
        root = root.parent;
      }
      return root;
    },
    scope: function(name) {
      if(name == '.') return Story.Tale.context.phrase.scope;
      var node = Story.find(name);
      return node ? node.scope : null;
    }
  }
});

// vim: set sw=2 ts=2 expandtab :
