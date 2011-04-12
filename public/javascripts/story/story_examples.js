Story.Plot.Define('WithStyle', function(selector, style) {
  this.selector = selector;
  this.style = style;
}, {
  setup: function() {
    this.selector = typeof this.selector === 'function' 
      ? this.selector() 
      : jQuery(this.selector);
    this.restore = _.map(this.selector, function(elem) { 
      return elem.getAttribute('style');
    });
    _.each.call(this, this.selector, function(elem) {
      jQuery(elem).css(this.style);
    });
  },
  teardown: function() {
    _.each.call(this, this.selector, function(elem, index) {
      elem.setAttribute('style', this.restore[index]);
    });
  }
});

ButtonExample = new Story({
  setup: function() {
    this.button = jQuery('<button/>').click(Story.callback(function() {
      this.scope.done = true;
    })).text('Hi!').appendTo(jQuery('body'));
  }, 
  teardown: function() { this.button.remove(); }
}, Story.WithStyle('body', { background: 'blue' }), function() {
  return !this.scope.done;
});

Blue3 = new Story(
  Story.WithStyle('body', { background: 'blue' }),
  Story.Delay(3000)
);

TurnTheBackgroundBlueFor3Seconds = new Story({
  setup: function() { 
    var body = jQuery('body');
    this.style = body[0].getAttribute('style');
    body.css('background', 'blue');
  },
  teardown: function() {
    var body = jQuery('body');
    body[0].setAttribute('style', this.style);
  }
}, Story.Delay(3000));
