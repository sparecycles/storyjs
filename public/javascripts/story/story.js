Story.Node.Define('Action', function(node) {
  if(typeof node === 'function') {
    this.update = node;
  } else {
    var node_functions = ['setup', 'teardown', 'update', 'handle'];
    _.each.call(this, node_functions, function(fn) {
      if(node[fn]) this[fn] = node[fn];
    });
  }
}, { });

Story.Node.Define('Loop', function() {
  this.steps = [];
  this.index = -1;
  _.each.call(this, __args(), function(node) {
    if(node instanceof Array) {
      node = Story.Node.Build(Story.Group, node);
    }
    this.steps.push(Story.Node.register(this, node));
  });
}, {
  setup: function() {
    this.current_step = Story.Node.setup(this.steps[this.index = 0]);
  },
  teardown: function() {
    if(this.current_step) Story.Node.teardown(this.current_step);
    delete this.current_step;
  },
  select: function(index) {
    if(this.current_step) {
      Story.Node.teardown(this.current_step);
      delete this.current_step;
    }
    var next_step = this.steps[this.index = index];
    if(next_step) this.current_step = Story.Node.setup(next_step);
  },
  update: function() {
    var steps = this.steps;
    var start = this.index;
    do {
      if(Story.Node.update(this.current_step)) break;
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
      Story.Node.handle(this.current_step, arg);
    }
  }
});

Story.Node.Define('Sequence', function() {
  this.steps = [];
  this.index = -1;
  var args = __args();
  _.each.call(this, args, function(node) {
    if(node instanceof Array) {
      node = Story.Node.Build(Story.Group, node);
    }
    this.steps.push(Story.Node.register(this, node));
  });
}, {
  setup: function() {
    this.current_step = Story.Node.setup(this.steps[this.index = 0]);
  },
  teardown: function() {
    if(this.current_step) Story.Node.teardown(this.current_step); 
    delete this.current_step;
  },
  select: function(index) {
    this.selected = true;
    var steps = this.steps;
    if(this.current_step) { 
      Story.Node.teardown(this.current_step);
      delete this.current_step;
    }
    this.index = index;
    var next_step = steps[this.index];
    if(next_step) {
      this.current_step = Story.Node.setup(next_step);
    }
  },
  update: function() {
    var steps = this.steps;
    while(this.current_step && !Story.Node.update(this.current_step)) {
      this.select.call(this, this.index + 1);
    }
    return this.index < steps.length;
  },
  handle: function(arg) {
    if(this.current_step) {
      Story.Node.handle(this.current_step, arg);
    }
  },
  restart: function() {
    return this.select(0);
  }
});

Story.Node.Define('Ignore', function() {
  this.steps = [];
  this.index = -1;
  _.each.call(this, __args(), function(node) {
    if(node instanceof Array) {
      node = Story.Node.Build(Story.Group, node);
    }
    this.steps.push(Story.Node.register(this, node));
  });
}, {
  setup: function() {
    this.current_step = Story.Node.setup(this.steps[this.index = 0]);
  },
  teardown: function() {
    if(this.current_step) {
      Story.Node.teardown(this.current_step);
      delete this.current_step;
    }
  },
  select: function(index) {
    if(this.current_step) {
      Story.Node.teardown(this.current_step);
      delete this.current_step;
    }
    var next_step = this.steps[this.index = index];
    if(next_step) this.current_step = Story.Node.setup(next_step);
  },
  update: function() {
    var steps = this.steps;
    while(this.current_step && !Story.Node.update(this.current_step))
      this.select.call(this, this.index + 1);
    return false;
  },
  handle: function(arg) {
    if(this.current_step) {
      Story.Node.handle(this.current_step, arg);
    }
  }
});

Story.Node.Define('Group', function() { 
  this.nodes = [];
  _.each.call(this, __args(), function(node) {
    if(node instanceof Array) {
      node = Story.Node.Build(Story.Sequence, node);
    }
    this.nodes.push(Story.Node.register(this, node));
  });
}, {
  setup: function() {
    this.instances = _.map.call(this, this.nodes, function(node) {
      return Story.Node.setup(node);
    });
  },
  teardown: function() {
    _.each(this.instances, function(node) {
      Story.Node.teardown(node);
    });
  },
  update: function() {
    var result = false;
    _.each(this.instances, function(node) {
      result = Story.Node.update(node) || result;
    });
    return result;
  },
  handle: function(arg) {
    _.each(this.instances, function(node) {
      Story.Node.handle(node, arg);
    });
  }
});

Story.Node.Define('Switch', function(states) {
  this.tasks = {};
  this.options = {};
  _.each.call(this, states, function(t, k) {
    if(k.slice(0,1) != '$') {
      if(t instanceof Array) {
        t = Story.Node.Build(Story.Sequence, t);
      }
      this.tasks[k] = Story.Node.register(this, t);
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
    this.current_task = task && Story.Node.setup(task);
  },
  teardown: function() {
    if(this.current_task) Story.Node.teardown(this.current_task);
    delete this.current_task;
  },
  update: function() {
    return this.current_task ? Story.Node.update(this.current_task) : 0;
  },
  handle: function(arg) {
    return this.current_task ? Story.Node.handle(this.current_task, arg) : 0;
  },
  select: function(state) {
    var next_task = this.tasks[state];
    if(!next_task) next_task = this.tasks[state];
    if(next_task) {
      if(this.current_task) Story.Node.teardown(this.current_task);
      this.state = state;
      this.current_task = Story.Node.setup(next_task);
    }
  }
});

Story.Node.Define('Live', function(interval) {
  arguments;
  this.interval = interval;
  this.node = Story.Node.register(this, Story.Node.Build(Story.Group, __args()));
}, {
  setup: function() {
    var story = this.scope.story;
    this.handle = setInterval(function() { story.update(); }, this.interval);
    this.content = Story.Node.setup(this.node);
  },
  update: function() {
    return Story.Node.update(this.content);
  },
  teardown: function() {
    Story.Node.teardown(this.content);
    clearInterval(this.handle);
  }
});

Story.Node.Define('Delay', function(ms) {
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
