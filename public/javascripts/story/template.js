Template = _layer.defineClass(function Template(self, action) {
  var args = __args();

  this.nodes = [];
  this.destructors = [];
  this.placeholders = [];
  this.children = [];
  this.inserted = [];
  this.mvc = Template.render_context().mvc;
  var template_context = $overlay({}, Template.context());
  template_context.render_context = this;
  //Object.freeze(template_context);

  if(action) this.action = function() {
    this.context = Object.create(template_context);
    this.context.map = Object.create(template_context.map);
    return action.apply(self, args);
  };

  return this.render();
}, null, {
  clear: function() {
    $each.call(this, this.destructors, function(destructor) {
      destructor.call(this, this.self);
    });
    $each(this.children, function(child) {
      child.clear();
    });
    $each(this.placeholders, function(placeholder) {
      placeholder.data('node').insertBefore(placeholder);
      placeholder.remove();
    });
    $each(this.inserted, function(node) {
      node.remove();
    });
    this.nodes = [];
    this.inserted = [];
    this.destructors = [];
    this.placeholders = [];
    this.children = [];
    this.mvc.clear(this.mvc_listener_id);
  },
  update: function() {
    this.clear();
    return this.render();
  },
  render: function() {
    this.parent = Template.render_context();
    if(this.parent) this.parent.children.push(this);

    var scope;
    try {
      Template.render_context_stack.push(this);
      Template.render_context().mvc.save_access_scope();
      return this.action();
    } catch(ex) {
      console.log('error rendering: %o', ex.stack);
      debugger;
    } finally {
      scope = Template.render_context().mvc.restore_access_scope();
      this.mvc_listener_id = Template.render_context().mvc.register(this, scope);
      Template.render_context_stack.pop();
    }
  }
});

Template.RootRenderContext = function(mvc, map) {
  var self = Object.create(Template.prototype);
  self.children = [];
  self.mvc = mvc;
  self.nodes = [];
  self.context = {
    data: mvc.data,
    map: map,
    scope: {} 
  };
  return self;
};

Template.opt = function(self, action) {
  // Tuneable space v.s. size tradeoffs =)
  if(false && Template.render_context_stack > 16) {
    action.apply(self, __args());
  } else {
    Template.apply(null, arguments);
  }
};

Template.inserted = function(node) {
  Template.render_context().inserted.push(node);
  Template.render_context().nodes.push(node);
  return node;
};

Template.teardown = function(teardown) {
  Template.render_context().destructors.push(teardown);
};

Template.remove = function(node, name) {
  var placeholder = $('<!-- ' + (name||'template') + ' placeholder --"/>')
    .insertAfter(node);
  $each(Template.render_context_stack, function(rcontext) {
    rcontext.nodes = $map(rcontext.nodes, function(remembered) {
      if(remembered[0] === node[0]) throw 'reject';
      return remembered;
    });
  });
  Template.render_context().placeholders.push(placeholder);
  placeholder.data('node', node);
  node.detach();
  return placeholder;
};

Template.render_context_stack = [];

Template.render_context = function() {
  return Template.render_context_stack.slice(-1)[0];
}

Template.context = function() { return Template.render_context().context; }

Template.scope = function(scope) {
  var context = Template.context();
  if(arguments.length == 0) return context.scope;
  else {
    if(Object.hasOwnProperty.call(context, 'scope')) {
      $overlay(context.scope, scope);
    } else {
      context.scope = $override(context.scope, scope);
    }
  }
};

Template.access = function(path) {
  var navigation = Template.navigate(path);
  if(typeof navigation != 'function') {
    console.warn('could not follow path:', path);
    debugger;
    return;
  }
  return navigation();
};

Template.navigate = new function(primitive) { return function(path) {
  var context = Template.context();

  while(typeof path === 'string' && path.slice(0,3) == '...') {
    context = context.parent;
    path = context.map[path];
  }

  if(!path) return undefined;

  if(typeof path === 'function') {
    return path.call(context.render_context.self);
  }

  if(path === '.') {
    return Template.context().data;
  }

  // "a[b[c]][d[e].f].g].h" -->
  // ['a', [ 'b', ['c'], [ 'd', [ 'e' ], '.f' ], '.g' ], '.h' ]
  // 
  // split '[' -->
  // 'a', 'b', 'c]', 'd', 'e].f].g].h'
  // each... split ']' with stack up/down navigation -->
  // ['a', [ 'b', ['c'], [ 'd', [ 'e' ], '.f' ], '.g' ], '.h' ]
  var tree = [];
  $each.call([], path.split('['), function(left_part) {
    var chain = left_part.split(']'),
        subtree = [chain[0]];
    tree.push(subtree); this.push(tree); tree = subtree;
    $each.call(this, chain.slice(1), function(right_part) {
      tree = this.pop();
      if(right_part.length) tree.push.apply(tree, right_part);
    });
  });

  return (function $eval() {
    var base = primitive(this[0], context);
    $each(this.slice(1), function(part) {
      if(part instanceof Array) {
        base = base($eval.call(part)());
      } else {
        console.log('base = base("' + part + '")');
        base = base(part);
      }
    });
    return base;
  }).call(tree);
} }(function primitive(path, context) {
  if(path[0] == '.') {
    return context.data(path.slice(1));
  } else if(path[0] == '=') {
    return MVC.constant(path.slice(1));
  } else {
    return context.scope[path];
  }
});

