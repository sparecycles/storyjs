MVC = _layer.defineClass(function(data) {
  this.root = data;
  this.accessed_stack = [];
  this.written = {};
  this.data = new MVC.wrapper(this, this.root, 'data');

  this.listener_id_counter = 1;
  this.free_listener_id = 0;
  this.listeners = {};
  this.reasons = {};
  this.lock_count = 0;
}, null, {
  accessed: function() {
    return this.accessed_stack.slice(-1)[0] || {};
  },
  read: function(path) {
    //console.log('read: ', path);
    this.accessed()[path] = true;
  },
  write: function(path) {
    //console.log('write: ', path);
    var parts = path.split('.');
    var root, branch = this.written;
    $each(parts, function(part) {
      if(branch === true) {
        return;
      } 
      root = branch;
      branch = branch[part];
      if(!branch) {
        branch = root[part] = {};
      } 
    });
    if(branch !== true) root[parts.slice(-1)[0]] = true;
    this.update();
  },
  trace_access: function(self, fn) {
    var result;
    try {
      this.save_access_scope();
      fn.apply(self, __args());
    } finally {
      result = this.restore_access_scope();
    }
    return result;
  },
  save_access_scope: function() {
    this.accessed_stack.push({});
  },
  restore_access_scope: function() {
    var scope = $keys(this.accessed_stack.pop());
    return scope;
  },
  locked: function(action) {
    try {
      this.lock(); 
      return action.apply(this, __args()); 
    } finally { 
      this.unlock();
    }
  },
  lock: function() {
    this.lock_count++;
  },
  update: function() {
    if(this.lock_count === 0) {
      this.flush();
    }
  },
  unlock: function() {
    if(this.lock_count == 0) {
      console.warn('MVC: too many unlocks!');
    } else this.lock_count--;
    this.update();
  },
  generate_listener_id: function() {
    if(this.free_listener_id) {
      var id = this.free_listener_id;
      var free_listener = this.listeners[this.free_listener_id];
      console.assert(free_listener[1] == 0, "free listener not at end of list");
      this.free_listener_id = free_listener[0];
      if(free_listener[0]) this.listeners[free_listener[0]][1] = 0;
      return id;
    } else {
      return this.listener_id_counter++;
    }
  },
  register: function(listener, reasons) {
    var id = this.generate_listener_id();
    this.listeners[id] = { listener: listener, reasons: reasons };
    $each.call(this, reasons, function(reason) {
      $extend(this.reasons, $build(reason, [id, true]));
      var thereason = this.reasons[reason];
      if(!Object.hasOwnProperty.call(thereason, 'count')) {
        thereason.count =  0;
      }
      thereason.count += 1;
    });
    return id;
  },
  clear: function(listener_id) {
    if(listener_id) {
      var listener = this.listeners[listener_id];
      $each.call(this, listener.reasons, function(reason) {
        delete this.reasons[reason][listener_id];
        if(0 == --this.reasons[reason].count) {
          delete this.reasons[reason];
        }
      });
      this.listeners[listener_id] = [this.free_listener_id,0];
      if(this.free_listener_id) {
        this.listeners[this.free_listener_id][1] = listener_id;
      }
      this.free_listener_id = listener_id;
    }

    for(;;) {
      if(this.listener_id_counter <= 1) break;
      var index = this.listener_id_counter - 1;
      var listener = this.listeners[index];
      if(!(listener instanceof Array)) break;

      var prev = this.listeners[listener[0]];
      var next = this.listeners[listener[1]];
      if(prev) prev[1] = listener[1];
      if(next) next[0] = listener[0];

      if(this.free_listener_id == index) {
        this.free_listener_id = (next && next[0]) || 0;
      }
      delete this.listeners[--this.listener_id_counter];
    }

  },
  updated_paths: function() {
    var paths = [];
    function traverse(root, path) {
      for(var key in root) {
        var value = root[key], property = path + '.' + key;
        if(value === true) paths.push(property);
        else traverse(value, property);
      }
    }
    if(this.written.data) traverse(this.written.data, 'data');
    return paths;
  },
  flush: function() {
    var updated_listeners = {};
    $each.call(this, this.updated_paths(), function(reason) {
      var subpath = [];
      for(var listener_id in this.reasons[reason] || {}) {
        $extend(updated_listeners, $build(listener_id, [[reason]]));
      }
    });
    $each.call(this, updated_listeners, function(reasons, id) {
      if(id === 'count') return;
      if(!this.listeners[id]) return;
      var listener = this.listeners[id].listener;
      try {
        //console.log('updating listener ' + id + ' with reasons: ' + reasons);
        if(typeof listener === 'function') {
          listener(reasons);
        } else {
          if(!listener) { 
            // not sure if this is a problem... 
            // one listener's update killed another...? 
            // OK. Maybe more rude than evil.
            //debugger; 
          } else listener.update(reasons);
        }
      } catch(ex) {
        console.warn(
          'MVC: Failed to update listener with reasons: ', reasons, ex.stack
        );
        debugger;
      }
    });
    this.written = {};
  }
});

MVC.constant = function(value) {
  return new MVC.wrapper({read:_.layer.noop, write:_.layer.noop}, value, '!');
}

MVC.wrapper = _layer.defineClass(function MVC_wrapper(mvc, value, path) {
  this.mvc = mvc;
  this.value = value;
  this.path = path;
  var wrapper = MVC.wrapper.fn.bind(this);
  wrapper._ = $override(MVC.wrapper.fn._, { self: wrapper });
  return wrapper;
}, null, {
  get: function(access) {
    var path = this.path;
    var keys = String(access).split('.');
    var root = this.value;
    while(root && keys.length) {
      var key = keys.shift();
      root = root[key];
      this.mvc.read(path += '.' + key);
    }
    return MVC.wrapper(this.mvc, root, path);
  },
  set: function(access, value) {
    var keys = String(access).split('.');
    var root = this.value;
    var path = this.path;
    while(keys.length > 1) {
      var key = keys.shift();
      var next = root[key];
      this.mvc.read(path += '.' + key);
      if(next) root = next;
      else throw new Error('cannot set');
    }
    root[keys[0]] = value;
    this.mvc.write(path += '.' + keys[0]);
    return MVC.wrapper(this.mvc, value, path);
  }
});

var __internal = {};


MVC.wrapper.fn = function(key, value) {
  if(key === __internal) return this;
  switch(arguments.length) {
  case 0: 
    return this.value;
  case 1: 
    return this.get(key);
  case 2: 
    return this.set(key, value);
  }
};

MVC.wrapper.fn._ = {
  get: function(key) {
    return this.self(key)();
  },
  set: function(key, value) {
    return this.self(key, value)();
  }
};

// vim: set sw=2 ts=2 expandtab :
