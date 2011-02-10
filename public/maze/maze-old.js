
function Maze($where, size) {
	$where.html('<canvas width="' + size + 
		'" height="' + size + '" style="float:left"></canvas><div></div>')
	$where.after('<div style="clear:left"></div>')
	
	var $canvas = $where.find('canvas')
	this.$log = $where.find('div')
	var ctx = this.ctx = $canvas[0].getContext('2d')
	
	var margin = size/20
	this.scale = (size - 2*margin)/25
	ctx.translate(margin, margin)
	ctx.scale(this.scale, this.scale)
	this.definePaths()
	this.reset()
}

function Path(spec, cf) {
	var points = spec.split(',')
	this.colorfunction = cf
	this.path = new Array(points.length)
	this.path[0] = this.translate(points[0])
	this.start = this.end = null
	
	for(var i = 1; i < points.length; i++) {
		this.path[i] = this.step(points[i], this.path[i-1])
	}
	this.length = this.compute_length()
}

function push_unique(a, item) {
	for(var i = 0; i < a.length; i++) 
	{
		if(a[i] == item)
			return a.length
	}

	return a.push(item)
}
	

$.extend(Path.prototype, {
	draw: function(ctx,param,cf) {
		if(!cf) cf = this.colorfunction
		ctx.save()
		ctx.strokeStyle = cf(param)
		ctx.beginPath()
		ctx.moveTo(this.path[0][0], this.path[0][1])
		for(var i = 1; i < this.path.length; i++) {
			ctx.lineTo(this.path[i][0], this.path[i][1])
		}
		ctx.stroke()
		ctx.restore()
	},
	delta: function(i) {
		return [
			this.path[i+1][0] - this.path[i][0],
			this.path[i+1][1] - this.path[i][1] ]
	},
	compute_length: function() {
		var len = 0
		this.lengths = [0]
		for(var i = 0; i < this.path.length-1; i++) {
			var d = this.delta(i)
			len += Math.sqrt(d[0]*d[0] + d[1]*d[1])
			this.lengths.push(len)
		}
		return len
	},
	interp: function(t) {
		t *= this.length
		var i = 1
		while(i < this.lengths.length && this.lengths[i] <= t)
			i++

		if(i >= this.lengths.length) i = this.lengths.length - 1
		
		var len = this.lengths[i] - this.lengths[i-1]
		t -= this.lengths[i-1]
		t /= len
		return [
			this.path[i][0]*t + this.path[i-1][0]*(1 - t),
			this.path[i][1]*t + this.path[i-1][1]*(1 - t) ]
	},
	step: function(point, lastpos) {
		if(typeof(point) === 'string') {
			var scale = 1
			var count = /^[0-9.]+/.exec(point)
			if(count) {
				scale = Number(count)
				point = point.slice(count.length)
			}
			if(point.indexOf('n') >= 0) return [lastpos[0], lastpos[1]-scale]
			else if(point.indexOf('s') >= 0) return [lastpos[0], lastpos[1]+scale]
			else if(point.indexOf('w') >= 0) return [lastpos[0]-scale, lastpos[1]]
			else if(point.indexOf('e') >= 0) return [lastpos[0]+scale, lastpos[1]]
			else return this.translate(point)
		}
		else return [point[0] + lastpos[0], point[1] + lastpos[1]]
	},
	translate: function(point) {
		if(typeof(point) === 'string') {
			var pos = [0,0]
			if(point.indexOf('+') >= 0) {
				var aggregate = point.split('+')
				pos = this.translate(aggregate[0])
				for(var i = 1; i < aggregate.length; i++)
					pos = this.step(aggregate[i], pos)
				return pos
			}

			var dir = 0
			var scale = 1
			if(point.indexOf('A') >= 0) pos[0] +=  5, pos[1] +=  5
			else if(point.indexOf('B') >= 0) pos[0] += 15, pos[1] +=  5
			else if(point.indexOf('C') >= 0) pos[0] += 15, pos[1] += 15
			else if(point.indexOf('D') >= 0) pos[0] += 5 + 2.5 - 1, pos[1] += 15
			else scale = 5
			if(point.indexOf('N') >= 0) pos[0] +=  1*scale, dir = 0 
			if(point.indexOf('S') >= 0) pos[0] +=  1*scale, pos[1] += 5*scale, dir = 0 
			if(point.indexOf('W') >= 0) pos[1] +=  1*scale, dir = 1 
			if(point.indexOf('E') >= 0) pos[1] +=  1*scale, pos[0] += 5*scale, dir = 1
			if(point.indexOf('1') >= 0) pos[dir] += 0*scale
			if(point.indexOf('2') >= 0) pos[dir] += 1*scale
			if(point.indexOf('3') >= 0) pos[dir] += 2*scale
			if(point.indexOf('4') >= 0) pos[dir] += 3*scale
			point = pos
		}
		return point
	}
})

