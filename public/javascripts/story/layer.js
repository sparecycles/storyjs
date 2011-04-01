var TESTING = false;
// Just in case
if(Object.create === undefined || TESTING) {
  Object.create = function(proto) {
    function _() {};
    _.prototype = proto;
    return new _;
  }
}

if(Object.getPrototypeOf === undefined || TESTING) {
  Object.getPrototypeOf = function(obj) {
    return obj.constructor.prototype;
  }
}

if(Object.freeze === undefined || TESTING) {
  Object.freeze = function(obj) {
    return obj;
  }
}

if(Object.isFrozen === undefined || TESTING) {
  Object.isFrozen = function(obj) {
    return false;
  }
}

if(Object.keys === undefined || TESTING) {
  Object.keys = function(obj) {
    var result = [];
    for(var k in obj) if(Object.prototype.hasOwnProperty.call(obj, k)) {
      result.push(k);
    }
    return k;
  }
}

if(Object.getOwnPropertyNames === undefined || TESTING) {
  Object.getOwnPropertyNames === Object.keys;
}

if(!Function.prototype.bind || TESTING) {
  Function.prototype.bind = function(self) {
    var fn = this;
    var args = __args();
    return function() { 
      return fn.apply(self || null, args.concat(__args())); 
    };
  };
}

if(!Object.hasOwnProperty.call(window, 'console')) {
  console = {
    log: function() {},
    warn: function() {},
    error: function() {},
    info: function() {},
    assert: function(t, msg) { 
      if(!t) { 
        alert("assertion failed: " + msg); 
        throw new Error('assert failed'); 
      } 
    }
  };
}

// Function: __args
// Extends javascript with something nice.
// __args() evaluates to the Array of arguments passed to a function
// after the named args.
function __args() { 
  var caller = __args.caller;
  return Array.prototype.slice.call(caller.arguments, caller.length); 
}

function $is_object(thing) {
  return typeof thing === 'object' && thing instanceof Object;
}

function $is_primitive(thing) {
  return thing === null || thing === undefined || (Object(thing) !== thing && Object(thing).valueOf() === thing);
}

// Function: $extend
// overlay maps, but on collisions: concatenates arrays, and combines functions, recursively.
// applies to the first argument, which is returned.
function $extend(base) {
  $each(__args(), function(map) {
    $each(map, function(value, key) {
      if(key in base) {
        var base_value = base[key];
        if(base_value instanceof Array && value instanceof Array) {
          Array.prototype.push.apply(base_value, value);
        } else if(typeof base_value === 'function' && typeof value === 'function') {
          base[key] = function() { 
            var result = base_value.apply(this, arguments); 
            return value.apply(this, arguments) || result; 
          };
        } else if($is_object(base_value) && $is_object(value)) {
          $extend(base_value, value);
        } else {
          base[key] = value;
        }
      } else base[key] = value;
    });
  });
  return base;
}

// Function: $overlay
// First argument: map to overlay
// Additional arguments: copies them to map, 
// using a for..in loop.
function $overlay(base) {
  $each(__args(), function(map) {
    $each(map, function(value, key) {
      base[key] = value;
    });
  });
  return base;
}

// Function: $override
// Returns an object with data shadowed.
function $override(base) {
  return $overlay.apply(null, [Object.create(base)].concat(__args()));
}

// Function: $constant
// returns a constant function which returns the first argument to $constant
function $constant(x) { return function() { return x; } }

// Function: $identity
// is a function that returns its first argument
function $identity(x) { return x; }

// Function: $access
// $access('.x.y', { x: { y: 10 } }) returns 10, ok?
// access uses the proxy layer (x._('y') instead of x.y)
// because the path is not guaranteed to be valid.
function $access(path, root) {
  if(typeof path === 'function') return path.call(this, root);
  var parts = path.slice(1).split('.');

  if(parts.length == 1 && parts[0] == '') {
    parts = [];
  }

  var last_part = '.';
  if(parts.length == 0) return root;
  $each(parts.slice(0,-1), function(part) {
    if(!(part in root)) root = _(root, part, {});
    else root = _(root, part);
  });
  var final_part = parts.slice(-1)[0];
  if(!root) debugger;
  var value = _(root, final_part);
  if(arguments.length > 2 && root) {
    value = _(root, final_part, setting);
  }
  return value;
}

