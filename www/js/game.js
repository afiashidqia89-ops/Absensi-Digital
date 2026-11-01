// ============================================================
// GAME SUPER BIMO - state machine, level, rendering
// Alur: JUDUL -> KARTU DUNIA -> MAIN -> SELESAI/NYAWA HABIS -> TAMAT
// ============================================================

const THEMES = {
  day:    { skyTop: '#6ec6ff', skyBot: '#cdf0ff', hill: '#58b368', hillD: '#3f964f', stars: false, clouds: true },
  sunset: { skyTop: '#ff9e64', skyBot: '#ffe0a3', hill: '#8a9a5b', hillD: '#6f7f47', stars: false, clouds: true },
  night:  { skyTop: '#10143c', skyBot: '#3a3f7d', hill: '#23315e', hillD: '#1a2547', stars: true,  clouds: false }
};

// teks dengan bayangan (tampilan pixel-ish)
function drawText(ctx, text, x, y, size, color, align, weight) {
  ctx.font = (weight || 'bold') + ' ' + size + 'px "Courier New", monospace';
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillText(text, x + 2, y + 2);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

const GAME = {
  canvas: null, ctx: null,
  state: 'TITLE',        // TITLE | CARD | PLAY | DYING | CLEAR | GAMEOVER | WIN
  paused: false,
  tState: 0,             // penghitung frame dalam state ini
  frame: 0,
  levelIdx: 0,
  lv: null,
  cam: 0,
  score: 0, coins: 0, lives: 3, time: 0,
  rekor: 0,
  player: null,
  enemies: [], items: [], fx: [], pops: [], bumps: [],
  fastCard: false,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    buildAllSprites();
    try { this.rekor = parseInt(localStorage.getItem('superbimo.rekor') || '0', 10) || 0; } catch (e) {}

    // parameter debug: ?autostart=1&level=2&skip=1
    const q = new URLSearchParams(location.search);
    if (q.has('level')) this.levelIdx = Math.max(0, Math.min(LEVELS.length - 1, parseInt(q.get('level'), 10) || 0));
    if (q.has('skip')) this.fastCard = true;
    if (q.has('autostart')) { this.card(); }
    else this.state = 'TITLE';
  },

  saveRekor() {
    if (this.score > this.rekor) {
      this.rekor = this.score;
      try { localStorage.setItem('superbimo.rekor', String(this.rekor)); } catch (e) {}
    }
  },

  startRun() {
    this.score = 0; this.coins = 0; this.lives = 3; this.levelIdx = 0;
    AudioSys.sfx.start();
    this.card();
  },

  // kartu dunia sebelum bermain
  card() {
    this.loadLevel(this.levelIdx);
    this.time = 300;
    this.state = 'CARD';
    this.tState = 0;
    Input.consumeAny(); // buang input basahan agar tidak langsung loncat layar
    AudioSys.stopMusic();
  },

  loadLevel(idx) {
    const L = LEVELS[idx];
    const w = Math.max(...L.rows.map(r => r.length));
    const grid = [];
    this.enemies = []; this.items = []; this.fx = []; this.pops = []; this.bumps = [];
    this.flagX = -1;
    let sx = 64, sy = 0;
    for (let r = 0; r < ROWS; r++) {
      const row = [];
      const line = (L.rows[r] || '').padEnd(w, ' ');
      for (let c = 0; c < w; c++) {
        let ch = line[c];
        const px = c * T, py = r * T;
        if (ch === 'E') { this.enemies.push(new Slime(px + 3, py + T - 20)); ch = ' '; }
        else if (ch === 'Z') { this.enemies.push(new Spiky(px + 3, py + T - 22)); ch = ' '; }
        else if (ch === 'S') { sx = px + 5; sy = py + T - 28; ch = ' '; }
        else if (ch === 'F') { this.flagX = px + 16; ch = ' '; }
        row.push(ch);
      }
      grid.push(row);
    }
    this.lv = { w: w, grid: grid, theme: THEMES[L.theme] || THEMES.day, name: L.name, tip: L.tip };
    this.player = new Player(sx, sy);
    this.cam = 0;
  },

  togglePause() {
    if (this.state === 'PLAY') {
      this.paused = !this.paused;
      if (this.paused) AudioSys.stopMusic();
      else AudioSys.startMusic();
    }
  },

  // ---------- aksi-aksi ----------
  addPopup(x, y, text, color) { this.pops.push(new Popup(x, y, text, color)); },

  collectCoin(px, py) {
    this.coins++;
    this.score += 100;
    AudioSys.sfx.coin();
    for (let i = 0; i < 5; i++) {
      this.fx.push(new Particle(px - 2, py - 2, (Math.random() - 0.5) * 3, -Math.random() * 3 - 1, '#ffd166', 4, 22));
    }
    if (this.coins >= 100) {
      this.coins -= 100;
      this.lives++;
      AudioSys.sfx.oneup();
      this.addPopup(this.player.x + 11, this.player.y - 20, '+1 NYAWA', '#7bf1a8');
    }
  },

  headHit(tx, ty) {
    const ch = this.lv.grid[ty][tx];
    const px = tx * T, py = ty * T;
    if (ch === '?') {
      this.lv.grid[ty][tx] = 'X';
      this.coins++;
      this.score += 100;
      this.fx.push(new CoinPop(px + 16, py - 12));
      AudioSys.sfx.coin();
      this.bumps.push({ tx: tx, ty: ty, t: 0 });
    } else if (ch === '!') {
      this.lv.grid[ty][tx] = 'X';
      this.items.push(new Berry(tx, ty));
      AudioSys.sfx.bump();
      this.bumps.push({ tx: tx, ty: ty, t: 0 });
    } else if (ch === 'B') {
      if (this.player.big) {
        this.lv.grid[ty][tx] = ' ';
        this.score += 50;
        for (let i = 0; i < 5; i++) {
          this.fx.push(new Particle(px + 16, py + 16, (i - 2) * 1.4, -4 - Math.random() * 2, i % 2 ? '#b5542e' : '#7c2d12', 8, 46));
        }
        AudioSys.sfx.brk();
      } else {
        AudioSys.sfx.bump();
        this.bumps.push({ tx: tx, ty: ty, t: 0 });
      }
    } else {
      AudioSys.sfx.bump();
    }
  },

  killPlayer(pit) {
    if (this.state !== 'PLAY') return;
    this.state = 'DYING';
    this.tState = 0;
    this.player.vy = pit ? -6 : -10.5;
    AudioSys.stopMusic();
    AudioSys.sfx.die();
  },

  damagePlayer() {
    const p = this.player;
    if (p.inv > 0 || this.state !== 'PLAY') return;
    if (p.big) p.shrink();
    else this.killPlayer(false);
  },

  // ---------- pembaruan per frame ----------
  update() {
    this.frame++;
    this.tState++;
    Input.tick();

    if (this.paused) return;

    switch (this.state) {
      case 'TITLE':
        if (this.tState > 20 && Input.consumeAny()) this.startRun();
        break;

      case 'CARD':
        if (this.tState > (this.fastCard ? 45 : 130)) {
          this.state = 'PLAY';
          this.tState = 0;
          AudioSys.startMusic();
        }
        break;

      case 'PLAY': this.updatePlay(); break;

      case 'DYING': {
        const p = this.player;
        p.vy += 0.5; p.y += p.vy;
        if (this.tState > 110) {
          this.lives--;
          this.saveRekor();
          if (this.lives < 0) { this.state = 'GAMEOVER'; this.tState = 0; Input.consumeAny(); }
          else this.card();
        }
        break;
      }

      case 'CLEAR': {
        const p = this.player;
        p.vx = 2.2; p.face = 1;
        p.vy += 0.55; if (p.vy > 12) p.vy = 12;
        moveX(p, this.lv);
        moveY(p, this.lv);
        p.animT++;
        this.updateFx();
        this.cam = Math.max(0, Math.min(p.x + p.w / 2 - VW * 0.42, this.lv.w * T - VW));
        if (this.tState === 1) {
          const bonus = 1000 + Math.ceil(this.time) * 10;
          this.score += bonus;
          this.addPopup(p.x + 11, p.y - 24, '+' + bonus, '#7bf1a8');
        }
        if (this.tState > 150) {
          this.levelIdx++;
          this.saveRekor();
          if (this.levelIdx >= LEVELS.length) { this.state = 'WIN'; this.tState = 0; this.winFx = []; Input.consumeAny(); }
          else this.card();
        }
        break;
      }

      case 'GAMEOVER':
        if (this.tState > 90 && Input.consumeAny()) { this.state = 'TITLE'; this.tState = 0; Input.consumeAny(); }
        if (this.tState > 420) { this.state = 'TITLE'; this.tState = 0; Input.consumeAny(); }
        break;

      case 'WIN':
        if (this.frame % 16 === 0) {
          const h = new Particle(0, 0, 0, 0, Math.random() < 0.5 ? '#ff8fac' : '#ffd166', 12, 140, 'heart');
          h.x = 240 + Math.random() * 480; h.y = 430 + Math.random() * 50;
          h.vx = (Math.random() - 0.5) * 0.4;
          this.winFx.push(h);
        }
        this.winFx.forEach(f => f.update());
        this.winFx = this.winFx.filter(f => !f.gone);
        if (this.tState > 60 && Input.consumeAny()) { this.state = 'TITLE'; this.tState = 0; Input.consumeAny(); }
        break;
    }
  },

  updateFx() {
    this.fx.forEach(f => f.update());
    this.pops.forEach(f => f.update());
    this.fx = this.fx.filter(f => !f.gone);
    this.pops = this.pops.filter(f => !f.gone);
    this.bumps.forEach(b => b.t++);
    this.bumps = this.bumps.filter(b => b.t <= 12);
  },

  updatePlay() {
    const p = this.player;
    p.update(this);

    this.enemies.forEach(e => e.update(this));

    // tabrakan Bimo vs musuh
    for (const e of this.enemies) {
      if (e.dead || e.gone || !e.active) continue;
      if (!aabb(p, e)) continue;
      const stomp = p.vy > 0.5 && p.prevBottom <= e.y + 8;
      if (stomp && !(e instanceof Spiky)) {
        e.dead = true; e.squashT = 0;
        p.vy = Input.jump ? -10 : -7;
        this.score += 200;
        this.addPopup(e.x + e.w / 2, e.y - 14, '+200', '#ffd166');
        AudioSys.sfx.stomp();
      } else {
        this.damagePlayer();
      }
    }
    this.enemies = this.enemies.filter(e => !e.gone);

    // item (buah energi)
    this.items.forEach(it => {
      it.update(this);
      if (!it.gone && aabb(p, it)) {
        it.gone = true;
        this.score += 500;
        this.addPopup(it.x + 12, it.y - 14, '+500', '#ffd166');
        p.grow();
      }
    });
    this.items = this.items.filter(it => !it.gone);

    this.updateFx();

    // kamera
    this.cam = Math.max(0, Math.min(p.x + p.w / 2 - VW * 0.42, this.lv.w * T - VW));

    // bendera = selesai
    if (p.x + p.w > this.flagX - 4) {
      this.state = 'CLEAR';
      this.tState = 0;
      AudioSys.stopMusic();
      AudioSys.sfx.clear();
    }

    // waktu
    this.time -= 1 / 60;
    if (this.time <= 0) { this.time = 0; this.killPlayer(true); }
  },

  // ============================================================
  // RENDER
  // ============================================================
  render() {
    const ctx = this.ctx;
    switch (this.state) {
      case 'TITLE': this.renderTitle(ctx); break;
      case 'CARD': this.renderCard(ctx); break;
      case 'PLAY': case 'DYING': case 'CLEAR': this.renderWorld(ctx); break;
      case 'GAMEOVER': this.renderGameOver(ctx); break;
      case 'WIN': this.renderWin(ctx); break;
    }
  },

  renderBg(ctx, theme, camX) {
    const grd = ctx.createLinearGradient(0, 0, 0, VH);
    grd.addColorStop(0, theme.skyTop);
    grd.addColorStop(1, theme.skyBot);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, VW, VH);

    if (theme.stars) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 40; i++) {
        const sx = (i * 173 + 40) % VW;
        const sy = (i * 97 + 20) % 300;
        const tw = (i + Math.floor(this.frame / 30)) % 7;
        if (tw < 5) ctx.fillRect(sx, sy, 2, 2);
      }
    }
    if (theme.clouds) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 7; i++) {
        const span = VW + 320;
        let cx = (i * 307 + 80 - camX * 0.25) % span;
        if (cx < -160) cx += span;
        const cy = 50 + (i * 67) % 130;
        ctx.fillRect(cx, cy, 96, 22);
        ctx.fillRect(cx + 20, cy - 14, 60, 18);
        ctx.fillRect(cx + 38, cy - 24, 34, 14);
      }
    }
    // bukit parallax
    ctx.fillStyle = theme.hill;
    for (let i = 0; i < 6; i++) {
      const span = VW + 500;
      let hx = (i * 431 + 120 - camX * 0.5) % span;
      if (hx < -260) hx += span;
      ctx.beginPath();
      ctx.arc(hx, VH - 60, 150 + (i % 3) * 40, Math.PI, 0);
      ctx.fill();
    }
    ctx.fillStyle = theme.hillD;
    ctx.fillRect(0, VH - 62, VW, 62);
  },

  bumpOffset(tx, ty) {
    for (const b of this.bumps) {
      if (b.tx === tx && b.ty === ty) return -6 * Math.sin(Math.PI * b.t / 12);
    }
    return 0;
  },

  drawTile(ctx, ch, px, py, groundTop) {
    switch (ch) {
      case '#':
        ctx.fillStyle = '#8a5a33'; ctx.fillRect(px, py, T, T);
        ctx.fillStyle = '#6e4222';
        ctx.fillRect(px, py + T - 3, T, 3);
        ctx.fillRect(px + T - 3, py, 3, T);
        ctx.fillStyle = '#7a4d2a';
        const seed = (px * 13 + py * 7) % 97;
        ctx.fillRect(px + 6 + seed % 14, py + 10 + seed % 12, 4, 4);
        ctx.fillRect(px + 20 - seed % 10, py + 20 - seed % 8, 3, 3);
        if (groundTop) {
          ctx.fillStyle = '#58cc4a'; ctx.fillRect(px, py, T, 9);
          ctx.fillStyle = '#3fae3f'; ctx.fillRect(px, py + 9, T, 3);
        }
        break;
      case 'B':
        ctx.fillStyle = '#b5542e'; ctx.fillRect(px, py, T, T);
        ctx.fillStyle = '#d97e4a'; ctx.fillRect(px, py, T, 3);
        ctx.fillStyle = '#7c2d12';
        ctx.fillRect(px, py + 10, T, 2); ctx.fillRect(px, py + 21, T, 2);
        ctx.fillRect(px + 15, py, 2, 10); ctx.fillRect(px + 7, py + 12, 2, 9);
        ctx.fillRect(px + 23, py + 12, 2, 9); ctx.fillRect(px + 15, py + 23, 2, 9);
        break;
      case '?':
        ctx.fillStyle = '#f5b83d'; ctx.fillRect(px, py, T, T);
        ctx.fillStyle = '#ffe08a'; ctx.fillRect(px + 3, py + 3, T - 6, 3);
        ctx.fillStyle = '#b0731a';
        ctx.fillRect(px, py, T, 2); ctx.fillRect(px, py + T - 2, T, 2);
        ctx.fillRect(px, py, 2, T); ctx.fillRect(px + T - 2, py, 2, T);
        [[4, 4], [T - 8, 4], [4, T - 8], [T - 8, T - 8]].forEach(o => ctx.fillRect(px + o[0], py + o[1], 4, 4));
        drawText(ctx, '?', px + T / 2, py + 4, 22, '#7a4a00', 'center');
        break;
      case 'X':
        ctx.fillStyle = '#9c6b3c'; ctx.fillRect(px, py, T, T);
        ctx.fillStyle = '#7a4d26';
        ctx.fillRect(px, py, T, 2); ctx.fillRect(px, py + T - 2, T, 2);
        ctx.fillRect(px, py, 2, T); ctx.fillRect(px + T - 2, py, 2, T);
        [[4, 4], [T - 8, 4], [4, T - 8], [T - 8, T - 8]].forEach(o => ctx.fillRect(px + o[0], py + o[1], 4, 4));
        break;
      case '(':
      case '[': {
        const isTop = ch === '(';
        ctx.fillStyle = '#2f9e44';
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = '#69db7c'; ctx.fillRect(px + 5, py, 6, T);
        ctx.fillStyle = '#1b6b2c'; ctx.fillRect(px + T - 6, py, 6, T);
        if (isTop) {
          ctx.fillStyle = '#2f9e44'; ctx.fillRect(px - 2, py, T + 4, 15);
          ctx.fillStyle = '#69db7c'; ctx.fillRect(px + 3, py + 2, 8, 11);
          ctx.fillStyle = '#1b6b2c'; ctx.fillRect(px - 2, py + 13, T + 4, 3);
        }
        break;
      }
      case '=':
        ctx.fillStyle = '#b5813f'; ctx.fillRect(px, py, T, 14);
        ctx.fillStyle = '#d9a45b'; ctx.fillRect(px, py, T, 4);
        ctx.fillStyle = '#8a5c28'; ctx.fillRect(px + 15, py, 2, 14);
        ctx.fillRect(px, py + 12, T, 2);
        break;
    }
  },

  drawCoinTile(ctx, px, py) {
    const w = Math.abs(Math.cos(this.frame * 0.08 + px * 0.05)) * 16 + 6;
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.ellipse(px + 16, py + 16, w / 2, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#b07d10';
    ctx.beginPath(); ctx.ellipse(px + 16, py + 16, Math.max(w / 4 - 1, 1.5), 6, 0, 0, Math.PI * 2); ctx.fill();
  },

  drawFlag(ctx) {
    const fx = this.flagX;
    if (fx < 0) return;
    const topY = 5 * T, baseY = 15 * T;
    ctx.fillStyle = '#d9d9d9';
    ctx.fillRect(fx - 2, topY, 4, baseY - topY);
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.arc(fx, topY - 6, 7, 0, Math.PI * 2); ctx.fill();
    const wave = Math.sin(this.frame * 0.1) * 4;
    ctx.fillStyle = '#43aa3f';
    ctx.beginPath();
    ctx.moveTo(fx + 2, topY + 6);
    ctx.lineTo(fx + 40 + wave, topY + 22);
    ctx.lineTo(fx + 2, topY + 38);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(fx + 8, topY + 16, 8, 8);
  },

  drawCastle(ctx) {
    const bx = this.lv.w * T - 340;
    if (bx - this.cam > VW + 100) return;
    const by = 15 * T;
    ctx.fillStyle = '#9c6b3c';
    ctx.fillRect(bx, by - 128, 224, 128);
    ctx.fillStyle = '#7a4d26';
    for (let i = 0; i < 5; i++) ctx.fillRect(bx + i * 48, by - 152, 32, 24);
    ctx.fillStyle = '#5a3a20';
    ctx.fillRect(bx + 92, by - 60, 40, 60);
    ctx.beginPath(); ctx.arc(bx + 112, by - 60, 20, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#3a2410';
    ctx.fillRect(bx + 30, by - 100, 24, 24); ctx.fillRect(bx + 170, by - 100, 24, 24);
    ctx.fillStyle = '#e5383b';
    ctx.fillRect(bx + 108, by - 200, 4, 48);
    ctx.beginPath();
    ctx.moveTo(bx + 112, by - 200);
    ctx.lineTo(bx + 150 + Math.sin(this.frame * 0.08) * 3, by - 188);
    ctx.lineTo(bx + 112, by - 176);
    ctx.closePath(); ctx.fill();
  },

  renderWorld(ctx) {
    const theme = this.lv.theme;
    this.renderBg(ctx, theme, this.cam);

    ctx.save();
    ctx.translate(-Math.round(this.cam), 0);

    // tile yang terlihat
    const c0 = Math.max(0, Math.floor(this.cam / T) - 1);
    const c1 = Math.min(this.lv.w - 1, c0 + VW / T + 2);
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = c0; tx <= c1; tx++) {
        const ch = this.lv.grid[ty][tx];
        if (ch === ' ') continue;
        const px = tx * T, py = ty * T;
        if (ch === 'o') { this.drawCoinTile(ctx, px, py); continue; }
        const groundTop = (ch === '#' && tileAt(this.lv, tx, ty - 1) !== '#');
        ctx.save();
        ctx.translate(0, this.bumpOffset(tx, ty));
        this.drawTile(ctx, ch, px, py, groundTop);
        ctx.restore();
      }
    }

    this.drawFlag(ctx);
    this.drawCastle(ctx);

    this.items.forEach(it => it.render(ctx));
    this.enemies.forEach(e => e.render(ctx));
    this.player.render(ctx);
    this.fx.forEach(f => f.render(ctx, this.frame));
    this.pops.forEach(f => f.render(ctx));

    ctx.restore();

    this.renderHUD(ctx);

    if (this.state === 'CLEAR') {
      drawText(ctx, 'LEVEL SELESAI!', VW / 2, 180, 40, '#7bf1a8', 'center');
    }
    if (this.paused) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, VW, VH);
      drawText(ctx, 'JEDA', VW / 2, VH / 2 - 40, 48, '#ffffff', 'center');
      drawText(ctx, 'tekan P untuk lanjut', VW / 2, VH / 2 + 20, 18, '#cccccc', 'center');
    }
  },

  renderHUD(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.fillRect(0, 0, VW, 36);
    drawText(ctx, 'SKOR ' + String(this.score).padStart(6, '0'), 14, 8, 17, '#ffffff');
    // ikon koin
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.ellipse(262, 18, 8, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#b07d10';
    ctx.beginPath(); ctx.ellipse(262, 18, 3.5, 6, 0, 0, Math.PI * 2); ctx.fill();
    drawText(ctx, 'x' + String(this.coins).padStart(2, '0'), 276, 8, 17, '#ffffff');
    drawText(ctx, this.lv.name, VW / 2 - 40, 8, 17, '#ffffff');
    // ikon nyawa
    ctx.drawImage(SPR.small.idle, 620, 2, 16, 18);
    drawText(ctx, 'x' + this.lives, 642, 8, 17, '#ffffff');
    const tLeft = Math.max(0, Math.ceil(this.time));
    drawText(ctx, 'WAKTU ' + tLeft, VW - 56, 8, 17, tLeft <= 60 ? '#ff6b6b' : '#ffffff', 'right');
  },

  renderTitle(ctx) {
    this.renderBg(ctx, THEMES.day, this.frame * 0.4);

    // logo memantul
    const title = 'SUPER BIMO';
    ctx.font = 'bold 74px "Courier New", monospace';
    let totalW = 0;
    const ws = [];
    for (const ch of title) { const w = ctx.measureText(ch).width; ws.push(w); totalW += w; }
    let x = VW / 2 - totalW / 2;
    for (let i = 0; i < title.length; i++) {
      const ch = title[i];
      const bob = Math.sin(this.frame * 0.08 + i * 0.55) * 6;
      drawText(ctx, ch, x, 90 + bob, 74, i % 2 ? '#ffd166' : '#43aa3f');
      x += ws[i];
    }
    drawText(ctx, 'PETUALANGAN MENYELAMATKAN PUTRI RARA', VW / 2, 190, 20, '#ffffff', 'center');

    // cerita
    drawText(ctx, 'Raja Gorgo menculik Putri Rara dan mengunci diri di kastel terakhir.', VW / 2, 236, 17, '#f0f0f0', 'center');
    drawText(ctx, 'Hanya kamu - Bimo - yang bisa melewati tiga dunia untuk menyelamatkannya!', VW / 2, 262, 17, '#f0f0f0', 'center');

    // panggung demo
    const gy = VH - 64;
    ctx.fillStyle = '#58cc4a'; ctx.fillRect(0, gy, VW, 12);
    ctx.fillStyle = '#8a5a33'; ctx.fillRect(0, gy + 12, VW, VH - gy - 12);
    ctx.fillStyle = '#7a4d2a';
    for (let i = 0; i < 30; i++) ctx.fillRect(((i * 97 + this.frame) % VW), gy + 24 + (i * 13) % 20, 4, 4);

    // bimo berlari di tempat + lendir berjalan
    const runSpr = SPR.small[SPR.walkCycle[Math.floor(this.frame / 6) % 4]];
    drawSpr(ctx, runSpr, 200, gy - 32, false);
    const slSpr = SPR.slime[Math.floor(this.frame / 14) % 2];
    const sx2 = 620 - ((this.frame * 0.6) % 500);
    drawSpr(ctx, slSpr, sx2, gy - 20, false);

    drawText(ctx, 'REKOR: ' + String(this.rekor).padStart(6, '0'), VW / 2, gy + 2, 16, '#ffd166', 'center');

    if (Math.floor(this.frame / 28) % 2 === 0) {
      drawText(ctx, 'TEKAN MULAI  (ENTER / SENTUH LAYAR)', VW / 2, 330, 26, '#ffffff', 'center');
    }
    drawText(ctx, 'GERAK: A/D atau panah    LOMPAT: Spasi / W / panah atas', VW / 2, 390, 16, '#e0e0e0', 'center');
    drawText(ctx, 'M: suara    P: jeda    Di HP: gunakan tombol di layar', VW / 2, 416, 16, '#e0e0e0', 'center');
    drawText(ctx, 'Game original terinspirasi platformer klasik. v1.0', VW / 2, VH - 24, 13, 'rgba(255,255,255,0.75)', 'center');
  },

  renderCard(ctx) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, VW, VH);
    drawText(ctx, this.lv.name, VW / 2, 150, 44, '#ffffff', 'center');
    ctx.drawImage(SPR.small.idle, VW / 2 - 52, 240, 28, 32);
    drawText(ctx, 'x ' + this.lives, VW / 2 - 8, 252, 24, '#ffffff');
    drawText(ctx, this.lv.tip, VW / 2, 330, 17, '#ffd166', 'center');
    drawText(ctx, 'SKOR ' + String(this.score).padStart(6, '0'), VW / 2, 380, 17, '#cccccc', 'center');
  },

  renderGameOver(ctx) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, VW, VH);
    drawText(ctx, 'PERMAINAN USAI', VW / 2, 170, 44, '#e5383b', 'center');
    drawText(ctx, 'SKOR  ' + String(this.score).padStart(6, '0'), VW / 2, 250, 22, '#ffffff', 'center');
    drawText(ctx, 'REKOR ' + String(this.rekor).padStart(6, '0'), VW / 2, 285, 22, '#ffd166', 'center');
    if (Math.floor(this.frame / 28) % 2 === 0) {
      drawText(ctx, 'tekan tombol apa saja untuk kembali', VW / 2, 350, 18, '#cccccc', 'center');
    }
  },

  renderWin(ctx) {
    // langit senja di depan kastel
    const grd = ctx.createLinearGradient(0, 0, 0, VH);
    grd.addColorStop(0, '#ff9e64');
    grd.addColorStop(1, '#ffe0a3');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, VW, VH);

    // kastel di sisi kanan
    const bx = VW - 350, by = VH - 96;
    ctx.fillStyle = '#9c6b3c';
    ctx.fillRect(bx, by - 160, 300, 160);
    ctx.fillStyle = '#7a4d26';
    for (let i = 0; i < 7; i++) ctx.fillRect(bx + i * 44, by - 188, 30, 28);
    ctx.fillRect(bx + 116, by - 260, 68, 100);
    ctx.fillStyle = '#5a3a20';
    ctx.fillRect(bx + 132, by - 66, 36, 66);
    ctx.beginPath(); ctx.arc(bx + 150, by - 66, 18, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#3a2410';
    ctx.fillRect(bx + 40, by - 120, 26, 26); ctx.fillRect(bx + 234, by - 120, 26, 26);

    // tanah
    ctx.fillStyle = '#58cc4a'; ctx.fillRect(0, VH - 96, VW, 14);
    ctx.fillStyle = '#8a5a33'; ctx.fillRect(0, VH - 82, VW, 82);

    // Bimo & Rara berdampingan di depan kastel
    drawSpr(ctx, SPR.small.idle, bx + 84, VH - 128, false);
    drawSpr(ctx, SPR.rara, bx + 150, VH - 136, false);

    // hati melayang
    this.winFx.forEach(f => f.render(ctx));

    drawText(ctx, 'PUTRI RARA SELAMAT!', VW / 2 - 60, 100, 40, '#ffffff', 'center');
    drawText(ctx, 'Kerajaan kembali damai berkat keberanianmu, Bimo!', VW / 2 - 60, 160, 18, '#fff3d6', 'center');
    drawText(ctx, 'TAMAT', VW / 2 - 60, 218, 30, '#ffd166', 'center');
    drawText(ctx, 'SKOR AKHIR  ' + String(this.score).padStart(6, '0'), 90, 290, 20, '#ffffff');
    drawText(ctx, 'REKOR  ' + String(this.rekor).padStart(6, '0'), 90, 324, 20, '#ffd166');
    drawText(ctx, '- Terima kasih sudah bermain! -', 90, 386, 17, '#ffffff');
    if (Math.floor(this.frame / 28) % 2 === 0) {
      drawText(ctx, 'tekan tombol apa saja untuk kembali ke judul', 90, 420, 14, 'rgba(255,255,255,0.9)');
    }
  }
};

// alias agar bisa dipanggil dari input.js
const Game = GAME;