function Node(pos) {
	this.x = pos[0]
	this.y = pos[1]
	this.north = this.south = this.west = this.east = null
}

$.extend(Node.prototype, {
	toString: function() { return '(' + this.x + ', ' + this.y + ')' },
})

$.extend(Maze.prototype, {
	getNode: function(at) {
		var loc = Path.prototype.translate(at)
		var index = loc[0] + loc[1]*25
		if(this.nodes[index])
			return this.nodes[index]
		else {
			this.nodes[index] = new Node(loc)
			return this.nodes[index]
		}
	},
	reset: function() {
		this.stack = []
		this.traversing = {paths:[]}
		this.animate = true
		this.follow_linearpath = true
		this.replay = []
		this.record = []
		this.node = this.start
		this.player = [this.node.x, this.node.y]
		this.draw()
	},
	definePaths: function() {
		var red = function(on) { return on ? 'rgb(255,0,0)' : 'rgb(100,0,0)' }
		var green = function(on) { return on ? 'rgb(0,255,0)' : 'rgb(0,100,0)' }
		var blue = function(on) { return on ? 'rgb(0,0,255)' : 'rgb(0,0,100)' }
		var gray = function(on) { return on ? 'rgb(128,128,128)' : 'rgb(80,80,80)' }
		this.paths = []
		var redpaths = [
			'N1,s,3w,2s',
			'N1+s+3w+2s,4e,2s',
			'N1+s+3w+2s,2s',
			'N1+s+3w+2s+2s,2w',
			'N1+s+3w+2s+2s,5s,2w',
			'N2,s,w,4s',
			'N4,s,4w,4s',
			'E1,w,2n,5w,BN4',
			'E2,4w,1n,1w',
			'W3+4e,7n,AW3',
			'W3,4e',
			'W3+4e,9s,6e,1s',
			'CE4,2e,n,2w',
			'CW2,w,9n,e',
			'CW4,4w,5n,2w,4n',
			'AE4,3e,3n,2e',
		]
		var greenpaths = [
			'AW1,2w,5s,5e,n',
			'S1,2n,7e,10n',
			'S1+2n+7e+10n,7n',
			'S1+2n+7e+17n,2w',
			'CN1,2n',
			'BE3,2e,5s,6w',
			'BE3+2e+5s+6w,4w',
			'N3,1s,3w,5s',
			'BN3,3n,5e,21s,3w,S4',
		]
		var bluepaths = [
			'S3,4n',
			'S3+4n,7e,n,E4',
			'W4,3e,s,10e',
			'W4+3e+s+10e,2e',
			'AS2,2s,6e,9s',
			'BS2,4s,2e,1s',
			'AN3,1n,13e,3s,3e,8s',
			'E3,w',
			'CE2,2e,2n,2e',
		]
		var specialpaths = [
			'DN0,n,1.5w,AS1',
			'DS0,2s,10.5e,CS3',
		]
		for(var pi in redpaths) this.paths.push(new Path(redpaths[pi], red))
		for(var pi in greenpaths) this.paths.push(new Path(greenpaths[pi], green))
		for(var pi in bluepaths) this.paths.push(new Path(bluepaths[pi], blue))
		this.nodes = new Object()
		var directions = this.directions = [['N', 'north'], ['S', 'south'], ['W', 'west'], ['E', 'east']]
		function path_direction(path, index) {
			if(!index) index = 0
			var delta = [
				path.path[index+1][0] - path.path[index][0],
				path.path[index+1][1] - path.path[index][1] ]
			if(delta[1] < 0) return 0
			if(delta[1] > 0) return 1
			if(delta[0] < 0) return 2
			if(delta[0] > 0) return 3
		}
		function path_end_direction(path) {
			return path_direction(path, path.path.length-2) ^ 1
		}
		var boxes = ['A','B','C']
		for(var d in directions)
		for(var x = 1; x <= 4; x++)
		{
			var loc = Path.prototype.translate(directions[d][0] + x)
			var node = this.nodes[loc[0] + loc[1]*25] = new Node(loc)
			
			node[directions[d][1]] = new function(maze,loc,d) { 
				return function() { maze.exit(loc, d) } 
				}(this,loc,d)
		}

		for(var box in boxes)
		for(var d in directions)
		for(var x = 0; x <= 4; x++)
		{
			var node = this.getNode(boxes[box] + directions[d][0] + x)
			node[directions[1^d][1]] = new function(maze,box,node,d) {
				return function() { maze.enter(box, node, d) }}
				(this, boxes[box], this.getNode(directions[d][0] + x), 1^d)
		}

		for(var pi in this.paths) {
			var path = this.paths[pi]
			var start = path.path[0][0] + path.path[0][1]*25
			var end = path.path[path.path.length-1][0] + path.path[path.path.length-1][1]*25
			var start_node = this.nodes[start]
			var end_node = this.nodes[end]
			if(!start_node) start_node = this.nodes[start] = new Node(path.path[0])
			if(!end_node) end_node = this.nodes[end] = new Node(path.path[path.path.length-1])
			var start_dir = path_direction(path)
			var end_dir = path_end_direction(path)
			start_node[directions[start_dir][1]] = new function(maze, path, dir) {
				return function() { maze.traverse(path, dir) } } (this, path, 1^end_dir)
			
			end_node[directions[end_dir][1]] = new function(maze, path, dir) {
				return function() { maze.traverse(path, dir, true) } } (this, path, 1^start_dir)
			path.start = start_node
			path.end = end_node
		}

		this.specialpaths = []
		for(var pi in specialpaths) this.specialpaths.push(new Path(specialpaths[pi], gray)) 
		var startingnode = this.start = this.nodes[-1] = new Node([5 + 2.5, 15])
		var endingnode = this.nodes[-2] = new Node([5 + 2.5, 20])
		this.specialpaths[0].start = startingnode
		this.specialpaths[1].start = endingnode
		startingnode.north = new function(maze,path) { 
			return function() { maze.traverse(path, 0/*north*/) } }(this, this.specialpaths[0])
		endingnode.south = new function(maze,path){
			return function() { maze.traverse(path, 1/*south*/) } }(this, this.specialpaths[1])
		var end0 = this.specialpaths[0].end = this.getNode('AS1')
		end0.south = new function(maze,path) { 
			return function() { maze.traverse(path, 1/*south*/, true) } }(this, this.specialpaths[0])
		var end1 = this.specialpaths[1].end = this.getNode('CS3')
		end1.south = new function(maze,path) {
			return function() { maze.traverse(path, 0/*north*/, true, function() { 
				maze.node = startingnode
				maze.replay = maze.record
				maze.record = []
 				maze.auto(0) 
			}) } }(this, this.specialpaths[1])
		this.node = startingnode
		this.player = [startingnode.x, startingnode.y]
	},
	offset: function(box) {
		 return box == 'A' ? [ 5, 5] :
		 	    box == 'B' ? [15, 5] : [15,15]
	},
	enter: function(box, node, dir) {
		if(undefined == this.traversing[box]) {
			var traversing = {up:this.traversing, paths:[], box:box}
			this.traversing[box] = traversing
		}

		var tr = this.traversing = this.traversing[box]
		maze.player = [node.x, node.y]
	
		if(this.animate && (!this.replay.length || (tr.A || tr.B || tr.C))) {
			var ctx = this.ctx
			this.node = null
			var interval = setInterval(new function(maze) {
				var t = 0
				var old_scale = maze.scale
				var target = maze.offset(box)

				return function() {

					ctx.save()
						maze.scale = old_scale * (t*t*4+1)
						ctx.scale(t*t*4+1,t*t*4+1)
						ctx.translate(-t*(target[0]),-t*(target[1]))
						maze.draw(maze.traversing.up)
						ctx.translate(target[0],target[1])
						ctx.scale(1/5,1/5)
						maze.scale *= 1/5
						maze.drawMaze(maze.ctx, maze.traversing)
					ctx.restore()
					t += 0.03
					if(t >= 1) {
						clearInterval(interval)
						maze.node = node
						maze.scale = old_scale
						maze.draw()
						maze.auto(dir)
					}
				}
			}(this), 1000/60)
		} else {
			this.node = node
			maze.auto(dir)
		}
	},
	exit: function(loc, dir) {
		if(!this.traversing.up) return
		var box = this.traversing.box
		var xoffset = 5
		var yoffset = 5
		if(box == 'B') xoffset += 10
		if(box == 'C') xoffset += 10, yoffset +=10
		loc = loc.slice()
		loc[0] = loc[0]/5 + xoffset
		loc[1] = loc[1]/5 + yoffset
		var node = this.nodes[loc[0] + loc[1]*25]
		this.node = null
		var tr = this.traversing

		if(this.animate && (!this.replay.length || (tr.A || tr.B || tr.C))) {
			var ctx = this.ctx
			var interval = setInterval(new function(maze) {
				var t = 1
				var old_scale = maze.scale
				var target = maze.offset(box)

				return function() {
					ctx.save()
						maze.scale = old_scale * (t*t*4+1)
						ctx.scale(t*t*4+1,t*t*4+1)
						ctx.translate(-t*(target[0]),-t*(target[1]))
						maze.draw(maze.traversing.up)
						ctx.translate(target[0],target[1])
						ctx.scale(1/5,1/5)
						maze.scale *= 1/5
						maze.drawMaze(ctx)
					ctx.restore()
					t -= 0.03
					if(t <= 0) {
						clearInterval(interval)
						maze.scale = old_scale
						maze.traversing = maze.traversing.up
						maze.player = [node.x, node.y]
						maze.node = node
						maze.draw()
						maze.auto(dir)
					}
				}
			}(this), 1000/60)
		} else {
			this.node = node
			this.traversing = this.traversing.up
			maze.auto(dir)
		}
	},
	traverse: function(path, dir, reverse, done) {
		if(!done) {
			done = function() { maze.auto(dir) }
		}
		if(path == this.specialpaths[0] || path == this.specialpaths[1]) {
			if(this.traversing.up)
				return
		}
		push_unique(this.traversing.paths, path)
		if(this.animate) {
			this.node = null
			var tr = this.traversing
			var speed = (!this.replay.length || (tr.A || tr.B || tr.C)) ? 0.5 : 1.5 
			var interval = setInterval(new function(maze,path,reverse,speed,done) { var t = 0 
				return function() {
					var ctx = maze.ctx
					maze.player = path.interp(reverse ? 1-t : t)
					maze.draw()
					t += speed/path.length
					if(t >= 1) {
						clearInterval(interval)
						if(reverse) maze.node = path.start
						else maze.node = path.end
						maze.player = [maze.node.x, maze.node.y]
						maze.draw()
						done()
					}
			}}(this,path,reverse,speed,done), 1000/60)
		} else {
			if(reverse) this.node = path.start
			else this.node = path.end
			if(done) done()
		}
	},
	auto: function(dir) {
		if(this.replay.length) {
			var f = this.replay.shift()
			this.go(f)
		} else if(this.follow_linearpath) {
			var choices = []
			for(var d in this.directions) {
				if((1^d) == dir) continue
				var action = this.node[this.directions[d][1]]
				if(action) choices.push(action)
			}
			
			if(choices.length == 1) this.go(choices[0])
		} 
	},
	go: function(f) {
		maze.record.push(f)
		f()
	},
	drawMaze: function(ctx, traversing) {
		ctx.lineWidth = 2/this.scale
		ctx.strokeRect(5, 5, 5, 5)
		ctx.strokeRect(15, 5, 5, 5)
		ctx.strokeRect(15, 15, 5, 5)
		ctx.lineWidth = 2/this.scale
		for(path in this.paths) {
			this.paths[path].draw(ctx,true)
		}
		if(traversing) {
			var travesty = traversing.paths
			if(travesty) {
				ctx.save()	
					ctx.lineWidth = 4/this.scale
					ctx.globalAlpha = 0.80
					for(path in travesty) {
						travesty[path].draw(ctx,false)
					}
				ctx.restore()
			}
		
			ctx.save()
			if(traversing.up) ctx.globalAlpha*=0.2
			for(path in this.specialpaths) this.specialpaths[path].draw(ctx)
			ctx.beginPath()
			ctx.arc(5+2.5,15+2.5,5/2,0,1,true)
			ctx.arc(5+2.5,15+2.5,5/2,1,0,true)
			ctx.stroke()
			ctx.restore()
		}
		if(traversing == this.traversing) {
			ctx.lineWidth = 3/this.scale
			ctx.strokeStyle = 'rgba(0,0,0,0.5)'
			ctx.beginPath()
			ctx.arc(this.player[0], this.player[1], 12/this.scale, 0, 1, true)
			ctx.arc(this.player[0], this.player[1], 12/this.scale, 1, 0, true)
			ctx.stroke()
		}
	},
	draw: function(traversing) {
		if(traversing === undefined) {
			traversing = this.traversing
		}
		
		if(this.replay.length && traversing.up && !(traversing.A || traversing.B || traversing.C))
		{
			this.draw(traversing.up)
			return
		}
		var ctx = this.ctx
		ctx.clearRect(-2, -2, 30, 30)
		ctx.strokeStyle = 'rgb(0,0,0)'
		ctx.lineWidth = 3/this.scale
		ctx.strokeRect(0, 0, 25, 25)
		this.drawMaze(ctx, traversing)
		if(traversing.up) {
			var boxoffset = this.offset(traversing.box)
			ctx.save()
			ctx.scale(5,5)
			ctx.translate(-boxoffset[0], -boxoffset[1])
			ctx.globalAlpha = 0.25
			var old_scale = this.scale
			this.scale *= 4
			this.drawMaze(ctx, traversing.up)
			this.scale = old_scale
			ctx.restore()
		}

		for(x in {A:[],B:[],C:[]}) {
			var boxoffset = this.offset(x)
			ctx.save()
			ctx.translate(boxoffset[0], boxoffset[1])
			ctx.scale(1/5,1/5)
			ctx.globalAlpha = 0.25
			var old_scale = this.scale
			this.scale /= 4
			this.drawMaze(ctx, traversing[x])
			this.scale = old_scale
			ctx.restore()
		}
	}
})

$(function() {
	maze = new Maze($('#maze'), 500)
	maze.draw()
	
	document.onkeydown = function(key) {
		var direction = {
			37: 'west',
			38: 'north',
			39: 'east',
			40: 'south',
		}
		var code = key.charCode ? key.charCode : key.keyCode
		if(code in direction) {
			var dir = direction[code]
			if(maze.node && maze.node[dir])
			{
				maze.go(maze.node[dir])
				if(!maze.animate) maze.draw()
			}
		}
	}
})

function solveit()
{
	maze.reset()
}
