Story = _.Class({
  init: function() {
    this.story = Story.Node.Build(Story.Group, __args());
  }, 
  proto: {
    tell: function(scope) { 
      return new Story.Telling(this.story, scope);
    }
  },
  statik: {
    Bind: function(fn) {
      var args = __args();
      var instance = Story.Node.active_instance;
      return function() {
        return Story.Node.with_activation.apply(null, [instance, fn].concat(args).concat(__args()));
      };
    },
    Node: _.Class({
      init: function() {
        this.children = [];
        this.options = {};
      },
      proto: {
        update: function() { return false; },
        setup: function() { },
        teardown: function() { },
        handle: function(arg) { },
        Options: function(opts) { _.overlay(this.options, opts); return this; },
        type: 'node',
      },
      statik: {
        Define: function(name, init, prototype, options) {
          // use eval to build function which has a decent name.
          Story[name] = _.Class({ 
            init: init,
            base: Story.Node,
            proto: _.overlay({}, prototype, { type: name })
          });
        },
        update: function(instance) {
          var success = false;
          return Story.Node.instance_call(instance, 'update');
        },
        instance_call: function(instance, action) {
          return this.with_activation.apply(null, [instance, instance[action]].concat(__args()));
        },
        with_activation: function(instance, fn) {
          return _.local.call(Story.Node, {active_instance: instance}, fn).apply(instance, __args());
        },
        setup: function(node) {
          if(!node) { debugger; return null; }
          var instance = Object.create(node);
          instance.parent = Story.Node.active_instance;
          if(node.options.owns_scope) {
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
          parent.children.push(node);
          return node;
        },
        Build: function(DefaultType, list) {
          if(list.length > 0 && typeof list[0] === 'string') switch(list[0].slice(0,1)) {
          case '#':
            return Story.Node.Build(Story[list[0].slice(1)], list.slice(1));
          case '@':
            var subgroup = Story.Node.Build(DefaultType, list.slice(1));
            subgroup.options.name = list[0].slice(1);
            subgroup.options.owns_scope = true;
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
        stop: function(arg) { 
          if(!this.instance) return false;

          try {
            return Story.Node.teardown(this.instance);
          } finally {
            delete this.instance;
          }
        }
      },
      statik: {
        read: function(scope, key) {
          return this.scope(scope)[key];
        },
        write: function(scope, key, value) {
          return this.scope(scope)[key] = value;
        },
        scope: function(name) {
          if(name == '.') return Story.Node.active_instance.scope;
          var node = Story.Telling.find(name);
          return node ? node.scope : null;
        },
        find: function(name) {
          var root = Story.Node.active_instance;
          while(root.parent && root.options.name != name) {
            root = root.parent;
          }
          return root;
        }
      }
    })
  }
});

// vim: set sw=2 ts=2 expandtab :
