StateMachine = _.Class(function(init, states, transitions, self) {
  this.states = states;
  this.transitions = transitions;
  this.stack = [init];
  if(!this.states[init]) this.states[init] = {};
  this.self = self || {};
  _.each.call(this, states, function(state) {
    state.transitions = state.transitions || {}; 
  }); 
  _.each.call(this, transitions, function(action, when) {
    _.each.call(this, when.split(','), function(when) {
      var parts = when.split('/');
      var state = parts[0];
      var when = parts[1];
      state = this.states[state] = this.states[state] || {};
      transitions = state.transitions = state.transitions || {};
      transitions[when] = StateMachine.BuildTransition(action);
    });
  });
  if(this.states[init].enter) {
    _.local.call(StateMachine, { instance: this, args: __args() }, function() {
      this.states[init].enter.apply(this.self, StateMachine.args);
    }).call(this);
  }
}, {
  proto: {
    state: function(newstate) {
      if(newstate) {
        this.stack[this.stack.length-1] = newstate;
      }
      return this.stack[this.stack.length-1];
    },
    _send: function() {
      var ev = StateMachine.event;
      var current_state = this.states[this.state()] || { transitions: {} };
      var catch_state = this.states['*'] || { transitions: {} };
      var direct_action = current_state.transitions[ev];
      var state_default = current_state.transitions['*'];
      var catch_action = catch_state.transitions[ev];
      var catch_default = catch_state.transitions['*'];

      var action = direct_action;
      if(!action) {
        if(state_default || catch_action) {
          if(state_default && catch_action) {
            console.warn("StateMachine: transition %o in %o has s/* and */ev options",
              ev, this.state()
            );
          }
          action = state_default || catch_action;
        } else action = catch_default;
      }

      if(action) return action.apply(this.self, StateMachine.args);
    },
    send: function(ev) {
      var args = __args();
      return _.local.call(StateMachine, { 
        instance: this,
        event: ev,
        args: __args() 
      }, function() {
        return this._send();
      }).call(this);
    }
  },
  classic: {
    push: function(state) {
      var sm = StateMachine.instance;
      sm.stack.push(state);
      var current_state = sm.states[sm.state()] || {};
      if(current_state.enter) current_state.enter.apply(sm.self, StateMachine.args);
    },
    pop: function() {
      var sm = StateMachine.instance;
      var current_state = sm.states[sm.state()] || {};
      if(current_state.leave) current_state.leave.apply(sm.self, StateMachine.args);
      sm.stack.pop();
    },
    resend: function() {
      StateMachine.instance._send();
    },
    select: function(state) {
      var sm = StateMachine.instance;
      var current_state = sm.states[sm.state()] || {};
      if(current_state.leave) current_state.leave.apply(sm.self, StateMachine.args);
      sm.state(state);
      current_state = sm.states[state] || {};
      if(current_state.enter) current_state.enter.apply(sm.self, StateMachine.args);
    },
    BuildTransition: function(action) {
      try {
        var transition_source = action;
        if(typeof action == 'string') {
          action = action.split(/;\s*/);
        }
        if(action instanceof Array) {
          return function() {
            _.each(this, function(act) {
              act.apply(StateMachine.instance, StateMachine.args);
            });
          }.bind(_.map(action, function(act) {
            switch(typeof act) {
            case 'string':
              var type = act.slice(0,1);
              act = act.slice(1);
              switch(type) {
              case '!':
                if(act == '') return function() { StateMachine.resend(); };
                else {
                  var args;
                  var valid = false;
                  act = act.replace(/^([^(]*)(\(.*\))?$/, 
                    function(match, event, arg_list) {
                      if(arg_list) {
                        args = JSON.parse(
                          '[' + (arg_list).slice(1,-1) + ']'
                        );
                      }
                      valid = true;
                      return event;
                    }
                  );
                  if(!valid) {
                    throw new Error('StateMachine: transition: invalid event');
                  }
                  return function() { 
                    StateMachine.instance.send.apply(StateMachine.instance, 
                      [_.evil_format(act, { event: StateMachine.event })]
                      .concat(args || StateMachine.args)
                    );
                  };
                }
              case '[':
                return function() { StateMachine.push(_.evil_format(act, { event: StateMachine.event })); };
              case ']':
                return function() { StateMachine.pop(); };
              case '=':
                return function() { StateMachine.select(_.evil_format(act, { event: StateMachine.event })); };
              default:
                throw new Error('Unknown act spec: %o', type+act);
              }
              break;
            case 'function':
              return act;
            case 'object':
              debugger;
              return StateMachine.BuildTransition(act);
            }
          }));
        }
        if(action instanceof Function) return action;
      } catch(ex) {
        console.error('StateMachine: bad transition %o', transition_source); 
      }

      console.warning('StateMachine: weird transition %o', transition_source); 
      return function() { 
        console.warning('StateMachine: runing weird transition %o', transition_source); 
      };
    }
  }
});

jQuery.fn.litijs = function(src) {
  var emit = new StateMachine('file', {
    code: {
      enter: function() {
        this.node = $('<div class="section"/>').appendTo(this.node);
      },
      leave: function() {
        this.node = this.node.parent();
      }
    },
    source: {
      enter: function() {
        this.node = $('<pre class="prettyprint"/>').appendTo(this.node);
      },
      leave: function() {
        this.node = this.node.parent().parent();
      }
    },
    note: {
      enter: function(text, auto) {
        this.node = $('<div class="note"/>').appendTo(this.node).wrap('<div class="wrapper"/>');
        this.remove_one_source_line = !auto;
      },
      leave: function() {
        this.node = this.node.parent();
      }
    },
    title: {
      enter: function() {
        this.node = $('<h1/>').appendTo(this.node);
      },
      leave: function() {
        this.node = this.node.parent();
      }
    },
    space: function() {
    },
    text: {
      enter: function() {
        this.node = $('<p/>').appendTo(this.node);
      },
      leave: function() {
        this.node = this.node.parent();
      }
    },
    example: {
      enter: function() {
        this.example_code = "";
        this.node = $('<pre class="prettyprint"/>').appendTo(this.node);
      },
      leave: function() {
        this.node = this.node.parent();
        try {
          new Function('{' + this.example_code + '}').call($('<div class="nocode"/>').appendTo(this.node));
        } catch(ex) {
          console.log('Failed to eval: %o: %o:%o', this.example_code, ex, ex.stack);
        }
      }
    },
    file: {
      enter: function() {
      },
      leave: function() {
      }
    }
  }, {
    '*/*': '=%{event}; !',
    '*/note': '=code; !',
    'code/note': '[note; !',
    'note/source': ']; [source; !',
    '*/source' : '!note("", true); !',
    'source/*,source/note': ']; !',
    '*/anchor,source/anchor' : function(anchor) {
      this.node.append($('<a/>').attr('name', anchor));
    },
    'note/note': function(note) {
      this.node.appendText(note);
    },
    'source/source': function(source) {
      if(this.remove_one_source_line) {
        var lines = source.split('\n');
        if(!/[^\s]/.test(lines[0])) {
          source = lines.slice(1).join('\n');
        }
        delete this.remove_one_source_line;
      }
      this.node.appendText(source);
    },
    'text/space': function() {
      StateMachine.select('space');
    },
    '*/space': function() {},
    'file/text': function(line) {
      var metadata = this.metadata;
      line.replace(/^\s*(.*)\s*:\s*(.*)\s*$/, function(m,key,value) {
        metadata[key] = value;
        return m;
      });
    },
    'text/text': function(line) {
      var links = [];
      line.replace(/>{([^}|]*)(?:\|([^}]*))?}/g, function(match, anchor, text, index) {
        links.push({index:index, match: match, anchor: anchor, text: text || anchor });
        return match;
      });
      if(links.length == 0) {
        this.node.appendText(line);
      } else {
        this.node.appendText(line.slice(0,links[0].index));
        _.each.call(this, links, function(link, index) {
          $('<a/>').text(link.text).attr('href', '#' + link.anchor).appendTo(this.node);
          if(index < links.length-1) {
            this.node.appendText(line.slice(link.index + link.match.length, link[index+1].index));
          } else {
            this.node.appendText(line.slice(link.index + link.match.length));
          }
        });
      }
    },
    'example/example': function(line) {
      if(line.slice(0,1) == '!') {
        line = line.slice(1);
      } else {
        this.node.appendText(line);
        this.node.append($('<br/>'));
      }
      this.example_code += line;
    },
    'title/title': function(title) {
      this.node.appendText(title);
    }
  }, { 
    metadata : {},
    node: 
      $('<div class="litijs">')
      .appendTo(
        $('<div class="litijs-container"/>')
        .appendTo(this)
      ) 
  });
  if(!src) src = '/javascripts/story/story_core.js';
  jQuery.ajax({
    url:src, 
    success:function(result, status) {
      if(status == 'success') {
        var parsed = jQuery.fn.litijs.parse(result);
        _.each.call(this, parsed, function(part) {
          emit.send(part.type, part.text);
        });
        emit.send("text", "");
        //alert(JSON.stringify(emit.self.metadata));
        prettyPrint(); 
      }
    }, 
    dataType: 'html'
  });
};
jQuery.fn.litijs.parse = function(source) {
  var fn = jQuery.fn.litijs;
  var result = [];
  source.replace(/(?:\s*\/\/\/(.*))|(\/\*(?:[^*]|\*[^\/])*\*\/)|(?:([^\/]|\/(?:[^*\/]|\/[^\/]))*([^\/\s]|\/(?:[^*\/\s]|\/[^\/\s]))+)/g, function(match, linecomment, comment, source) {
    if(!match || !/[^\s]/.test(match)) {
      return "";
    } else if(source) {
      return result.push({type:'source', text: match});
    } else if(linecomment) {
      var anchors = [];
      linecomment.replace(/@{([^}|]*)(?:\|([^}]*))?}/g, function(match, anchor, text, index) {
        anchors.push({index:index, match: match, anchor: anchor, text: text || anchor});
        return match;
      });
      var note = linecomment;
      if(anchors.length != 0) {
        note = linecomment.slice(0,anchors[0].index);
        _.each.call(this, anchors, function(anchor, index) {
          note += anchor.text;
          if(index < anchors.length-1) {
            note += linecomment.slice(anchor.index + anchor.match.length, anchor[index+1].index);
          } else {
            note += linecomment.slice(anchor.index + anchor.match.length);
          }
          result.push({type:'anchor', text:anchor.anchor});
        });
      }
      result.push({type:'note', text:note});
    } else if(comment) {
      var lines = comment.split("\n");
      var html = $('<div/>');
      _.each(lines, function(line) {
        var header = line.slice(0,2);
        line = line.slice(2);
        switch(header) {
        case '--': 
          return result.push({type: 'title', text:line});
        case ' |':
          if(!/[^\s]/.test(line)) {
            return result.push({type: 'space', text:line});
          }
          return result.push({type: 'text', text:line});
        case ' >':
          return result.push({type: 'example', text:line});
        }
      });
    }
    return '{{{' + match + '}}}';
  });
  return result;
}
    
// vim: set sw=2 ts=2 expandtab :
