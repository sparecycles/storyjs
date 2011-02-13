// Class: Snake
// Snakes are defined by their type and the 
// squares they occupy (their tail).
// The head of the snake is tail[0].
function Snake(type, positions) {
	this.type = type
	this.tail = positions.slice()
	for(var i = 1; i < this.tail.length; i++)
	{
		this.tail[i] = [
			this.tail[i-1][0] + this.tail[i][0],
			this.tail[i-1][1] + this.tail[i][1] ]
	}
}

$.extend(Snake.prototype, {
	// Function: draw
	// Draws the snake with a line, head is complete arc.
	draw: function(ctx) {
		if(this.type) {
			ctx.strokeStyle = 'rgb(0,140,0)'
		} else {
			ctx.strokeStyle = 'rgb(0,210,0)'
		}
		ctx.lineWidth = .3
		ctx.beginPath()
			var idx = this.tail.length - 1
			ctx.moveTo(this.tail[idx][0], this.tail[idx][1])
			while(--idx >= 0) {
				ctx.lineTo(this.tail[idx][0], this.tail[idx][1])
			}
			ctx.arc(this.tail[0][0], this.tail[0][1], .3, 0, 3.141, true)
			ctx.arc(this.tail[0][0], this.tail[0][1], .3, 3.141, 0, true)
		ctx.stroke()
	},
	// Function: move
	// Moves the snake in the pit.
	// The type of the snake determines the 
	// desired turning direction.
	// Snakes may crawl onto each other but they can't 
	// overlap heads.
	// 
	// This means doing the first valid one of the following:
	//   - move forward to an empty square
	//   - turn in the desired direction to an empty square
	//   - turn in the other direction to an empty square
	//   - move forward onto another snake's tail
	//   - turn in the desired direction onto another snake
	//   - turn in the other direction onto another snake
	//   - wait
	move: function(pit) {
		var tail = this.tail
		var direction = [tail[0][0] - tail[1][0], tail[0][1] - tail[1][1]]
		var ahead = [tail[0][0] + direction[0], tail[0][1] + direction[1]]
		old = tail.pop()
		if(pit.vacant(ahead)) {
			tail.unshift(ahead)
		} else {
			var alternates = 
				[[tail[0][0] - direction[1], 
				  tail[0][1] + direction[0]],
                 [tail[0][0] + direction[1],
                  tail[0][1] - direction[0]]]
			if(pit.vacant(alternates[this.type])) {
				tail.unshift(alternates[this.type])
			} else if(pit.vacant(alternates[1-this.type])) {
				tail.unshift(alternates[1-this.type])
			} else if(pit.crossable(ahead)) {
				tail.unshift(ahead)
			} else if(pit.crossable(alternates[this.type])) {
				tail.unshift(alternates[this.type])
			} else if(pit.crossable(alternates[1-this.type])) {
				tail.unshift(alternates[1-this.type])
			} else {
				tail.push(old) // snake is blocked
				return false
			}
		}
		return true
	}
})

