Story = _.Class({
  init: function() {
    this.story = Story.Build(Story.Group, __args());
  }, 
  proto: {
    tell: function(scope) { 
      var instance = Object.create(this.story);
      instance.scope = Object.create(scope || {});
      var telling = instance.scope.story = new StoryTelling(instance);
      Story.instance_call(instance, 'setup');
      return telling;
    }
  } 
});

StoryTelling = _.defineClass(function StoryTelling(instance) {
  this.instance = instance;
}, null, {
  update: function() { return Story.update(this.instance); },
  handle: function(arg) { return Story.handle(this.instance, arg); },
  teardown: function(arg) { return Story.teardown(this.instance); }
})

StoryTelling.findScope = function(instance, name) {
  while(instance && instance.options.name != name) instance = instance.parent;
  return instance ? instance.scope : null;
}

Story.Tell = function(story) {
}

Story.active = function() {
  return !!Story.active_instance;
}

_.overlay(Story, {
  with_activation: function(instance, fn) {
    return _.local.call(Story, {active_instance: instance}, function() { 
      return fn.apply(instance, __args());
    }).call(instance, __args());
  },
  instance_call: function(instance, action) {
    return _.local.call(Story, {active_instance: instance}, 
      instance[action]
    ).apply(instance, __args());
  },
  setup: function(node) {
    if(!node) return null;
    var instance = new Story.Instance(node, Story.active_instance);
    Story.instance_call(instance, 'setup');
    instance.requests = [];
    return instance;
  },
  teardown: function(instance) {
    Story.instance_call(instance, 'teardown');
  },
  handle_requests: function(instance) {
    var requests;
    while(requests = instance.requests) {
      if(requests.length == 0) break;
      instance.requests = [];
      _.each(requests, function(req) {
        req.call(instance);
      });
    }
  },
  update: function(instance) {
    var success = false;
    try {
      var result = Story.instance_call(instance, 'update');
      success = true;
      return result;
    } finally {
      if(success) {
        Story.handle_requests(instance);
      }
    }
  },
  handle: function(instance, arg) {
    return Story.instance_call(instance, 'handle', arg);
  },
  Instance: function(node, parent) {
    var instance = Object.create(node);
    instance.parent = parent;
    if(node.options.owns_scope) {
      instance.scope = new Story.Scope(instance);
    } else {
      instance.scope = parent.scope;
    }
    return instance;
  },
  Scope: function(instance, parent) {
    var proto = instance.parent ? instance.parent.scope : Object.prototype;
    if(typeof proto != 'object') debugger;
    var scope = Object.create(proto);
    return scope;
  },
  register: function(parent, node) {
    if(!(node instanceof Story.Node)) {
      node = new Story.Action(node);
    }
    node.parent = parent;
    parent.children.push(node);
    return node;
  },
  Node: function() { 
  },
  Options: function(options) {
    var self = this;
    if(this.constructor != Story.Options) self = new Story.Options();
    self.options = options;
    return self;
  },
  DefineNode: function(name, init, prototype, options) {
    // use eval to build function which has a decent name.
    Function('init', 'Story', 'options', _.evil_format(
      "Story.%{name} = function Story_%{name}() {                " + 
      "  var self = this.constructor == Story.%{name}            " +
      "    ? this                                                " +
      "    : Object.create(Story.%{name}.prototype);             " +
      "  self.children = [];                                     " +
      "  self.options = options;                                 " +
      "  return Story.Options.construct(self, init, __args());   " +
      "}                                                         "
    , { name: name }))(init, Story, options || {});
    Story[name] = _.defineClass(Story[name], Story.Node, prototype);
  },
  find: function(name) {
    var root = Story.active_instance;
    while(root.parent && root.name != name) {
      root = root.parent;
    }
    return root;
  },
  Build: function(DefaultType, list) {
    if(list.length > 0 && typeof list[0] === 'string') switch(list[0].slice(0,1)) {
    case '#':
      return Story.Build(Story[list[0].slice(1)], list.slice(1));
    case '@':
      var subgroup = Story.Build(DefaultType, list.slice(1));
      subgroup.name = list[0].slice(1);
      return subgroup;
    default:
      // fall out
    }

    return DefaultType.apply(null, list);
  }
});

_.overlay(Story.Options, {
  construct: function(node, init, args) {
    var options = null;

    if(args[0] instanceof Story.Options) {
      options = args.shift().options;
    }

    init.apply(node, args);

    if(options) {
      node.options = _.overlay({}, node.options, options);
    }

    return node;
  }
});

Story.Node = _.defineClass(Story.Node, null, {
  update: function() { return false; },
  setup: function() { },
  teardown: function() { },
  handle: function(arg) { },
  please: function(action) {
    var fn = action;
    if(typeof fn === 'string') {
      fn = this[fn];
    }
    if(typeof fn === 'function') {
      if(!this.requests) this.requests = [];
      var args = __args();
      this.requests.push(function() {
        fn.apply(this, args);
      });
    } else {
      console.log(this.constructor.name, "doesn't understand: ", action);
      debugger;
    }
  },
  type: 'node'
});

// vim: set sw=2 ts=2 expandtab :