// Function: $each
// applies action to each element of the list.
// To change the this context of $each, just $each.call(self, ...).
function $each(list, action) {
  if($either(function() { 'length' in list; }).error) debugger;
  if('length' in list) {
    var length = list.length;
    for(var i = 0; i < length; i++) {
      action.call(this, list[i], i);
    }
  } else for(var k in list) {
    action.call(this, list[k], k);
  }
  return list;
}

// Function: $keys
// returns the property names of an object, using for..in.
// other (built-in) options are Object.keys() (only own properties),
// or Object.getOwnPropertyNames() (own properties, including non-enumerable ones).
function $keys(thing) {
  var keys = [];
  for(var k in thing) keys.push(k);
  return keys;
}

// Function: $map
// Like $each, but returns a list/map after being filtered with action.
// throw 'reject' to remove elements from the result set, otherwise expect a map
// with a bunch of undefined.
function $map(list, action) {
  if(typeof action === 'string') {
    action = $access.bind(null, action);
  } else if(typeof action != 'function') {
    action = $identity;
  }
  if('length' in list) {
    var result = [],
        length = list.length;
    for(var i = 0; i < length; i++) {
      try {
        result.push(action.call(this, list[i], i));
      } catch(ex) {
        if(ex !== 'reject') {
          debugger;
          throw ex;
        }
      }
    }
    return result;
  } else {
    var result = {};
    for(var k in list) {
      try {
        result[k] = action.call(this, list[k], k);
      } catch(ex) {
        if(ex !== 'reject') {
          debugger;
          throw ex;
        }
      }
    }
    return result;
  }
}

// Function: $noop.
// Stub function, doesn't do anything.
function $noop() {}

// Function: range
// sort of $map([start...end], fn).
// fn can be omitted, defaults to $identity,
// start can be omitted, defaults to 0.
function $range(start, end, fn) {
  if(typeof end != 'number') { fn = end; end = start; start = 0; }
  if(typeof fn !== 'function') fn = $identity;
  var result = [];
  for(var i = start; i < end; i++) {
    result.push(fn.call(this, i));
  }
  return result;
}

// Function: $build
// Builds a map from a property list of k,v,k,v,k,v... pairs.
// Sub-lists are interpreted as sub-maps.
// Single elements are returned as-is.
// So... $build('a', 'b', 'c', 'd') returns { a: 'b', c: 'd' }. (normal case)
// So... $build('a', ['b']) returns { a: 'b' }. (single element returned as-is)
// So... $build('a', [['b']]) returns { a: ['b'] }. (single element returned as-is)
// So... $build('a', [[['b']]]) returns { a: [['b']] }. (single element returned as-is, got it?)
// So... $build('a', ['b', 'c']) returns { a: { b: 'c' } }. (sub list) 
// but... $build('a', [['b', 'c']]) returns { a: ['b','c'] }.  (single element returned as-is?)
function $build() {
  if(arguments.length == 1) {
    return arguments[0];
  } else {
    var result = {};
    for(var i = 0; i < arguments.length - 1; i += 2) {
      var key = arguments[i];
      var value = arguments[i+1];
      if(value instanceof Array) {
        value = $build.apply(null, value);
      }
      result[key] = value;
    }
    return result;
  }
}

// Function: $either(fn, ...)
// returns { result: ... } or { error: ... }.
function $either(fn) {
  try {
    return { result: fn.apply(this, __args()) };
  } catch(ex) {
    return { error: ex };
  }
}

function $catch(fn) {
  return function() {
    try { return fn.apply(this, arguments); }
    catch(ex) { return ex; }
  };
}

function $list(map, fn) {
  var result = [];
  if(!fn) fn = function(value, key) { return [key,value]; };
  for(var i in map) {
    try {
      result.push(fn.call(this, map[i], i)) 
    } catch(ex) {
      if(ex != 'reject') { 
        debugger;
        throw ex;
      }
    }
  }
  return result;
}

function $deepfreeze(obj) {
  if(undefined == obj) debugger;
  return Object.freeze(Object.create($map(obj, function(property) {
    if($is_object(property)) return $deepfreeze(property);
    return property;
  })));
}

function $copy(obj) {
  return $map(obj, function(property) {
    if($is_object(property)) return $copy(property);
    else return property;
  });
}

