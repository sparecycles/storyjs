/*
 | Module: Story
 | Author: Adam Freidin
 | Description: Defines the various core node-types for Story
-- Introduction
 | Coming Soon!
 */

/*
-- Story.Loop
 | A Loop plot node executes its
 | children one by one, and then restarts.
 | It only loops through its children once per update, starting wherever it left off.
 | It is never done, a parent must be made to tear it down prematurely to exit.
 */ 
Story.Plot.Define('Loop:Sequence', function() {
}, {
  update: function() {
    var steps = this.steps;
    var start = this.index;
    do {
      if(Story.Plot.Device.update(this.current_step)) break;
      if(this.index == steps.length - 1) {
        this.select(0);
      } else {
        this.select(this.index + 1);
      }
    } while(this.index != start);

    return true;
  }
});

/*
-- Story.Ignore
 * An ignore plot node is a sequence which always reports as done.
 */
Story.Plot.Define('Ignore:Sequence', function() {
  /// no special setup to do.
}, {
  update: function() {
    Story.Sequence.prototype.update.call(this);
    /// return false instead of whatever >{Story.Sequence.update} would have.
    return false;
  }
});

/*
-- Story.Switch
 | @{Story.Switch|} A plot node which acts as one of its children.
 |
 | The first parameter is an optional choice function which
 | determines which case of the switch to use. 
 |
 | If the first parameter is a string, that variable will be 
 | read from story and baked in.
 |
 | The choice function is disabled by calling >{Story.Switch.select|select}.
 |
 */
Story.Plot.Define('Switch', function(choose, states) {
  this.tasks = {};
  this.options = {};
  if(arguments.length == 1) {
    states = choose;
    choose = 'result';
  }
  if(typeof choose !== 'function') {
    choose = new function(choice) { return function() { 
      var the_choice = Story.read(choice); 
      this.choose = _.constant(the_choice); 
      return this.choose();
    }; }(choose);
  }
  this.choose = choose;
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
    this._select(this.choose());
  },
  teardown: function() {
    if(this.current_task) Story.Plot.Device.teardown(this.current_task);
    delete this.current_task;
  },
  update: function() {
    var new_state = this.choose();
    if(this.state != new_state) {
      this._select(new_state);
    }
    return this.current_task ? Story.Plot.Device.update(this.current_task) : 0;
  },
  handle: function(arg) {
    return this.current_task ? Story.Plot.Device.handle(this.current_task, arg) : 0;
  },
  /// Internal: changes state.
  _select: function(state) {
    var next_task = this.tasks[state];
    if(!next_task) next_task = this.tasks['*'];
    if(next_task) {
      if(this.current_task) {
        Story.Plot.Device.teardown(this.current_task);
      }
      this.state = state;
      this.current_task = Story.Plot.Device.setup(next_task);
    }
  },
  /// @{Story.Switch.select|select} destroys the choice function and
  /// switches to another state.
  select: function(state) {
    this.choose = _.constant(state);
    this._select(state);
  }
});

/*
-- Story.Delay
 | @{Story.Delay|} A plot node which remains active until a timeout completes.
 */
Story.Plot.Define('Delay', function(ms) {
  this.delay = ms;
}, {
  setup: function() {
    this.timeout = setTimeout(Story.callback(function() {
      this.done = true; 
    }), this.delay);
  },
  teardown: function() {
    clearTimeout(this.timeout);
  },
  update: function() {
    return !this.done;
  }
});

/*
-- Story.Live
 | This node actives an <{http://w3.org/|interval} which
 | updates the story periodically.  This should rarely be needed.
 */
Story.Plot.Define('Live', function(interval) {
  arguments;
  this.interval = interval;
  this.plot = Story.Plot.Register(this, Story.Plot.Build(__args()));
}, {
  setup: function() {
    this.interval = setInterval(Story.callback(Story.update), this.interval);
    this.device = Story.Plot.Device.setup(this.plot);
  },
  update: function() {
    return Story.Plot.Device.update(this.device);
  },
  teardown: function() {
    Story.Plot.Device.teardown(this.device);
    clearInterval(this.interval);
  }
});

/*
-- Licence
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
 */

/* vim: set sw=2 ts=2 expandtab : */
