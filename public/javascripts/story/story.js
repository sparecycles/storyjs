/** Story
 *
-- Licence
 * Copyright (c) 2011 Adam Freidin
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

Story.Plot.Define('Action', function(device) {
  if(typeof device === 'function') {
    this.update = device;
  } else {
    var device_functions = ['setup', 'teardown', 'update', 'handle'];

    _.each.call(this, device_functions, function(fn) {
      if(device[fn]) this[fn] = device[fn];
    });

    if(device.name) this.Options({name:device.name});
  }
}, { });

Story.Plot.Define('Sequence', function() {
  this.steps = [];
  this.index = -1;
  var args = __args();
  _.each.call(this, args, function(device) {
    if(device instanceof Array) {
      device = Story.Plot.Build(["#Compound"].concat(device));
    }
    this.steps.push(Story.Plot.Register(this, device));
  });
}, {
  setup: function() {
    this.current_step = Story.Tale.setup(this.steps[this.index = 0]);
  },
  teardown: function() {
    if(this.current_step) Story.Tale.teardown(this.current_step); 
    delete this.current_step;
  },
  select: function(index) {
    this.selected = true;
    if(this.current_step) { 
      Story.Tale.teardown(this.current_step);
      delete this.current_step;
    }
    this.index = index;
    var next_step = this.steps[this.index];
    if(next_step) {
      this.current_step = Story.Tale.setup(next_step);
    }
  },
  update: function() {
    while(this.current_step && !Story.Tale.update(this.current_step)) {
      this.select(this.index + 1);
    }
    return this.index < this.steps.length;
  },
  handle: function(arg) {
    if(this.current_step) {
      Story.Tale.handle(this.current_step, arg);
    }
  },
  restart: function() {
    return this.select(0);
  }
});

Story.Plot.Define('Loop:Sequence', function() {
}, {
  update: function() {
    var steps = this.steps;
    var start = this.index;
    do {
      if(Story.Tale.update(this.current_step)) break;
      if(this.index == steps.length - 1) {
        this.select(0);
      } else {
        this.select(this.index + 1);
      }
    } while(this.index != start);

    return true;
  }
});


Story.Plot.Define('Ignore:Sequence', function() {
}, {
  update: function() {
    Story.Sequence.prototype.update.call(this);
    return false;
  }
});

Story.Plot.Define('Compound', function() { 
  this.plots = [];
  _.each.call(this, __args(), function(plot) {
    if(plot instanceof Array) {
      plot = Story.Plot.Build(plot);
    }
    this.plots.push(Story.Plot.Register(this, plot));
  });
}, {
  setup: function() {
    this.devices = _.map.call(this, this.plots, function(plot) {
      return Story.Tale.setup(plot);
    });
  },
  teardown: function() {
    _.each(this.devices.slice().reverse(), function(device) {
      Story.Tale.teardown(device);
    });
  },
  update: function() {
    var result = false;
    _.each(this.devices, function(device) {
      result = Story.Tale.update(device) || result;
    });
    return result;
  },
  handle: function(arg) {
    _.each(this.devices, function(device) {
      Story.Tale.handle(device, arg);
    });
  }
});

Story.Plot.Define('Switch', function(states) {
  this.tasks = {};
  this.options = {};
  _.each.call(this, states, function(t, k) {
    if(k.slice(0,1) != '$') {
      if(t instanceof Array) {
        t = Story.Plot.Build(t);
      }
      this.tasks[k] = Story.Plot.Register(this, t);
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
    this.current_task = task && Story.Tale.setup(task);
  },
  teardown: function() {
    if(this.current_task) Story.Tale.teardown(this.current_task);
    delete this.current_task;
  },
  update: function() {
    return this.current_task ? Story.Tale.update(this.current_task) : 0;
  },
  handle: function(arg) {
    return this.current_task ? Story.Tale.handle(this.current_task, arg) : 0;
  },
  select: function(state) {
    var next_task = this.tasks[state];
    if(!next_task) next_task = this.tasks[state];
    if(next_task) {
      if(this.current_task) Story.Tale.teardown(this.current_task);
      this.state = state;
      this.current_task = Story.Tale.setup(next_task);
    }
  }
});

Story.Plot.Define('Live', function(interval) {
  arguments;
  this.interval = interval;
  this.device = Story.Plot.Register(this, Story.Plot.Build(__args()));
}, {
  setup: function() {
    this.handle = setInterval(Story.callback(Story.update), this.interval);
    this.content = Story.Tale.setup(this.device);
  },
  update: function() {
    return Story.Tale.update(this.content);
  },
  teardown: function() {
    Story.Tale.teardown(this.content);
    clearInterval(this.handle);
  }
});

Story.Plot.Define('Delay', function(ms) {
  this.delay = ms;
}, {
  setup: function() {
    var self = this;
    this.timeout = setTimeout(Story.callback(function() {
      self.done = true; 
      Story.update(); 
    }), this.delay);
  },
  teardown: function() {
    clearTimeout(this.timeout);
  },
  update: function() {
    return !this.done;
  }
});

// vim: set sw=2 ts=2 expandtab :
