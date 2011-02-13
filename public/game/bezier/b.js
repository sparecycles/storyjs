var bezier = undefined

function Bezier($where, size, points) {
	$where.attr({width:size, height:size})
	var canvas = $where[0]
	var ctx = this.ctx = canvas.getContext('2d')
	this.size = size
	this.path = []
	this.points = points.slice()
	$.each(this.points, function(i,v) { 
		v[0] *= size
		v[1] *= size
	})
	this.init()
	
}

function hsv(hue, saturation, value) {
	hue *= 2*Math.PI
	var d = [Math.cos(hue), Math.sin(hue)]
	var rgb = [d[0], d[0]*-.5 + d[1]*0.866, d[0]*-.5 + d[1]*-0.866]
	$.each(rgb, function(i,v) { rgb[i] = v*saturation + (1-saturation) })
	$.each(rgb, function(i,v) { rgb[i] = v < 0 ? 0 : v*value*256 })
	return 'rgb(' +
		Math.floor(rgb[0]) + ',' + 
		Math.floor(rgb[1]) + ',' + 
		Math.floor(rgb[2]) + ')'
}

function interp(a,b,t) { return a*t + b*(1-t) }

$.extend(Bezier.prototype, {
	plot: function(t) {
		var ctx = this.ctx
		var lines = this.points
		ctx.clearRect(0, 0, this.size, this.size)
		ctx.strokeStyle = 'rgb(128, 128, 128)'
		ctx.save()
		ctx.lineWidth = 3
		while(lines.length > 1)
		{
			ctx.beginPath()
			$.each(lines, function(i,v) { ctx.lineTo(v[0], v[1]) })
			ctx.stroke()
			ctx.strokeStyle = hsv(lines.length/this.points.length, .5, 1)
			var next = []
			for(var i = 0; i < lines.length-1; i++) {
				next.push([
					interp(lines[i][0], lines[i+1][0], t),
					interp(lines[i][1], lines[i+1][1], t)])
			}
			lines = next
		}
		ctx.restore()
		
		this.path.push(lines[0])
		ctx.strokeStyle = hsv(t, 1, 1)//'rgb(255, 0, 0)'
		ctx.lineWidth = 5
		ctx.beginPath()
		$.each(this.path, function(i,v) { ctx.lineTo(v[0], v[1]) })
		ctx.stroke()
	},
	reset: function() {
		this.path = []
	},
	init: function() {
		setInterval(new function(bezier, step) { var t = 0; return function() { 
			t += step
			if(t - step < 1)
				bezier.plot(t > 1 ? 1 : t)
			if(t > 2) {
				bezier.reset()
				t = 0
			}
		} } (this, 0.001), 1000/60)
	}
})


$(function() {
	bezier = new Bezier($('#bezier'), 500, [
			[0,0],
			[1,0],
			[1,1],
			[.75,.25],
			[.5,.5],
			[.25,.25],
			//[0,1],
			null].slice(0,-1))
})

