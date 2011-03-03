jQuery.fn.extend({
	remove: (function(jQuery_fn_remove) {
		return function(selector) {
			jQuery(selector, this).each(function() { if(this.nodeType === 8) jQuery.cleanData([this]); });
			return jQuery_fn_remove.apply(this, arguments);
		};
	})(jQuery.fn.remove)
});
