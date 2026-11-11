import { COURT, CourtSurface, TennisEngine } from './tennis-engine';

const PALETTES = {
  grass: { outer: '#163e33', court: '#52875b', stripe: '#639763', trim: '#b7d489', sky: '#c8e1dc' },
  clay: { outer: '#754333', court: '#bd7350', stripe: '#c57b57', trim: '#f3d2a9', sky: '#dfd6c6' },
  hard: { outer: '#153e4a', court: '#367d97', stripe: '#3f879f', trim: '#b4d8e5', sky: '#c8dce5' }
};

/** One cached backdrop; only two athletes, the ball and net repaint per frame. */
export class TennisRenderer {
  private backdrop: HTMLCanvasElement;
  private trail: { x: number; y: number }[] = [];
  private surface?: CourtSurface;
  private lastEvent = -1;
  constructor(private readonly ctx: CanvasRenderingContext2D) {
    this.backdrop = ctx.canvas.ownerDocument.createElement('canvas');
    this.backdrop.width = COURT.width; this.backdrop.height = COURT.height;
  }

  draw(game: TennisEngine, time: number): void {
    if (this.surface !== game.surface) { this.surface = game.surface; this.paintBackdrop(game.surface); }
    const c = this.ctx;
    c.clearRect(0, 0, 1000, 540); c.drawImage(this.backdrop, 0, 0);
    if (game.eventId !== this.lastEvent && game.event === 'serve') this.trail = [];
    this.lastEvent = game.eventId;
    this.trail.push({ x: game.ball.x, y: game.ball.y }); if (this.trail.length > 7) this.trail.shift();
    for (let side = 0; side < 2; side++) {
      const p = game.players[side];
      this.ellipse(p.x, 437, 29, 6, '#062b3260');
      this.athlete(p.x, p.y, side === 0 ? 1 : -1, side === 0 ? '#d6ec8e' : '#fcaf83', p.swing, time, p.vy);
    }
    // Ball-height shadow gives a readable landing cue without a prediction overlay.
    this.ellipse(game.ball.x, 435, Math.max(3, 10 - (432 - game.ball.y) / 80), 3, '#082c3f55');
    this.trail.forEach((p, i) => { c.globalAlpha = i / this.trail.length * .25; this.circle(p.x, p.y, 3 + i * .35, '#f5fc9d'); });
    c.globalAlpha = 1;
    this.circle(game.ball.x, game.ball.y, 6, '#f1ff8e');
    c.strokeStyle = '#8b9c3a'; c.lineWidth = 1; c.beginPath(); c.arc(game.ball.x + 3, game.ball.y, 4, 1.8, 4.5); c.stroke();
    this.paintNet();
    if (game.canHit(0)) {
      c.strokeStyle = '#e4f7ad70'; c.lineWidth = 2; c.setLineDash([4, 7]);
      c.beginPath(); c.arc(game.players[0].x, game.players[0].y - 62, 104, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
    }
  }

  private paintBackdrop(surface: CourtSurface): void {
    const c = this.backdrop.getContext('2d')!, p = PALETTES[surface];
    const sky = c.createLinearGradient(0, 0, 0, 270); sky.addColorStop(0, p.sky); sky.addColorStop(1, '#f4edcd');
    c.fillStyle = sky; c.fillRect(0, 0, 1000, 540);
    c.fillStyle = '#ffffff45';
    [[100, 73, 130, 18], [570, 46, 180, 12], [780, 98, 98, 12]].forEach(([x, y, w, h]) => this.roundRect(c, x, y, w, h, 20));
    // Quiet venue silhouette; deterministic and cached, not random per frame.
    c.fillStyle = '#416d7150';
    for (let i = 0; i < 12; i++) { const h = 35 + (i * 31 % 85); c.fillRect(i * 91 - 30, 238 - h, 67, h); }
    c.fillStyle = '#264e52'; c.fillRect(0, 220, 1000, 96);
    const rows = ['#d0cfb7', '#a8bcb2', '#c5b6a0'];
    for (let r = 0; r < 3; r++) for (let i = 0; i < 38; i++) {
      const x = i * 29 + (r % 2) * 13, y = 231 + r * 25;
      c.fillStyle = rows[(i + r) % 3]; c.beginPath(); c.arc(x, y, 4, 0, Math.PI * 2); c.fill();
      c.fillStyle = ['#769487', '#456b73', '#b3a580', '#708e9e'][(i * 3 + r) % 4]; c.fillRect(x - 5, y + 5, 10, 10);
    }
    c.fillStyle = '#10343a'; c.fillRect(0, 302, 1000, 46);
    c.fillStyle = '#d6e5cd'; c.font = '600 12px system-ui'; c.textAlign = 'center';
    c.fillText('B O N Z O B Y T E   /   T E N N I S   B R E A K', 250, 330);
    c.fillStyle = '#93b7ac'; c.fillText('A   L I T T L E   T I M E   O N   C O U R T', 760, 330);
    c.fillStyle = p.outer; c.fillRect(0, 348, 1000, 192);
    c.fillStyle = p.court; c.beginPath(); c.moveTo(89, 360); c.lineTo(911, 360); c.lineTo(972, 457); c.lineTo(28, 457); c.closePath(); c.fill();
    for (let i = 0; i < 10; i += 2) {
      c.fillStyle = p.stripe; c.beginPath(); c.moveTo(89 + i * 82.2, 360); c.lineTo(89 + (i + 1) * 82.2, 360);
      c.lineTo(28 + (i + 1) * 94.4, 457); c.lineTo(28 + i * 94.4, 457); c.closePath(); c.fill();
    }
    c.strokeStyle = p.trim; c.lineWidth = 2.2;
    this.line(c, [[89, 360], [911, 360], [972, 457], [28, 457], [89, 360]]);
    this.line(c, [[65, 399], [935, 399]]); this.line(c, [[58, 432], [942, 432]]);
    this.line(c, [[310, 360], [289, 457]]); this.line(c, [[690, 360], [711, 457]]);
    c.strokeStyle = '#ffffff35'; c.lineWidth = 1; this.line(c, [[28, 474], [972, 474]]);
    c.fillStyle = '#dce8d180'; c.font = '11px system-ui'; c.textAlign = 'left'; c.fillText('01  /  BONZOBYTE CLUB COURT', 38, 514);
    c.textAlign = 'right'; c.fillText(surface.toUpperCase(), 961, 514);
  }

  private paintNet(): void {
    const c = this.ctx;
    c.fillStyle = '#0a283c88'; c.fillRect(496, 323, 8, 112);
    c.strokeStyle = '#b7ccc090'; c.lineWidth = .8;
    for (let y = 329; y < 434; y += 8) this.line(c, [[491, y], [508, y + 2]]);
    c.fillStyle = '#d7dfd7'; c.fillRect(493, 319, 12, 6);
    c.fillStyle = '#c8d8ce'; c.fillRect(498, 310, 4, 129); this.ellipse(500, 439, 12, 3, '#092b3566');
  }

  private athlete(x: number, y: number, facing: number, shirt: string, swing: number, time: number, vy: number): void {
    const c = this.ctx; c.save(); c.translate(x, y); c.scale(facing, 1);
    const stride = vy ? .3 : Math.sin(time * 9 + x * .025) * .12;
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = '#c28d69'; c.lineWidth = 9;
    this.line(c, [[-8, -27], [-12 + stride * 20, -12], [-16, -4]]);
    this.line(c, [[8, -27], [15 - stride * 20, -15], [22, -4]]);
    c.strokeStyle = '#edf2dc'; c.lineWidth = 9; this.line(c, [[-20, -3], [-10, -3]]); this.line(c, [[19, -3], [29, -3]]);
    c.fillStyle = '#1d3e47'; this.roundRect(c, -16, -40, 33, 17, 5);
    c.fillStyle = shirt; this.roundRect(c, -17, -76, 35, 39, 9);
    c.fillStyle = '#ffffff60'; c.fillRect(-13, -72, 5, 22);
    c.strokeStyle = '#c9926f'; c.lineWidth = 8;
    this.line(c, [[-12, -68], [-25, -48], [-16, -42]]);
    const angle = swing > 0 ? -1.8 + (1 - swing / .3) * 3.2 : -.2;
    c.save(); c.translate(13, -65); c.rotate(angle);
    this.line(c, [[0, 0], [19, 13], [37, 5]]);
    c.strokeStyle = '#dce7d6'; c.lineWidth = 3; this.line(c, [[37, 5], [51, -5]]);
    c.translate(61, -14); c.rotate(.65);
    c.strokeStyle = '#2a525d'; c.lineWidth = 3; c.beginPath(); c.ellipse(0, 0, 13, 20, 0, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = '#dfecc280'; c.lineWidth = .7;
    for (let i = -8; i <= 8; i += 4) this.line(c, [[i, -15], [i, 15]]);
    for (let i = -12; i <= 12; i += 4) this.line(c, [[-10, i], [10, i]]);
    c.restore();
    this.circle(0, -93, 16, '#d3a07b');
    c.fillStyle = '#263c3b'; c.beginPath(); c.arc(-2, -98, 16, Math.PI, Math.PI * 2); c.fill();
    c.fillStyle = shirt; c.fillRect(-16, -100, 32, 5);
    c.fillStyle = '#233d3c'; c.fillRect(7, -94, 2, 3); c.fillRect(13, -94, 2, 3);
    c.restore();
  }
  private line(c: CanvasRenderingContext2D, points: number[][]): void { c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); }
  private roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void { c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); }
  private circle(x: number, y: number, r: number, color: string): void { this.ctx.fillStyle = color; this.ctx.beginPath(); this.ctx.arc(x, y, r, 0, Math.PI * 2); this.ctx.fill(); }
  private ellipse(x: number, y: number, rx: number, ry: number, color: string): void { this.ctx.fillStyle = color; this.ctx.beginPath(); this.ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); this.ctx.fill(); }
}
