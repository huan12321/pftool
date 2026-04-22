const app = getApp()
const SLOT_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  '#F1948A', '#82E0AA', '#F8C471', '#AED6F1', '#D2B4DE'
]

var TILT_ANGLE = 20 * Math.PI / 180
var GRAVITY = 9.8 * Math.sin(TILT_ANGLE)
var RESTITUTION = 0.45
var FRICTION = 0.25
var BOARD_WIDTH = 0.30
var BOARD_HEIGHT = 0.50
var BALL_RADIUS = 0.007
var PEG_RADIUS = 0.004
var LAUNCH_HEIGHT = 0.06
var SLOT_HEIGHT = 0.15
var TOTAL_HEIGHT = BOARD_HEIGHT + LAUNCH_HEIGHT + SLOT_HEIGHT
var SLOT_ENTRY_Y = LAUNCH_HEIGHT + BOARD_HEIGHT

Page({
  data: {
    isCharging: false,
    powerPercent: 0,
    slots: ['选项A', '选项B', '选项C', '选项D', '选项E'],
    lastResult: '',
    hitCount: 0
  },

  canvas: null,
  ctx: null,
  canvasWidth: 0,
  canvasHeight: 0,
  dpr: 1,
  animFrameId: null,

  ball: null,
  pegs: [],
  slotRects: [],
  isRunning: false,

  boardScreenTop: 0,
  boardScreenBot: 0,
  boardScreenLeft: 0,
  boardScreenRight: 0,

  // slingshot
  slingAnchorX: 0,
  slingAnchorY: 0,
  slingForkLeftX: 0,
  slingForkLeftY: 0,
  slingForkRightX: 0,
  slingForkRightY: 0,

  charging: false,
  chargeStart: null,
  chargePower: 0,
  pullDx: 0,
  pullDy: 0,

  lastTime: 0,

  onLoad: function() {
    this.reloadSlots()
  },

  onShow: function() {
    this.reloadSlots()
  },

  reloadSlots: function() {
    var savedSlots = wx.getStorageSync('plinko_slots')
    if (savedSlots && savedSlots.length > 0) {
      this.setData({ slots: savedSlots })
      if (this.ctx) {
        this.buildSlots()
      }
    }
  },

  onReady: function() {
    this.initCanvas()
  },

  onUnload: function() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId)
    }
  },

  initCanvas: function() {
    var that = this
    var query = wx.createSelectorQuery()
    query.select('#plinkoCanvas')
      .fields({ node: true, size: true })
      .exec(function(res) {
        if (!res[0]) return
        var canvas = res[0].node
        var ctx = canvas.getContext('2d')
        that.dpr = wx.getWindowInfo().pixelRatio
        var width = res[0].width
        var height = res[0].height
        canvas.width = width * that.dpr
        canvas.height = height * that.dpr
        ctx.scale(that.dpr, that.dpr)
        that.canvas = canvas
        that.ctx = ctx
        that.canvasWidth = width
        that.canvasHeight = height
        that.setupBoard()
        that.lastTime = Date.now()
        that.gameLoop()
      })
  },

  setupBoard: function() {
    var W = this.canvasWidth
    var H = this.canvasHeight
    this.boardScreenTop = H * 0.18
    this.boardScreenBot = H * 0.84
    this.boardScreenLeft = W * 0.06
    this.boardScreenRight = W * 0.94

    // slingshot anchor (ball rest position)
    this.slingAnchorX = W * 0.5
    this.slingAnchorY = H * 0.12
    // fork prongs
    var forkSpread = W * 0.07
    var forkHeight = H * 0.04
    this.slingForkLeftX = this.slingAnchorX - forkSpread
    this.slingForkLeftY = this.slingAnchorY - forkHeight
    this.slingForkRightX = this.slingAnchorX + forkSpread
    this.slingForkRightY = this.slingAnchorY - forkHeight

    this.buildPegs()
    this.buildSlots()
  },

  worldToScreen: function(wx_pos, wy_pos) {
    var ly = (wy_pos - LAUNCH_HEIGHT * 0.3) / (TOTAL_HEIGHT - LAUNCH_HEIGHT * 0.3)
    if (ly < 0) ly = 0
    var lx = wx_pos / BOARD_WIDTH
    var sTop = this.boardScreenTop
    var sBot = this.boardScreenBot
    var sLeft = this.boardScreenLeft
    var sRight = this.boardScreenRight
    var screenY = sTop + ly * (sBot - sTop)
    var depthFactor = 0.72 + 0.28 * ly
    var centerX = (sLeft + sRight) / 2
    var halfWidth = ((sRight - sLeft) / 2) * depthFactor
    var screenX = centerX - halfWidth + lx * 2 * halfWidth
    var scale = 0.55 + 0.45 * ly
    return { x: screenX, y: screenY, scale: scale }
  },

  buildPegs: function() {
    var saved = wx.getStorageSync('plinko_peg_random')
    if (saved && saved.length > 0) {
      this.pegs = saved
      return
    }
    this.generateRandomPegs()
  },

  generateRandomPegs: function() {
    var SAFE_DIST = 2 * PEG_RADIUS + 2.5 * BALL_RADIUS
    var PAIR_DISTS = [
      2 * PEG_RADIUS + 0.3 * BALL_RADIUS,
      2 * PEG_RADIUS + 0.5 * BALL_RADIUS,
      2 * PEG_RADIUS + 0.8 * BALL_RADIUS,
      2 * PEG_RADIUS + 1.0 * BALL_RADIUS
    ]
    var PAIR_PROB = 0.2
    var PAIR_OFFSETS = [
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
      { dx: 0.7, dy: 0.7 },
      { dx: -0.7, dy: 0.7 },
      { dx: 0.7, dy: -0.7 },
      { dx: -0.7, dy: -0.7 },
      { dx: 1, dy: 0.3 },
      { dx: -1, dy: 0.3 }
    ]
    var wallUnsafeNear = PEG_RADIUS + BALL_RADIUS
    var wallUnsafeFar = PEG_RADIUS + 2 * BALL_RADIUS
    var pegs = []
    var maxAttempts = 3000
    var target = 90 + Math.floor(Math.random() * 30)
    var isWallSafe = function(px) {
      var dl = px
      var dr = BOARD_WIDTH - px
      return !((dl > wallUnsafeNear && dl < wallUnsafeFar) || (dr > wallUnsafeNear && dr < wallUnsafeFar))
    }
    var checkDist = function(px, py) {
      for (var k = 0; k < pegs.length; k++) {
        var ddx = px - pegs[k].x
        var ddy = py - pegs[k].y
        if (ddx * ddx + ddy * ddy < SAFE_DIST * SAFE_DIST) return false
      }
      return true
    }
    for (var i = 0; i < maxAttempts && pegs.length < target; i++) {
      var x = Math.random() * BOARD_WIDTH
      if (!isWallSafe(x)) continue
      var y = LAUNCH_HEIGHT + Math.random() * BOARD_HEIGHT
      if (!checkDist(x, y)) continue
      pegs.push({ x: x, y: y, row: 0, col: pegs.length })
      if (Math.random() < PAIR_PROB) {
        var off = PAIR_OFFSETS[Math.floor(Math.random() * PAIR_OFFSETS.length)]
        var pd = PAIR_DISTS[Math.floor(Math.random() * PAIR_DISTS.length)]
        var px = x + off.dx * pd
        var py = y + off.dy * pd
        if (px >= 0 && px <= BOARD_WIDTH && py >= LAUNCH_HEIGHT && py <= LAUNCH_HEIGHT + BOARD_HEIGHT) {
          if (isWallSafe(px) && checkDist(px, py)) {
            pegs.push({ x: px, y: py, row: 0, col: pegs.length })
          }
        }
      }
    }
    var removeCount = Math.floor(pegs.length / 10)
    for (var r = 0; r < removeCount; r++) {
      var idx = Math.floor(Math.random() * pegs.length)
      pegs.splice(idx, 1)
    }
    this.pegs = pegs
    wx.setStorageSync('plinko_peg_random', pegs)
  },

  resetPegs: function() {
    if (this.isRunning) return
    wx.removeStorageSync('plinko_peg_random')
    wx.removeStorageSync('plinko_slot_dist')
    this.generateRandomPegs()
    this.generateSlotDistribution()
    this.buildSlots()
    wx.showToast({ title: '已重置钉子', icon: 'success' })
  },

  getSlotCount: function(n) {
    var map = { 2: 10, 3: 12, 4: 12, 5: 10, 6: 12 }
    return map[n] || n
  },

  generateSlotDistribution: function() {
    var slots = this.data.slots
    var n = slots.length
    var total = this.getSlotCount(n)
    var repeats = Math.floor(total / n)
    var extra = total - repeats * n
    var arr = []
    for (var i = 0; i < n; i++) {
      var count = repeats + (i < extra ? 1 : 0)
      for (var j = 0; j < count; j++) {
        arr.push(i)
      }
    }
    for (var k = arr.length - 1; k > 0; k--) {
      var r = Math.floor(Math.random() * (k + 1))
      var tmp = arr[k]
      arr[k] = arr[r]
      arr[r] = tmp
    }
    wx.setStorageSync('plinko_slot_dist', arr)
    return arr
  },

  buildSlots: function() {
    var slots = this.data.slots
    var n = slots.length
    var total = this.getSlotCount(n)
    var saved = wx.getStorageSync('plinko_slot_dist')
    if (!saved || saved.length !== total) {
      saved = this.generateSlotDistribution()
    }
    var rects = []
    for (var i = 0; i < total; i++) {
      var labelIdx = saved[i]
      rects.push({
        xStart: i * BOARD_WIDTH / total,
        xEnd: (i + 1) * BOARD_WIDTH / total,
        label: slots[labelIdx],
        color: SLOT_COLORS[labelIdx % SLOT_COLORS.length]
      })
    }
    this.slotRects = rects
  },

  // ========== DRAWING ==========
  drawScene: function() {
    var ctx = this.ctx
    ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight)
    this.drawBackground()
    this.drawSlingshot()
    this.drawBoard()
    this.drawPegs()
    this.drawSlots()
    this.drawSlotLabels()
    if (this.ball) {
      this.drawBallTrail()
      this.drawBall(this.ball.x, this.ball.y)
    }
    if (!this.isRunning && !this.ball && !this.charging) {
      this.drawIdleBall()
    }
  },

  drawBackground: function() {
    var ctx = this.ctx
    var grad = ctx.createLinearGradient(0, 0, 0, this.canvasHeight)
    grad.addColorStop(0, '#0f0f23')
    grad.addColorStop(0.5, '#1a1a3e')
    grad.addColorStop(1, '#16213e')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight)
  },

  drawSlingshot: function() {
    var ctx = this.ctx
    var ax = this.slingAnchorX
    var ay = this.slingAnchorY
    var lx = this.slingForkLeftX
    var ly = this.slingForkLeftY
    var rx = this.slingForkRightX
    var ry = this.slingForkRightY

    // Y-shape fork body
    ctx.beginPath()
    ctx.moveTo(ax, ay + 22)
    ctx.lineTo(ax, ay - 2)
    ctx.strokeStyle = '#8B6914'
    ctx.lineWidth = 5
    ctx.lineCap = 'round'
    ctx.stroke()

    // left prong
    ctx.beginPath()
    ctx.moveTo(ax, ay - 2)
    ctx.lineTo(lx, ly)
    ctx.strokeStyle = '#A0782C'
    ctx.lineWidth = 4
    ctx.stroke()
    // left tip
    ctx.beginPath()
    ctx.arc(lx, ly, 4, 0, Math.PI * 2)
    ctx.fillStyle = '#C09040'
    ctx.fill()

    // right prong
    ctx.beginPath()
    ctx.moveTo(ax, ay - 2)
    ctx.lineTo(rx, ry)
    ctx.strokeStyle = '#A0782C'
    ctx.lineWidth = 4
    ctx.stroke()
    // right tip
    ctx.beginPath()
    ctx.arc(rx, ry, 4, 0, Math.PI * 2)
    ctx.fillStyle = '#C09040'
    ctx.fill()

    // elastic bands
    var ballX = ax
    var ballY = ay
    if (this.charging) {
      ballX = ax + this.pullDx
      ballY = ay + this.pullDy
    }

    // left band
    ctx.beginPath()
    ctx.moveTo(lx, ly)
    ctx.lineTo(ballX, ballY)
    ctx.strokeStyle = '#cc4444'
    ctx.lineWidth = 2.5
    ctx.stroke()

    // right band
    ctx.beginPath()
    ctx.moveTo(rx, ry)
    ctx.lineTo(ballX, ballY)
    ctx.strokeStyle = '#cc4444'
    ctx.lineWidth = 2.5
    ctx.stroke()

    // instruction text
    if (!this.isRunning && !this.charging) {
      ctx.fillStyle = 'rgba(255,255,255,0.4)'
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('往后拉动弹珠，松手发射', ax, ay + 42)
    }
  },

  drawBoard: function() {
    var ctx = this.ctx
    var tl = this.worldToScreen(0, LAUNCH_HEIGHT)
    var tr = this.worldToScreen(BOARD_WIDTH, LAUNCH_HEIGHT)
    var bl = this.worldToScreen(0, LAUNCH_HEIGHT + BOARD_HEIGHT)
    var br = this.worldToScreen(BOARD_WIDTH, LAUNCH_HEIGHT + BOARD_HEIGHT)
    ctx.beginPath()
    ctx.moveTo(tl.x, tl.y)
    ctx.lineTo(tr.x, tr.y)
    ctx.lineTo(br.x, br.y)
    ctx.lineTo(bl.x, bl.y)
    ctx.closePath()
    var grad = ctx.createLinearGradient(0, tl.y, 0, bl.y)
    grad.addColorStop(0, '#1e2a4a')
    grad.addColorStop(0.5, '#1a2550')
    grad.addColorStop(1, '#0e1a35')
    ctx.fillStyle = grad
    ctx.fill()
    ctx.strokeStyle = 'rgba(100, 180, 255, 0.3)'
    ctx.lineWidth = 2
    ctx.stroke()
  },

  drawPegs: function() {
    var ctx = this.ctx
    for (var i = 0; i < this.pegs.length; i++) {
      var peg = this.pegs[i]
      var p = this.worldToScreen(peg.x, peg.y)
      var radius = 4.5 * p.scale
      ctx.beginPath()
      ctx.arc(p.x + 1, p.y + 2, radius + 1, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.fill()
      var grad = ctx.createRadialGradient(p.x - radius * 0.3, p.y - radius * 0.3, 0, p.x, p.y, radius)
      grad.addColorStop(0, '#e8e8e8')
      grad.addColorStop(0.4, '#b0b0b0')
      grad.addColorStop(1, '#555555')
      ctx.beginPath()
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2)
      ctx.fillStyle = grad
      ctx.fill()
      ctx.beginPath()
      ctx.arc(p.x - radius * 0.25, p.y - radius * 0.25, radius * 0.3, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.fill()
    }
  },

  drawSlots: function() {
    var ctx = this.ctx
    var slotTop = LAUNCH_HEIGHT + BOARD_HEIGHT
    var slotBot = TOTAL_HEIGHT
    for (var i = 0; i < this.slotRects.length; i++) {
      var slot = this.slotRects[i]
      var p1 = this.worldToScreen(slot.xStart, slotTop)
      var p2 = this.worldToScreen(slot.xEnd, slotTop)
      var p3 = this.worldToScreen(slot.xEnd, slotBot)
      var p4 = this.worldToScreen(slot.xStart, slotBot)
      ctx.beginPath()
      ctx.moveTo(p1.x, p1.y)
      ctx.lineTo(p2.x, p2.y)
      ctx.lineTo(p3.x, p3.y)
      ctx.lineTo(p4.x, p4.y)
      ctx.closePath()
      ctx.fillStyle = slot.color + '35'
      ctx.fill()
      ctx.strokeStyle = slot.color + '70'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(p1.x, p1.y)
      ctx.lineTo(p4.x, p4.y)
      ctx.strokeStyle = slot.color + 'AA'
      ctx.lineWidth = 2 * p1.scale
      ctx.stroke()
    }
  },

  drawSlotLabels: function() {
    var ctx = this.ctx
    var slotTop = LAUNCH_HEIGHT + BOARD_HEIGHT
    var slotBot = TOTAL_HEIGHT
    for (var i = 0; i < this.slotRects.length; i++) {
      var slot = this.slotRects[i]
      var cx = (slot.xStart + slot.xEnd) / 2
      var cy = (slotTop + slotBot) / 2
      var p = this.worldToScreen(cx, cy)
      ctx.fillStyle = slot.color
      ctx.font = Math.round(11 * p.scale) + 'px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      var label = slot.label.length > 4 ? slot.label.substring(0, 4) + '..' : slot.label
      ctx.fillText(label, p.x, p.y)
    }
  },

  drawBallTrail: function() {
    if (!this.ball || !this.ball.trail) return
    var ctx = this.ctx
    var trail = this.ball.trail
    for (var i = 0; i < trail.length; i++) {
      var alpha = (i + 1) / (trail.length + 1) * 0.25
      var p = this.worldToScreen(trail[i].x, trail[i].y)
      var r = 5 * p.scale * (i + 1) / trail.length
      ctx.beginPath()
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(100, 180, 255, ' + alpha + ')'
      ctx.fill()
    }
  },

  drawBallAt: function(sx, sy, scale) {
    var ctx = this.ctx
    var radius = 9 * (scale || 1)
    ctx.beginPath()
    ctx.arc(sx + 2, sy + 3, radius + 2, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.fill()
    var grad = ctx.createRadialGradient(sx - radius * 0.3, sy - radius * 0.3, radius * 0.1, sx, sy, radius)
    grad.addColorStop(0, '#ffffff')
    grad.addColorStop(0.25, '#88ddff')
    grad.addColorStop(0.6, '#3399ff')
    grad.addColorStop(1, '#1a5599')
    ctx.beginPath()
    ctx.arc(sx, sy, radius, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()
    ctx.beginPath()
    ctx.arc(sx - radius * 0.25, sy - radius * 0.3, radius * 0.28, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.fill()
  },

  drawBall: function(bx, by) {
    var p = this.worldToScreen(bx, by)
    this.drawBallAt(p.x, p.y, p.scale)
  },

  drawIdleBall: function() {
    var pulse = 1 + 0.04 * Math.sin(Date.now() / 300)
    this.drawBallAt(this.slingAnchorX, this.slingAnchorY, pulse)
  },

  // ========== TOUCH (SLINGSHOT) ==========
  onTouchStart: function(e) {
    if (this.isRunning) return
    this.charging = true
    var touch = e.touches[0]
    this.chargeStart = { x: touch.x, y: touch.y }
    this.pullDx = 0
    this.pullDy = 0
    this.setData({ isCharging: true, powerPercent: 0 })
  },

  onTouchMove: function(e) {
    if (!this.charging) return
    var touch = e.touches[0]
    var dx = touch.x - this.chargeStart.x
    var dy = touch.y - this.chargeStart.y
    // clamp pull distance
    var maxPull = 80
    var dist = Math.sqrt(dx * dx + dy * dy)
    if (dist > maxPull) {
      dx = dx / dist * maxPull
      dy = dy / dist * maxPull
      dist = maxPull
    }
    this.pullDx = dx
    this.pullDy = dy
    this.chargePower = dist / maxPull
    this.setData({ powerPercent: Math.round(this.chargePower * 100) })
  },

  onTouchEnd: function(e) {
    if (!this.charging) return
    this.charging = false
    this.setData({ isCharging: false })
    if (this.chargePower > 0.05) {
      this.launchBall(this.chargePower, this.pullDx, this.pullDy)
    }
    this.pullDx = 0
    this.pullDy = 0
  },

  launchBall: function(power, pullDx, pullDy) {
    if (this.isRunning) return
    this.isRunning = true
    this.setData({ hitCount: 0 })

    // slingshot: launch direction is OPPOSITE to pull direction
    // pullDx/pullDy are screen pixels, convert to world velocity
    var maxPull = 80
    var launchSpeed = 0.3 + power * 1.2
    var horizontalRatio = -pullDx / maxPull
    var worldVx = horizontalRatio * launchSpeed * 1.0
    var worldVy = launchSpeed * 0.35

    this.ball = {
      x: BOARD_WIDTH / 2,
      y: LAUNCH_HEIGHT * 0.3,
      vx: worldVx,
      vy: worldVy,
      trail: [],
      lastPegRow: -1,
      _trailCounter: 0
    }
    this.lastTime = Date.now()
  },

  // ========== GAME LOOP ==========
  gameLoop: function() {
    var now = Date.now()
    var dt = (now - this.lastTime) / 1000
    this.lastTime = now
    if (dt > 0.05) dt = 0.05
    if (dt <= 0) dt = 1 / 60
    if (this.isRunning && this.ball) {
      var steps = Math.max(1, Math.ceil(dt / 0.002))
      var subDt = dt / steps
      for (var i = 0; i < steps; i++) {
        this.updatePhysics(subDt)
        if (!this.ball) break
      }
    }
    this.drawScene()
    var that = this
    this.animFrameId = this.canvas.requestAnimationFrame(function() { that.gameLoop() })
  },

  updatePhysics: function(dt) {
    var ball = this.ball
    if (!ball) return
    ball.vy += GRAVITY * dt
    ball.x += ball.vx * dt
    ball.y += ball.vy * dt
    ball._trailCounter++
    if (ball._trailCounter % 3 === 0) {
      ball.trail.push({ x: ball.x, y: ball.y })
      if (ball.trail.length > 15) ball.trail.shift()
    }
    if (ball.x - BALL_RADIUS < 0) {
      ball.x = BALL_RADIUS
      ball.vx = Math.abs(ball.vx) * RESTITUTION
    }
    if (ball.x + BALL_RADIUS > BOARD_WIDTH) {
      ball.x = BOARD_WIDTH - BALL_RADIUS
      ball.vx = -Math.abs(ball.vx) * RESTITUTION
    }
    for (var i = 0; i < this.pegs.length; i++) {
      var peg = this.pegs[i]
      var dx = ball.x - peg.x
      var dy = ball.y - peg.y
      var distSq = dx * dx + dy * dy
      var minDist = BALL_RADIUS + PEG_RADIUS
      if (distSq < minDist * minDist) {
        var dist = Math.sqrt(distSq)
        if (dist < 0.0001) {
          // ball exactly on peg center, nudge randomly
          var angle = Math.random() * Math.PI * 2
          ball.x = peg.x + Math.cos(angle) * (minDist + 0.002)
          ball.y = peg.y + Math.sin(angle) * (minDist + 0.002)
          ball.vy = Math.abs(ball.vy) * 0.5 + 0.1
          continue
        }
        var nx = dx / dist
        var ny = dy / dist
        // push ball out first
        var overlap = minDist - dist
        ball.x += nx * (overlap + 0.002)
        ball.y += ny * (overlap + 0.002)
        // then check velocity
        var vn = ball.vx * nx + ball.vy * ny
        if (vn < 0) {
          this.data.hitCount++
          this.setData({ hitCount: this.data.hitCount })
          ball.vx -= (1 + RESTITUTION) * vn * nx
          ball.vy -= (1 + RESTITUTION) * vn * ny
          var tx = -ny
          var ty = nx
          var vt = ball.vx * tx + ball.vy * ty
          ball.vx -= FRICTION * vt * tx
          ball.vy -= FRICTION * vt * ty
        }
        // ensure ball is moving away from peg after collision
        var vnAfter = ball.vx * nx + ball.vy * ny
        if (vnAfter < 0.05) {
          ball.vx += nx * 0.05
          ball.vy += ny * 0.05
        }
      }
    }
    ball.vx *= (1 - 0.01 * dt)

    // once ball enters slot area, switch to slot physics
    if (ball.y >= SLOT_ENTRY_Y && !ball.inSlot) {
      ball.inSlot = true
      ball.slotEnterTime = Date.now()
      ball.vy *= 0.4
      ball.vx *= 0.5
    }

    // slot area physics: walls between slots + floor
    if (ball.inSlot) {
      // slot divider walls
      for (var j = 0; j <= this.slotRects.length; j++) {
        var wallX = j * BOARD_WIDTH / this.slotRects.length
        if (Math.abs(ball.x - wallX) < BALL_RADIUS + 0.002) {
          if (ball.x < wallX) {
            ball.x = wallX - BALL_RADIUS - 0.002
            ball.vx = -Math.abs(ball.vx) * RESTITUTION
          } else {
            ball.x = wallX + BALL_RADIUS + 0.002
            ball.vx = Math.abs(ball.vx) * RESTITUTION
          }
        }
      }
      // floor
      if (ball.y + BALL_RADIUS >= TOTAL_HEIGHT) {
        ball.y = TOTAL_HEIGHT - BALL_RADIUS
        ball.vy = -Math.abs(ball.vy) * RESTITUTION
        ball.vx *= 0.85
        if (Math.abs(ball.vy) < 0.02) ball.vy = 0
      }
      // settle after 3s
      if (Date.now() - ball.slotEnterTime > 3000) {
        this.onBallSettled()
      }
    }
  },

  onBallSettled: function() {
    var ball = this.ball
    if (!ball) return
    var landedSlot = null
    for (var i = 0; i < this.slotRects.length; i++) {
      var slot = this.slotRects[i]
      var slotCenter = (slot.xStart + slot.xEnd) / 2
      if (Math.abs(ball.x - slotCenter) < (slot.xEnd - slot.xStart) / 2 + BALL_RADIUS) {
        landedSlot = slot.label
      }
    }
    this.ball = null
    this.isRunning = false
    this.setData({ lastResult: landedSlot || '' })
    if (landedSlot) {
      wx.showToast({ title: landedSlot, icon: 'none', duration: 2000 })
    }
  },

  // ========== SLOT CONFIG ==========
  goSlotConfig: function() {
    wx.navigateTo({ url: '/pages/plinko-config/plinko-config' })
  }
})