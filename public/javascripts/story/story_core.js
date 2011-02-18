Story = _layer.defineClass(function Story() { 
  this.story = Story.Build(Story.Group, __args());
}, null, {
  tell: function(scope) { 
    var instance = Object.create(this.story);
    instance.scope = Object.create(scope || {});
    instance.scope.self = instance;
    var telling = instance.scope.story = new StoryTelling(instance);
    Story.instance_call(instance, 'setup');
    return telling;
  }
});

StoryTelling = _layer.defineClass(function StoryTelling(instance) {
  this.instance = instance;
}, null, {
  update: function() { return Story.update(this.instance); },
  handle: function(arg) { return Story.handle(this.instance, arg); },
  teardown: function(arg) { return Story.teardown(this.instance); }
})

Story.Tell = function(story) {
}

Story.activation = [];
Story.active_instance = function() {
  return Story.activation.slice(-1)[0] || null;
}
Story.active = function() {
  return Story.activation.length > 0;
}

$overlay(Story, {
  instance_call: function(instance, action) {
    if(!instance) debugger;
    try {
      Story.activation.push(instance);
      return instance[action].apply(instance, __args());
    } finally {
      Story.activation.pop();
    }
  },
  setup: function(node) {
    var instance = new Story.Instance(node, Story.active_instance());
    Story.instance_call(instance, 'setup');
    return instance;
  },
  teardown: function(instance) {
    Story.instance_call(instance, 'teardown');
  },
  update: function(instance) {
    return Story.instance_call(instance, 'update');
  },
  handle: function(instance, arg) {
    return Story.instance_call(instance, 'handle', arg);
  },
  Instance: function(node, parent) {
    var instance = Object.create(node);
    instance.parent = parent;
    instance.scope = new Story.Scope(instance);
    return instance;
  },
  Scope: function(instance, parent) {
    var proto = instance.parent ? instance.parent.scope : Object.prototype;
    if(typeof proto != 'object') debugger;
    var scope = Object.create(proto);
    scope.self = instance;
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
    this.options = options;
    return self;
  },
  DefineNode: function(name, create, prototype) {
    // use eval to build function which has a decent name.
    Story[name] = new Function('create', (
      "function Story$<name>() {                                 " + 
      "  var self = this.constructor == Story$<name>             " +
      "    ? this                                                " +
      "    : Object.create(Story.<name>.prototype);              " +
      "  self.children = [];                                     " +
      "  return Story.Options.construct(self, create, __args()); " +
      "}                                                         " +
      "return Story$<name>;                                      "
    ).replace(/<name>/g, name))(create);
    $overlay(Story[name].prototype, { type: name });
    Story[name] = _layer.defineClass(Story[name], Story.Node, prototype);
  },
  wait: function() {
    return Story.not(Story.and.apply(null, $map(__args(), function(arg) { 
      return Story.get(arg);
    }))); 
  },
  get: function(name) {
    return function() { 
      if(!this.scope) debugger;
      return this.scope[name]; 
    } 
  },
  set: function(name, value, scope) {
    if(arguments.length < 3) scope = 1;
    var setfn = function() {
      var root = this;
      var story = root.scope.story;
      if(typeof scope === 'number') {
        for(var i = 0; i < scope; i++) root = root.parent;
      } else {
        while(root.parent && root.name != scope) root = root.parent;
      }
      if(root === undefined) debugger;
      return function() {
        root.scope[name] = value;
        story.update();
      }
    };
    return Story.active() ? setfn.call(Story.active_instance()) : setfn;
  },
  delay: function(ms) {
    return {
      setup: function() {
        var self = this;
        this.timeout = setTimeout(function() {
          self.done = true; 
          self.scope.story.update(); 
        }, ms);
      },
      teardown: function() {
        clearTimeout(this.timeout);
      },
      update: function() { return !this.done; }
    };
  },
  Build: function(DefaultType, list) {
    if(list.length > 0 && typeof list[0] === 'string') switch(list[0][0]) {
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

$overlay(Story.Options, {
  construct: function(story_node, create, args) {
    var options = {};

    if(args[0] instanceof Story.Options) {
      options = args.shift();
    }

    create.apply(story_node, args);

    // apply options
    if(options.name) story_node.name = options.name;

    return story_node;
  }
});

Story.or = function() {
  var terms = __args();
  return function() { 
    var result = false;
    var args = __args();
    $each.call(this, terms, function(fn) {
      result = fn.apply(this, arguments) || result;
    });
    return result;
  } 
} 

Story.and = function() {
  var terms = __args();
  return function() { 
    var result = true;
    var args = __args();
    $each.call(this, terms, function(fn) {
      result = fn.apply(this, arguments) && result;
    });
    return result;
  } 
} 

Story.not = function(fn) { 
  return function() { return !fn.apply(this, arguments); } 
};