// Class: SnakePit
// I've had it.
function SnakePit($where, size) {
	$where.next().css({clear:'left'})
	var $canvas = $where.find('canvas')
	$canvas.attr({width:size, height:size})
	$canvas.css({float:'left'})
	this.$moves = $where.find('div').eq(0)
	var ctx = this.ctx = $canvas[0].getContext('2d')
	var pit = this
	var N = [ 0,-1]
	var E = [+1, 0]
	var W = [-1, 0]
	var S = [ 0,+1]
	var margin = 20
	var scale = (size - 2*margin)/16
	ctx.translate(margin, margin)
	ctx.scale(scale, scale)
	ctx.translate(.5,.5)

	this.maze = [
		[0, [[3,0],S,S,E]],
		[1, [[4,0],E,E,E,S]],
		[1, [[11,0],E,S,S,S]],
		[0, [[0,1],S,S,S]],
		[0, [[4,1],E,E,S]],
		[0, [[2,3],N,N,N]],
		[0, [[5,3],E,E,N]],
		[0, [[8,3],N,N,N,E]],
		[0, [[11,3],N,N,W,W]],
		[1, [[14,3],N,N,N,E]],
		[1, [[2,4],W,N,N]],
		[1, [[3,4],E,E,E,E]],
		[1, [[11,4],W,W,W]],
		[0, [[14,4],W,N,N]],
		[1, [[3,5],S,W,W]],
		[1, [[7,5],W,W,W]],
		[0, [[13,5],W,W,W,W]],
		[0, [[6,6],W,W,S]],
		[0, [[13,6],E,E,N]],
		[1, [[0,7],S,S,S]],
		[0, [[2,7],W,S,S,S]],
		[0, [[7,7],E,E,E,N]],
		[1, [[11,7],E,E,E,E]],
		[1, [[2,8],S,S,E]],
		[0, [[10,8],W,W,W,W]],
		[1, [[14,8],W,W,W]],
		[1, [[3,9],E,N,E]],
		[0, [[9,9],E,E,E]],
		[1, [[5,10],S,S,S,W]],
		[0, [[12,10],W,W,W,W]],
		[0, [[13,10],E,S,E]],
		[0, [[3,11],W,W,W,S]],
		[1, [[12,11],W,W,W]],
		[1, [[1,12],S,S,S]],
		[1, [[4,12],W,W,S,S]],
		[1, [[6,12],N,N,N]],	
		[1, [[7,12],N,N,N]],	
		[0, [[12,12],W,W,W]],
		[1, [[7,13],E,N,N]],
		[0, [[14,13],W,W,W,W]],
		[1, [[7,14],W,W,W,W]],
		[0, [[12,14],E,E,S]],
		[0, [[6,15],W,W,W]],
		[0, [[11,15],W,W,N,N]],
		[0, [[15,15],N,N,N]]
	];

	this.initialize()
	this.show_player = true
	this.show_hint = false
	
	document.onkeydown = function(key) {
		if(!key) key = window.event
		var direction = {
			37: [-1, 0], // left
			38: [ 0,-1], // up
			39: [ 1, 0], // right
			40: [ 0, 1], // down
			32: [ 0, 0]  // space
		}
		var code = key.charCode ? key.charCode : key.keyCode
		if('P' == String.fromCharCode(code)) {
			pit.show_player = false
			pit.step()
			pit.draw()
		}
		if('R' == String.fromCharCode(code)) {
			pit.show_player = true
			pit.restore()
			pit.draw()
		}
		if('H' == String.fromCharCode(code)) {
			pit.show_hint = !pit.show_hint
			pit.draw()
		}
		if(pit.show_player) {
			if('U' == String.fromCharCode(code)) {
				pit.undo()
				pit.draw()
			} else if(code in direction) {
				if(pit.move(direction[code]))
					pit.draw(pit.ctx)
			}
		}
	}
}

