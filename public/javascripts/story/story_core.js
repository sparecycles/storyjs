Story = _.Class({
  init: function() {
    this.story = Story.Node.Build(Story.Group, __args());
  }, 
  proto: {
    tell: function(scope) { 
      return new Story.Telling(this.story, scope);
    }
  },
  classic: {
    callback: function(fn) {
      var args = __args();
      var instance = Story.Telling.active_instance;
      var story = instance.scope.story;
      if(typeof fn === 'string') fn = instance[fn];
      return _.local.call(Story.Telling, {active_instance: instance}, function() {
        try {
          return fn.apply(instance, args.concat(__args()));
        } finally {
          story.update();
        }
      });
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
        update: function(instance) {
          var success = false;
          return Story.Node.instance_call(instance, 'update');
        },
        with_activation: function(instance, action) {
          return Story.Node.instance_call.apply(this, arguments);
        },
        instance_call: function(instance, action) {
          return _.local.call(Story.Telling, {active_instance: instance}, 
            typeof action === 'string' ? instance[action] : action
          ).apply(instance, __args());
        },
        setup: function(node) {
          if(!node) { debugger; return null; }
          var instance = Object.create(node);
          instance.parent = Story.Telling.active_instance;
          if(node.story.options.name) {
            instance.scope = Object.create(instance.parent.scope);
          } else {
            instance.scope = instance.parent.scope; 
          }
          Story.Node.instance_call(instance, 'setup');
          return instance;
        },
        teardown: function(instance) {
          Story.Node.instance_call(instance, 'teardown');
        },
        handle: function(instance, arg) {
          return Story.Node.instance_call(instance, 'handle', arg);
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
    Telling: _.Class({
      init: function(story, scope) {
        this.instance = Object.create(story);
        this.instance.scope = Object.create(scope || {});
        this.instance.scope.story = this;
        Story.Node.instance_call(this.instance, 'setup');
        this.update();
      },
      proto: {
        update: function() { 
          if(!this.instance) return false;
          var result = Story.Node.update(this.instance);
          if(!result) this.stop();
          return result;
        },
        handle: function(arg) {
          if(this.instance) {
            return Story.Node.handle(this.instance, arg);
          }
        },
        stop: function() { 
          if(!this.instance) return false;

          try {
            return Story.Node.teardown(this.instance);
          } finally {
            delete this.instance;
          }
        }
      }
    }),
    find: function(name) {
      var root = Story.Telling.active_instance;
      while(root.parent && root.story.options.name != name) {
        root = root.parent;
      }
      return root;
    },
    scope: function(name) {
      if(name == '.') return Story.Telling.active_instance.scope;
      var node = Story.find(name);
      return node ? node.scope : null;
    }
  }
});

// vim: set sw=2 ts=2 expandtab :
