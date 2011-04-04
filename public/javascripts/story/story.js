Story.DefineNode('Action', function(node) {
  if(typeof node === 'function') {
    this.update = node;
  } else {
    var node_functions = ['setup', 'teardown', 'update', 'handle'];
    _.each.call(this, node_functions, function(fn) {
      if(node[fn]) this[fn] = node[fn];
    });
  }
}, { });

Story.DefineNode('Loop', function() {
  this.steps = [];
  this.index = -1;
  _.each.call(this, __args(), function(node) {
    if(node instanceof Array) {
      node = Story.Build(Story.Group, node);
    }
    this.steps.push(Story.register(this, node));
  });
}, {
  setup: function() {
    this.current_step = Story.setup(this.steps[this.index = 0]);
  },
  teardown: function() {
    if(this.current_step) Story.teardown(this.current_step);
    delete this.current_step;
  },
  select: function(index) {
    if(this.current_step) {
      Story.teardown(this.current_step);
      delete this.current_step;
    }
    var next_step = this.steps[this.index = index];
    if(next_step) this.current_step = Story.setup(next_step);
  },
  update: function() {
    var steps = this.steps;
    var start = this.index;
    do {
      if(Story.update(this.current_step)) break;
      if(this.index == steps.length - 1) {
        this.select(0);
      } else {
        this.select.call(this, this.index + 1);
      }
    } while(this.index != start);
    return true;
  },
  handle: function(arg) {
    if(this.current_step) {
      Story.handle(this.current_step, arg);
    }
  }
});

Story.DefineNode('Sequence', function() {
  this.steps = [];
  this.index = -1;
  var args = __args();
  _.each.call(this, args, function(node) {
    if(node instanceof Array) {
      node = Story.Build(Story.Group, node);
    }
    this.steps.push(Story.register(this, node));
  });
}, {
  setup: function() {
    this.current_step = Story.setup(this.steps[this.index = 0]);
  },
  teardown: function() {
    if(this.current_step) Story.teardown(this.current_step); 
    delete this.current_step;
  },
  select: function(index) {
    this.selected = true;
    var steps = this.steps;
    if(this.current_step) { 
      Story.teardown(this.current_step);
      delete this.current_step;
    }
    this.index = index;
    var next_step = steps[this.index];
    if(next_step) {
      this.current_step = Story.setup(next_step);
    }
  },
  update: function() {
    var steps = this.steps;
    while(this.current_step && !Story.update(this.current_step)) {
      delete this.selected;
      Story.handle_requests(this);
      if(!this.selected) this.select.call(this, this.index + 1);
    }
    return this.index < steps.length;
  },
  handle: function(arg) {
    if(this.current_step) {
      Story.handle(this.current_step, arg);
    }
  },
  restart: function() {
    return this.select(0);
  }
}, { owns_scope: true });

Story.DefineNode('Ignore', function() {
  this.steps = [];
  this.index = -1;
  _.each.call(this, __args(), function(node) {
    if(node instanceof Array) {
      node = Story.Build(Story.Group, node);
    }
    this.steps.push(Story.register(this, node));
  });
}, {
  setup: function() {
    this.current_step = Story.setup(this.steps[this.index = 0]);
  },
  teardown: function() {
    if(this.current_step) {
      Story.teardown(this.current_step);
      delete this.current_step;
    }
  },
  select: function(index) {
    if(this.current_step) {
      Story.teardown(this.current_step);
      delete this.current_step;
    }
    var next_step = this.steps[this.index = index];
    if(next_step) this.current_step = Story.setup(next_step);
  },
  update: function() {
    var steps = this.steps;
    while(this.current_step && !Story.update(this.current_step))
      this.select.call(this, this.index + 1);
    return false;
  },
  handle: function(arg) {
    if(this.current_step) {
      Story.handle(this.current_step, arg);
    }
  }
});

Story.DefineNode('Group', function() { 
  this.nodes = [];
  _.each.call(this, __args(), function(node) {
    if(node instanceof Array) {
      node = Story.Build(Story.Sequence, node);
    }
    this.nodes.push(Story.register(this, node));
  });
}, {
  setup: function() {
    this.instances = _.map.call(this, this.nodes, function(node) {
      return Story.setup(node);
    });
  },
  teardown: function() {
    _.each(this.instances, function(node) {
      Story.teardown(node);
    });
  },
  update: function() {
    var result = false;
    _.each(this.instances, function(node) {
      result = Story.update(node) || result;
    });
    return result;
  },
  handle: function(arg) {
    _.each(this.instances, function(node) {
      Story.handle(node, arg);
    });
  }
});

Story.DefineNode('Switch', function(states) {
  this.tasks = {};
  this.options = {};
  _.each.call(this, states, function(t, k) {
    if(k.slice(0,1) != '$') {
      if(t instanceof Array) {
        t = Story.Build(Story.Sequence, t);
      }
      this.tasks[k] = Story.register(this, t);
    } else this.options[k] = t;
  });
}, {
  setup: function() {
    var $default = this.options.$default;
    this.state = this.scope.result || $default;
    var task = this.tasks[this.state];
    if(!task) {
      task = this.tasks['*'];
    }
    this.current_task = Story.setup(task);
  },
  teardown: function() {
    if(this.current_task) Story.teardown(this.current_task);
    delete this.current_task;
  },
  update: function() {
    return this.current_task ? Story.update(this.current_task) : 0;
  },
  handle: function(arg) {
    return this.current_task ? Story.handle(this.current_task, arg) : 0;
  },
  select: function(state) {
    var next_task = this.tasks[state];
    if(!next_task) next_task = this.tasks[state];
    if(next_task) {
      if(this.current_task) Story.teardown(this.current_task);
      this.state = state;
      this.current_task = Story.setup(next_task);
    }
  }
});

Story.DefineNode('Live', function(interval) {
  this.interval = interval;
  this.node = Story.register(this, Story.Build(Story.Group, __args()));
}, {
  setup: function() {
    var story = this.scope.story;
    this.handle = setInterval(function() { story.update(); }, this.interval);
    this.content = Story.setup(this.node);
  },
  update: function() {
    return Story.update(this.content);
  },
  teardown: function() {
    Story.teardown(this.content);
    clearInterval(this.handle);
  }
});

Story.DefineNode('Delay', function(ms) {
  this.delay = ms;
}, {
  setup: function() {
    var self = this;
    this.timeout = setTimeout(function() {
      self.done = true; 
      self.scope.story.update(); 
    }, this.delay);
  },
  teardown: function() {
    clearTimeout(this.timeout);
  },
  update: function() {
    return !this.done;
  }
});

// vim: set sw=2 ts=2 expandtab :