Template.coalesce = function() {
  return (function(args) { 
    return function() { 
      for(var k in args) {
        var navigation = Template.navigate(args[k]);
        if(navigation && navigation() !== undefined) return navigation;
      }
    } 
  })(__args());
}

Template.render = function() {
  Template.render_context().self = this;
  Template.render_context().nodes.push(this);

  if(Template.context().map.$each) {
    var _each = Template.context().map.$each;
    Template.context().map.$each = undefined;
    var key = $keys(_each)[0];
    
    Template.opt(this, function() {
      var list = Template.navigate(_each[key]);
      if(typeof list != 'function' || typeof list('length') != 'function') {
        debugger;
        list = Template.navigate(_each[key]);
      }
      if(list) $range.call(this, 0, list('length')(), function(index) {
        var clone = Template.inserted(this.clone().insertBefore(this));
        Template(this, function() {
          Template.scope($build(key, [list(index)], key + '-index', [MVC.constant(index)]));
          Template.render.call(clone);
        });
      });
      Template.remove(this, 'list');
    });

    return;
  }

  if(Template.context().map.$for) {
    var $for = Template.context().map.$for;
    Template.context().map.$for = undefined;
    
    Template.opt(this, function() {
      var list = Template.navigate($for);
      if(list) $range.call(this, 0, list('length')(), function(index) {
        Template(this, function() {
          Template.context().data = list(index)();
          Template.render.call(
            Template.inserted(this.clone().insertBefore(this))
          );
        });
      });
      Template.remove(this, 'list');
    });
    return;
  }

  if(Template.context().map.$let) {
    var $let = Template.context().map.$let;
    Template.context().map.$let = undefined;
    (function evaluate_let_bindings($let) {
      if($let instanceof Array) {
        $each.call(this, $let, evaluate_let_bindings);
      } else {
        $each($let, function(value, key) {
          Template.scope($build(key, [Template.navigate(value)]));
        });
      }
    }).call(this, $let);
  }

  if(Template.context().map.$in) {
    if(typeof Template.context().map.$in === 'function') {
      Template.context().data = Template.context().map.$in.call(this);
      if(typeof Template.context().data != 'function') debugger;
    } else {
      Template.context().data = Template.navigate(Template.context().map.$in);
    }
    Template.context().map.$in = undefined;
  }

  if(Template.context().map.$template) {
    var $template = Template.access(Template.context().map.$template);
    Template.context().map.$template = undefined;
    var content_map = {};
    $each(Template.context().map, function(value, key) {
      if(value && value.$as) {
        var $as = value.$as;
        content_map[$as] = $overlay(content_map[$as] || {}, $build(
          key,
          [$map($override(value, { $as: undefined }), function(x) {
            if(x === undefined) throw 'reject'; return x;
          })]
        ));
      }
    });
    Template.context().map.$contents = $deepfreeze(content_map);
    Template.context().map.$partial = this;
    var template_fn = Template.definedTemplates[$template];
    Template.opt(this, function() {
      var node = template_fn().insertBefore(this);
      Template.inserted(node);
    });
    Template.remove(this, 'template(' + $template + ')');
    return;
  }

  if(Template.context().map.$setup) {
    var $setup = Template.context().map.$setup;
    Template.context().map.$setup = undefined;

    Template(this, function() {
      if(typeof $setup === 'string') {
        $setup = Template.access($setup);
      }
      Template.render.call(this);
      if(typeof $setup === 'function') {
        $setup.call(this);
      }
    });
    return;
  }

  $each.call(this, Template.context().map, function(value, key) { Template(this, function() {
    if(key[0] == '$') return;
    var map_index = 0;
    if(Number(value) == value) value = Number(value);
    var context = Template.context();
    while(typeof value == 'string') {
      if(value[0] == '%') {
        var content_selector = $();
        for( ; context; context = context.parent) {
          var map = context.map;
          if(!map.$partial || !map.$contents) continue;
          var contents_for = (map.$contents || {})[value.slice(1)] || {},
              content_rules = [],
              $partial = map.$partial;

          $each.call($partial, contents_for, function(value, key) {
            var content = this.find(key);
            content_selector = content_selector.add(
              content.clone().data('template', {
                map: value, 
                data: Template.context().data
              })
            );
            Template.remove(content, 'content_for ' + key);
          });
        }
        var target = this.find(key);
        if(content_selector.length > 0 && target.length > 0) {
          Template.inserted(content_selector.appendTo(target).each(function() {
            Template(this, function() {
              var template = $(this).data('template');
              Template.context().map = Object.create(template.map);
              Template.context().data = template.data;
              Template.render.call($(this));
            });
          }));
        }
        return;
      } else break;
    }
    if(!value && typeof value !== 'number') return;

    Template.opt(this, function() {
      if(/@/.test(key)) {
        var split = key.split(/@/);
        var selector = split[0] == '' ? this : $(split[0], this);
        var attr = split[1];
        if(attr.substr(0,2) == 'on') {
          if(typeof value === 'function') {
            Template.opt(this, function() {
              var param = {
                data: Template.context().data,
                map: Template.context().map,
                scope: Template.scope(),
              };
              selector.bind(attr.slice(2), function() { 
                return value.apply(this, __args().concat([param])); 
              });
            });
          } else if(typeof value === 'string') {
            selector.bind(attr.slice(2), Template.access(value));
          }
        } else switch(attr.toLowerCase()) {
        case 'text':
          selector.text(Template.access(value));
          break;
        case 'html':
          selector.html(Template.access(value));
          break;
        case 'style':
          var style = value;
          if(typeof value === 'string') {
            style = Template.access(value);
          }

          if(!$is_primitive(style)) {
            var result = [];
            $list(style, function(value, key) {
              value = Template.access(value);
              if(!value) throw 'reject';
              value = $map(String(value).trim().split(/\s+/), function(part) {
                if(String(Number(part)) === part) {
                  return String(Number(part)) + ($until([
                    [/^left$|^right$|^top$|^bottom$/, 'px'],
                    [/^margin|^padding|^border/, 'px'],
                    [/^width$|^height$/, 'px'],
                    [/^min-|^max-/, 'px'],
                    [/^line-height$|^font-size$|^text-indent$/, 'pt'],
                  ], function(ending) {
                    if(ending[0].test(key)) {
                      return ending[1];
                    }
                  }) || '');
                }
                return part;
              }).join(' ');
              // there's plenty of special handling we could do here to get maximum cross-compatibility 
              // between browsers, for now, just stick -moz- (firefox), -webkit- (chrome/safari), and -o- (opera) prefixes on
              // the styles so non-up-to-date browsers will see the new (now standardized) style attributes.
              if(/^box-shadow|^border-.*radius|^transform|^transition/.test(key)) {
                result.push('-moz-' + key + ': ' + value);
                result.push('-webkit-' + key + ': ' + value);
                result.push('-o-' + key + ': ' + value);
              }
              result.push(key + ': ' + value);
            });
            style = result.join(';\n');
          }
          var base = (selector.attr('style') || '').trim();
          selector.attr(key.slice(1), base ? base + ';' + style : style);
          break;
        default:
          selector.attr(key.slice(1), Template.access(value));
        }
        return;
      }
      if(typeof value === 'function') {
        Template.opt(this, function() {
          var selector = key == '.' ? this : this.find(key);
          var result = value.call(selector);
          if(result) selector.text(result());
        });
      } else if(typeof value === 'string') {
        Template.opt(this, function() {
          if(key === '.') this.text(Template.access(value));
          else this.find(key).text(Template.access(value));
        });
      } else {
        this.find(key).each(function() {
          Template(this, function() {
            Template.context().map = Object.create(value);
            Template.render.call($(this));
          });
        });
      }
    });
  });});
}

Template.definedTemplates = {};

jQuery.fn.defineTemplate = function(name, map) {
  var src = this.detach();
  src.attr('id', null); // clear id attribute, probably the selector.
  Template.definedTemplates[name] = function() {
    var clone = src.clone(),
        parent = Object.create(Template.context());
    Template(this, function() {
      Template.context().parent = parent;
      Template.context().map = Object.create(map);
      Template.render.call(clone);
    });
    return clone;
  }
};

jQuery.fn.template = function(mvc, map) {
  Template.render_context_stack.push(
    new Template.RootRenderContext(mvc, $deepfreeze(map || {}))
  );
  try {
    Template(this, function() {
      this.each(function() {
        Template.render.call($(this));
      });
    });
  } finally {
    return Template.render_context_stack.pop();
  }
}

// vim: set sw=2 ts=2 expandtab :
