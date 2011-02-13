function Chain($where, size, count) {
	$where.attr({width:size, height:size})
	var canvas = $where[0]
	this.count = count
	this.angle = 0

	var point = [Math.cos(2*Math.PI/this.count)-1, Math.sin(2*Math.PI/this.count)-0]
	this.ring_radius = Math.sqrt(point[0]*point[0] + point[1]*point[1])/2

	var scale = this.scale = (size - 30)/((this.ring_radius+1)*2)

	var ctx = this.ctx = canvas.getContext('2d')
	ctx.scale(size, size)
	ctx.translate(.5,.5)
	ctx.scale(scale/size, scale/size)
	
	setInterval(new function(chain, x, dir) { var ia = 0; return function() { 
		x += dir
		ia -= 0.02
		if(x > 1 || x < 0) dir = -dir 
		chain.inversion = new Inversion(0.5*Math.cos(ia), 0.5*Math.sin(ia), 1, new Inversion((0.25 + x)*Math.cos(ia), (0.25 + x)*Math.sin(ia), 1))
		chain.draw() 
		chain.angle += 0.03
	} } (this, 0, 0.005), 1000/60)
}

function Inversion(x0,y0,k,next) {
	this.x0 = x0
	this.y0 = y0
	this.k = k
	this.k2 = k*k
	this.next = next
}
	
$.extend(Inversion.prototype, { 
	apply: function(x,y,r) {
		var x0 = this.x0
		var y0 = this.y0
		var s = this.k2/((x-x0)*(x-x0) + (y-y0)*(y-y0) - r*r)

		var result = [
			x0 + s*(x - x0),
			y0 + s*(y - y0),
			r*Math.abs(s) ]
		return this.next ? this.next.apply.apply(this.next, result) : result
	}
})

$.extend(Chain.prototype, {
	drawCircle: function(x,y,r) {
		var ctx = this.ctx

		var t = this.inversion.apply(x,y,r)
		x = t[0]
		y = t[1]
		r = t[2]
		
		ctx.beginPath()
		ctx.arc(x, y, r, 0, 1, true)
		ctx.arc(x, y, r, 1, 0, true)
		ctx.stroke()
	},
	// Function: Draw
	// Draws a grid, and all the snakes, and the player
	draw: function(ctx)  {
		var ring_radius = this.ring_radius
		if(!ctx) ctx = this.ctx
		ctx.clearRect(-2,-2,4,4)

		ctx.save()
		var outer_ring = this.inversion.apply(0, 0, 1+ring_radius)
		ctx.scale((1+ring_radius)/outer_ring[2], (1+ring_radius)/outer_ring[2])
		ctx.translate(-outer_ring[0], -outer_ring[1])
		ctx.lineWidth = 1/this.scale
		if(false) {
			ctx.beginPath()
			ctx.moveTo(1, 0)
			for(var i = 1; i <= this.count; i++) with(Math) {
				ctx.lineTo(cos(2*PI*i/this.count), sin(2*PI*i/this.count))
			}
			ctx.stroke()
		}
		for(var i = 1; i <= this.count; i++) with(Math) {
			var x = cos(2*PI*i/this.count + this.angle), y = sin(2*PI*i/this.count + this.angle)
			this.drawCircle(x,y,ring_radius)
		}
		this.drawCircle(0,0,1+ring_radius)
		this.drawCircle(0,0,1-ring_radius)
		ctx.restore()
	}
})

var chain = undefined

$(function() {
	chain = new Chain($('#chain'), 500, 8)
})