function $until(list, fn) {
  for(var key in list) {
    var result = fn.call(this, list[key], key);
    if(result !== undefined) return result;
  }
}

function $profile(name, fn) {
  console.profile(name);
  try {
    return fn.apply(this, __args());
  } finally {
    console.profileEnd();
  }
}


_layer = function(thing, key, value) {
  if(key instanceof Array) {
    for(var i = 0; i < key.length - 1; i++) {
      thing = _(thing, key[i]);
    }
    key = key.slice(-1)[0];
  }

  switch(arguments.length) {
  case 2: return thing._ ? thing._.get(key) : thing[key];
  case 3: return thing._ ? thing._.set(key, value) : thing[key] = value;
  default: throw new Error('oops');
  }
};

new function() {
  var _ = _layer;
  function layer(options) {
    var get = options && options.get || layer.get;
    var set = options && options.set || layer.set;
    var del = options && options.del || layer.del;
    var _ = function(property, value) {
      if(arguments.length == 0) {
        return this;
      } else if(typeof property === 'function') {
        return property.bind.apply(property, [this].concat(__args()));
      } else if(arguments.length == 1) {
        return get.call(this, property);
      } else if(arguments.length == 2) {
        if(value == layer.erase) return del.call(this, property);
        return set.call(this, property, value);
      }
    };
    _.get = get;
    _.set = set;
    return _;
  }

  _.layer = layer;

  layer.noop = function() {};
  layer.del = function(prop) { delete this[prop]; };
  layer.erase = {};

  var super_methods = [];
  var global = (function() { return this; })();

  _.super_ = function() { 
    return super_methods.slice(-1)[0] || layer.noop; 
  }

  layer['get'] = function(property) {
    return this[property];
  };

  layer['set'] = function(property, value) {
    return this[property] = value;
  };

  var klasses = [];

  layer.instantiate = function(klass_proto, proto, base_proto) {
    $each.call(this, proto, function(field, key) {
      if(typeof field !== 'function') {
        klass_proto[key] = field;
      } else {
        var base_field = (base_proto || Object.prototype)[key];
        var method = field; 
        if(typeof base_field === 'function') {
          method = function() {
            try {
              super_methods.push(base_field.bind(this));
              return field.apply(this, arguments);
            } finally {
              super_methods.pop();
            }
          };
        }
        klass_proto[key] = method;
      }
    });
  };

  _.defineClass = function(klass, base, proto) {
    function Class() {
      var self = this;
      if(!(self instanceof klass)) {
        self = Object.create(klass.prototype);
      }
      if(base) base.apply(self, arguments);
      var result = klass.apply(self, arguments);
      if(result && result instanceof Object) return result;
      return self;
    }

    Class._$inherit = function() {
      delete Class._$inherit;
      if(base && base._$inherit) base._$inherit();
      try {
        Class.prototype 
          = klass.prototype 
          = Object.create((base || Object).prototype);
      } catch(ex) {
        debugger;
      }
      klass.prototype.constructor = klass;
      layer.instantiate(klass.prototype, proto, (base || Object).prototype);
      klass.__proto__ = Class;
      //$overlay(klass, Class);
    }

    klasses.push(Class);
    Class.toString = klass.toString.bind(klass);
    return Class;
  };

  _.linkClasses = function() {
    while(klasses.length) {
      var to_link = klasses;
      klasses = [];
      $each(to_link, function(klass) {
        if(klass._$inherit) klass._$inherit();
      });
    }
  };
}();

function $join(thing, how) {
  if(!thing || !(thing instanceof Object)) return thing;
  var mortar = how instanceof Array ? how[0] : how;
  if(thing instanceof Array) {
    var rest = how instanceof Array && how.length > 1 ? how.slice(1) : how;
    return $map(thing, function(value) {
      $join(value, rest);
    }).join(mortar);
  } else {
    var qmortar = how instanceof Array && how.length > 1 ? how[1] : how;
    var rest = how instanceof Array && how.length > 2 ? how.slice(2) : how;
    var serial = [];
    $each(Object.keys(thing), function(key) {
      serial.push(String(key) + mortar + $join(thing[key], rest));
    });
    return serial.join(qmortar);
  }
}

// vim: set sw=2 ts=2 expandtab :