$.extend(SnakePit.prototype, {
	// Function: Draw
	// Draws a grid, and all the snakes, and the player
	draw: function(ctx)  {
		if(!ctx) ctx = pit.ctx
		ctx.save()
		ctx.translate(-.5,-.5)
		ctx.clearRect(-1,-1,16+2,16+2)
		ctx.lineWidth = .1
		ctx.strokeStyle = 'rgb(128,128,128)'
		for(var i = 0; i <= 16; i++) {
			ctx.beginPath()
				ctx.moveTo(i,0)
				ctx.lineTo(i,16)
				ctx.moveTo(0,i)
				ctx.lineTo(16,i)
			ctx.stroke()
		}
		if(pit.show_hint) {
			ctx.fillStyle = 'rgb(96,96,96)'
			for(var y = 0; y < 16; y++)
			for(var x = 0; x < 16; x++)
			{
				if(this.possible[y*16+x])
					ctx.fillRect(x,y,1,1)
			}
		}
		ctx.restore()
		for(var sn in this.snakes) {
			this.snakes[sn].draw(ctx)
		}

		if(this.show_player) {
			ctx.strokeStyle = 'rgb(30,0,0)'

			if(!pit.vacant(pit.player))
				ctx.strokeStyle = 'rgb(255,0,0)'
				
			ctx.lineWidth = .5
			ctx.beginPath()
			ctx.arc(this.player[0], this.player[1], .35, 0, 3.141, true)
			ctx.arc(this.player[0], this.player[1], .35, 3.141, 0, true)
			ctx.stroke()
		} else {
			pit.ctx.save()
			pit.ctx.fillStyle = 'rgba(0,0,0,.25)'
			pit.ctx.textAlign = 'center'
			pit.ctx.fillText("" + pit.iteration, 8, 12)
			pit.ctx.restore()
		}
	},
	// Function: initialize
	// Clears out all game state, initializes all snakes from 
	// this.maze, and creates an array which represents which 
	// snakes are on which squares. Assumption: no board 
	// will allow for more than 1024 simultaneous crossings 
	// at one square.
	initialize: function() {
		this.snakes = []
		this.player = [0,15]
		this.moves = []
		this.$moves.html('')
		this.iteration = 0
		for(var sn in this.maze) {
			var snake = this.maze[sn]
			this.snakes.push(new Snake(snake[0], snake[1]))
		}
		this.grid = new Array(16*16)
		this.possible = new Array(16*16)
		for(var y = 0; y < 16; y++)
		for(var x = 0; x < 16; x++)
		{
			this.grid[y*16+x] = 0
			this.possible[y*16+x] = 0
		}
		this.possible[this.player[1]*16 + this.player[0]] = 1
		for(var i = 0; i < this.snakes.length; i++) {
			var snake = this.snakes[i]
			for(var t = 0; t < snake.tail.length; t++) {
				var tail = snake.tail
				var grid_index = tail[t][1]*16 + tail[t][0]
				this.grid[grid_index] += 1
				if(0 == t) this.grid[grid_index] += 1024
			}
		}
	},
	// Function: vacant
	// Checks if square pos[0], pos[1] is vacant on the board
	// (ignoring player).
	vacant: function(pos) {
		return pos[0] >= 0 && pos[0] < 16
		    && pos[1] >= 0 && pos[1] < 16
		    && this.grid[pos[0] + pos[1]*16] == 0
	},
	// Function: crossable
	// Checks if square pos[0], pos[1] does not 
	// have a snake head on it.
	crossable: function(pos) {
		return pos[0] >= 0 && pos[0] < 16 
		    && pos[1] >= 0 && pos[1] < 16
		    && this.grid[pos[0] + pos[1]*16] < 1024
	},
	// Function: step
	// Runs one iteration of the game.
	step: function() {
		for(var y = 0; y < 16; y++)
		for(var x = 0; x < 16; x++)
		{
			if(this.possible[y*16 + x] & 1) {
				function flood(x,y) {
					if(x >= 0 && x < 16 && y >= 0 && y < 16) {
						if(this.grid[y*16 + x] == 0) {
							this.possible[y*16 + x] |= 2
						}
					}
				}
				flood.call(this,x,y)
				flood.call(this,x-1,y)
				flood.call(this,x+1,y)
				flood.call(this,x,y-1)
				flood.call(this,x,y+1)
			}
		}
		this.snakes.sort(function(a,b) {
			var dy = a.tail[0][1] - b.tail[0][1]
			return dy ? dy : a.tail[0][0] - b.tail[0][0]
		})
		for(var sn = 0; sn < this.snakes.length; sn++) {
			var snake = this.snakes[sn]
			var end = snake.tail[snake.tail.length-1]
			var head = snake.tail[0]
			if(snake.move(this)) {
				this.grid[end[0]+end[1]*16] -= 1
				this.grid[head[0]+head[1]*16] -= 1024
				head = snake.tail[0]
				this.grid[head[0]+head[1]*16] += 1024 + 1
			}
		}
		for(var y = 0; y < 16; y++)
		for(var x = 0; x < 16; x++)
		{
			
			this.possible[y*16 + x] = (this.possible[y*16 + x] & 2) ? 1 : 0

			if(this.grid[y*16 + x] > 0) {
				this.possible[y*16 + x] = 0
			}
		}
		this.iteration++
	},
	// Function: move
	// Moves the player by dir, and runs one step of the game
	// if the move was valid. Moves are rememebered for
	// <undo>.
	move: function(dir) {
		if(this.vacant([this.player[0], this.player[1]]) 
		&& this.vacant([this.player[0] + dir[0], 
		                this.player[1] + dir[1]])) { 
			this.player[0] += dir[0]
			this.player[1] += dir[1]
			this.step()
			this.moves.push(dir)
			function dirname(dir) {
				switch(dir[0] + 2*dir[1]) {
				case 0: return 'Wait'
				case 1: return 'E'
				case -1: return 'W'
				case 2: return 'S'
				case -2: return 'N'
				default: return '?'
				}
			}
			this.$moves.append(dirname(dir) + ', ')
			return true
		}
		return false
	},
	// Function: restore
	// Reruns the game after <initialize> given 
	// a sequence of moves.
	restore: function(moves) {
		if(!moves) moves = this.moves
		this.initialize()
		for(var i = 0; i < moves.length; i++) {
			this.move(moves[i])
		}
	},
	// Function: undo
	// Deletes the last move made and re-runs the game
	// from all the previous moves.
	undo: function() {
		if(this.moves.length == 0) return;
		this.moves.pop()
		this.restore(this.moves)
	}
})

var pit = undefined

$(function() {
	pit = new SnakePit($('#snakepit'), 400)
	pit.draw(pit.ctx)
})
