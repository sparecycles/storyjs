Template = _.Class({
  init: function(self, action) {
    var args = __args();

    this.destructors = [];
    this.placeholders = [];
    this.children = [];
    this.inserted = [];
    this.mvc = Template.render_context.mvc;
    var template_context = _.overlay({}, Template.context());
    template_context.render_context = this;

    if(action) this.action = function() {
      this.context = Object.create(template_context);
      this.context.map = Object.create(template_context.map);
      return action.apply(self, args);
    };

    return this.render();
  },
  proto: {
    clear: function() {
      _.each(this.children, function(child) {
        child.clear();
      });
      _.each(this.placeholders, function(placeholder) {
        var placeholder_node = placeholder.data('node');
        placeholder.data('node', 0);
        if(placeholder_node) {
          placeholder_node.insertBefore(placeholder);
          //if(placeholder_node.closest('html').length == 0) {
          //  placeholder_node.remove();
          //}
          placeholder.remove();
        } else { debugger; }
      });
      _.each.call(this, this.destructors, function(destructor) {
        destructor.call(this, this.self);
      });
      _.each(this.inserted, function(node) {
        node.remove();
      });
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
      this.parent = Template.render_context;
      if(this.parent) this.parent.children.push(this);

      return _.local.call(Template, {render_context: this}, function() {
        try {
          Template.render_context.mvc.save_access_scope();
          return this.action();
        } catch(ex) {
          console.warn('error rendering: %o', ex.stack);
        } finally {
          var scope = Template.render_context.mvc.restore_access_scope();
          try {
            this.mvc_listener_id = Template.render_context.mvc.register(this, scope);
          } catch(ex) {
            alert(ex.message);
          }
        }
      }).call(this);
    }
  },
  classic: {
    definedTemplates: {},
    RootRenderContext: function(mvc, map) {
      var self = Object.create(Template.prototype);
      self.children = [];
      self.mvc = mvc;
      self.destructors = [];
      self.placeholders = [];
      self.inserted = [];
      self.context = {
        data: mvc.data,
        map: map,
        scope: { '#context': mvc.data } 
      };
      return self;
    },
    opt: function(self, action) {
      // Tuneable space v.s. size tradeoffs =)
      if(false) {
        action.apply(self, __args());
      } else {
        Template.apply(null, arguments);
      }
    },
    inserted: function(node) {
      var rc = Template.render_context;
      rc.inserted.push(node);
      return node;
    },
    teardown: function(teardown) {
      Template.render_context.destructors.push(teardown);
    },
    css: function(elem, style) {
      $(elem).each(function() {
        Template.teardown.call(this, function(css) {
          $(this).css(css);
        }, _.map.call($(this), style, function(v, key) {
          return this.css(key);
        }));

        $(this).css(style);
      });
    },
    remove: function(node, name) {
      var placeholder = Template.inserted($(document.createComment((name||'template') + ' placeholder')).insertAfter(node));
      Template.render_context.placeholders.push(placeholder);
      placeholder.data('node', node);
      node.detach();
      return placeholder;
    },
    render_context: null,
    render_or_action_context: function() {
      return Template.render_context || Template.action_context;
    },
    context: function() { 
      return Template.render_or_action_context().context; 
    },
    callback: function(fn) {
      var context = Template.render_or_action_context();
      var args = __args();
      return _.local.call(Template, { action_context: {
        self: context.self,
        mvc: context.mvc,
        context: {
          scope: context.context.scope,
          map: context.context.map,
          data: context.context.data
        }
      } }, function() { return fn.apply(this, args.concat(__args())); });
    },
    scope: function(scope) {
      var context = Template.context();
      if(arguments.length == 0) return context.scope;
      else {
        if(Object.hasOwnProperty.call(context, 'scope')) {
          _.overlay(context.scope, scope);
        } else {
          context.scope = _.override(context.scope, scope);
        }
      }
    },
    access: function(path) {
      var navigation = Template.navigate(path);
      if(typeof navigation != 'function') {
        if(navigation === undefined) {
          console.warn('could not follow path:', path);
          debugger;
        }
        return navigation;
      }
      return navigation();
    },
    navigate: function(path) {
      var navi = Template.navigate_(path, Template.context());
      return navi[0](navi[1]);
    },
    update: function(path, value) {
      var navi = Template.navigate_(path, Template.context());
      if(arguments.length > 1) {
        return navi[0](navi[1], value);
      } else {
        return navi[0](navi[1], navi[0](navi[1])());
      }
    },
    navigate_: function(path, context) {
      while(typeof path === 'string' && path.slice(0,3) == '...') {
        context = context.parent;
        path = context.map[path];
      }

      if(!path) return undefined;

      if(typeof path === 'function') {
        return [ function() { return path.call(context.render_context.self); }, null ];
      }

      if(path === '.') {
        path = '#context';
      }

      // "a.x[b[c]][d[e].f.g].h]" -->
      // ['a', [ 'b', ['c'], [ 'd', [ 'e' ], '.f.g' ], '.h' ] ]
      // 
      // split '[' -->
      // 'a.x', 'b', 'c]', 'd', 'e].f.g].h]'
      // each... split ']' with stack up/down navigation -->
      // ['a', 'x', [ 'b', ['c'], [ 'd', [ 'e' ], 'f', 'g' ], 'h' ] ]
      var tree = [];
      _.each.call([], path.split('['), function(left_part) {
        var chain = left_part.split(']'),
            part0 = chain[0].slice(0,1) == '.' 
              ? '#context' + chain[0] 
              : chain[0],
            subtree = part0.slice(0,1) == '=' ? [part0] : part0.split('.');
        tree.push(subtree); this.push(tree); tree = subtree;
        _.each.call(this, chain.slice(1), function(right_part) {
          tree = this.pop();
          if(right_part.length) { 
            if(right_part.slice(0,1) != '.') debugger;
            tree.push.apply(tree, right_part.slice(1).split('.'));
          }
        });
      });

      return [
        _eval(tree.slice(0,-1)),
        _eval_part(tree.slice(-1)[0])
      ];

      function primitive(path) {
        if(path.slice(0,1) == '.') {
          return context.data(path.slice(1));
        } else if(path.slice(0,1) == '=') {
          return MVC.constant(Template.expand(path.slice(1)));
        } else {
          //return context.scope[path];
          var first_part = path.split('.', 1)[0];
          var rest = path.slice(first_part.length + 1);
          var navigation = context.scope[first_part];
          if(navigation && rest.length) navigation = navigation(rest);
          return navigation;
        }
      };

      function _eval_part(part) {
        if(part instanceof Array) {
          return _eval(part)();
        } else {
          return part;
        }
      }

      function _eval(tree) {
        if(tree.length == 0) return primitive;
        var base = primitive(tree[0]);
        _.each(tree.slice(1), function(part) {
          var evaluated = _eval_part(part);
          base = base(evaluated);
        });
        return base;
      }
    },
    coalesce: function() {
      return (function(args) { 
        return function() { 
          for(var k in args) {
            var navigation = Template.navigate(args[k]);
            if(navigation && navigation() !== undefined) return navigation;
          }
        } 
      })(__args());
    },
    render: function() {
      Template.render_context.self = this;

      if(Template.context().map.$each) {
        var $each = Template.context().map.$each;
        var key = _.keys($each)[0];
        var value = $each[key];

        Template.context().map.$each = undefined;
        
        Template(this, function() {
          var list = Template.navigate(value);
          if(typeof list != 'function' || typeof list('length') != 'function') {
            console.warn('Invalid list found in model for', value);
            debugger; // and do it again so we can step through it!
            list = Template.navigate(value);
            debugger;
          }
          if(list) _.range.call(this, 0, list('length')(), function(index) {
            var $this = $(this);
            var clone = $(Template.inserted($this.clone().insertBefore($this)));
            Template(this, function() {
              Template.scope(_.build(key, [list(index)], key + '-index', [MVC.constant(index)]));
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
          if(list) _.range.call(this, 0, list('length')(), function(index) {
            Template(this, function() {
              var $this = $(this);
              Template.context().data = list(index)();
              Template.scope({'#context': Template.context().data});
              Template.render.call(
                Template.inserted($this.clone().insertBefore($this))
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
            _.each.call(this, $let, evaluate_let_bindings);
          } else {
            _.each.call(this, $let, function(value, key) {
              return Template.scope(_.build(key, [Template.navigate(value)]));
            });
          }
        }).call(this, $let);
      }

      if(Template.context().map.$in) {
        if(typeof Template.context().map.$in === 'function') {
          Template.context().data = Template.context().map.$in.call(this);
          Template.scope({'#context': Template.context().data});
          if(typeof Template.context().data != 'function') debugger;
        } else {
          Template.context().data = Template.navigate(Template.context().map.$in);
          Template.scope({'#context': Template.context().data});
        }
        Template.context().map.$in = undefined;
      }

      if(Template.context().map.$template) {
        var $template = Template.access(Template.context().map.$template);
        Template.context().map.$template = undefined;
        var content_map = {};
        _.each(Template.context().map, function(value, key) {
          if(value && value.$as) {
            var $as = value.$as;
            content_map[$as] = _.overlay(content_map[$as] || {}, _.build(
              key,
              [_.map(_.override(value, { $as: undefined }), function(x) {
                if(x === undefined) throw 'reject'; return x;
              })]
            ));
          }
        });
        Template.context().map.$contents = _.deepfreeze(content_map);
        Template.context().map.$partial = this;
        Template.context().map.$as_context = Template.context();
        var template_fn = Template.definedTemplates[$template];
        Template.opt(this, function() {
          template_fn.call(this);
        });
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

      _.each.call(this, Template.context().map, function(value, key) { Template(this, function() {
        if(key.slice(0,1) == '$') return;
        var map_index = 0;
        if(Number(value) == value) value = Number(value);
        var context = Template.context();
        while(typeof value == 'string') {
          if(value.slice(0,1) == '%') {
            var content_selector = $();
            for( ; context; context = context.parent) {
              var map = context.map;
              if(!map.$partial || !map.$contents) continue;
              var contents_for = map.$contents[value.slice(1)],
                  $partial = map.$partial;

              _.each.call($partial, contents_for || {}, function(value, key) {
                var content = $(this).find(key);
                content_selector = content_selector.add(
                  content.clone().data('template', {
                    map: value, 
                    data: map.$as_context.data
                  })
                );
                Template.remove(content, 'content_for ' + key);
              });
            }
            var target = $(this).find(key);
            if(content_selector.length > 0 && target.length > 0) {
              Template.inserted(content_selector.appendTo(target).each(function() {
                Template(this, function() {
                  var template = $(this).data('template');
                  Template.context().map = Object.create(template.map);
                  Template.context().data = template.data;
                  Template.scope({'#context': Template.context().data});
                  Template.render.call($(this));
                });
              }));
            }
            return;
          } else break;
        }
        if(!value && typeof value !== 'number') return;

        Template.opt(this, function() {
          var at_index = key.indexOf('@');
          if(at_index != -1) {
            var split = [key.slice(0,at_index), key.slice(at_index+1)];
            var selector = split[0] == '' ? this : $(split[0], this);
            var attr = split[1];
            if(attr.slice(0,2) == 'on') {
              var event_type = attr.slice(2),
                  action;
              if(typeof value === 'function') {
                var param = {
                  data: Template.context().data,
                  map: Template.context().map,
                  scope: Template.scope()
                };
                action = Template.callback(value);
              } else if(typeof value === 'string') {
                action = Template.callback(Template.access(value));
              }
              selector.bind(event_type, action);
              Template.teardown(function() { 
                selector.unbind(event_type, action);
              });
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

              if(!_.is_primitive(style)) {
                var result = [];
                function enumerate(style) {
                  if(style instanceof Array) {
                    _.each(style, enumerate);
                  } else {
                    _.each(style, function(value, key) {
                      value = Template.access(value);
                      if(value === undefined || value === null) return;
                      var values = String(value).replace(/^\s+/, '').replace(/\s*$/, '').split(/\s+/);
                      value = _.map(values, function(part) {
                        if(String(Number(part)) === part) {
                          return String(Number(part)) + (_.until([
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
                  }
                };
                enumerate(style);
                style = result.join(';\n');
              }
              var base = (selector.attr('style') || '');
              selector.attr(attr, base ? base + ';' + style : style);
              Template.teardown(function() { selector.attr(attr, base); });
              break;
            default:
              selector.attr(key.slice(1), Template.access(value));
            }
            return;
          }
          if(typeof value === 'function') {
            Template.opt(this, function() {
              var selector = (key == '.' ? $(this) : $(this).find(key));
              var result = value.call(selector);
              if(result) selector.text(result);
            });
          } else if(typeof value === 'string') {
            Template.opt(this, function() {
              (key == '.' ? $(this) : $(this).find(key)).text(Template.access(value));
            });
          } else {
            (key == '.' ? $(this) : $(this).find(key)).each(function() {
              Template(this, function() {
                Template.context().map = Object.create(value);
                Template.render.call($(this));
              });
            });
          }
        });
      });});
    },
    expand: function(x) {
      /* balancing brace for silly vim: { */ 
      var result = x.replace(/%{([^}]*)}/g, function(match, key) {
        return Template.access(key);
      });
      return result;
    }
  }
});


jQuery.fn.defineTemplate = function(name, map) {
  var src = this.detach();
  if(this.length != 1) {
    console.warn('Bad defineTemplate("' + name + '"), selector.length != 1');
    debugger;
  }
  src.attr('id', null); // clear id attribute, probably the selector.
  Template.definedTemplates[name] = function() {
    var parent = Object.create(Template.context());
    Template(this, function() {
      Template.context().parent = parent;
      Template.context().map = Object.create(map);
      var clone = Template.inserted(src.clone().insertAfter(this));

      Template.render.call(clone);

      if(parent.map.$setup) {
        parent.map.$setup.call(clone);
      }

      Template.remove(this, 'template(' + name + ')');
    });
  }
};

jQuery.fn.clearTemplate = function() {
  return this.each(function() {
    jQuery.clearTemplate(this);
  });
}

jQuery.fn.template = function(mvc, map) {
   if(arguments.length == 1 && arguments[0] === false) {
     return this.clearTemplate();
   }

  if(this.length != 1) {
    console.warn('template rendering on a non-singular node!');
    debugger;
  }
  return this.each(function() {
    jQuery.template(this, mvc, map);
  });
}

jQuery.clearTemplate = function(elem) {
  var data = $(elem).data();
  var template_context = data.template_context;
  if(template_context) {
    template_context.clear();
    delete data.template_context;
  }
}

jQuery.template = function(node, mvc, map) {
  var $node = $(node);
  var old_context = $node.data('template_context');
  if(old_context) { old_context.clear(); }
  var root_context = 
    new Template.RootRenderContext(mvc, _.deepfreeze(map || {}))
  $node.data('template_context', root_context);
  _.local.call(Template, { render_context: root_context }, function() {
    Template(node, function() {
      Template.render.call(this);
    });
  }).call(this);
}


// vim: set sw=2 ts=2 expandtab :
