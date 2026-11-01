// ============================================================
// ENTITAS SUPER BIMO
// Fisika tile, Bimo, musuh, item, dan partikel.
// ============================================================

const T = 32;          // ukuran tile (px)
const VW = 960;        // lebar layar
const VH = 544;        // tinggi layar (17 tile)
const ROWS = 17;
const SOLID_TILES = '#B?!X()[]';

function isSolidCh(ch) { return SOLID_TILES.includes(ch); }

// ---------- gerak & tabrakan tile ----------
function tileAt(lv, tx, ty) {
  if (ty < 0 || ty >= ROWS) return ' ';
  if (tx < 0 || tx >= lv.w) return '#'; // dinding di tepi level
  return lv.grid[ty][tx];
}

// kembalikan arah tabrakan dinding: 0 tidak, 1 kanan, -1 kiri
function moveX(e, lv) {
  e.x += e.vx;
  const y0 = Math.floor(e.y / T), y1 = Math.floor((e.y + e.h - 1) / T);
  if (e.vx > 0) {
    const tx = Math.floor((e.x + e.w - 1) / T);
    for (let ty = y0; ty <= y1; ty++) {
      if (isSolidCh(tileAt(lv, tx, ty))) { e.x = tx * T - e.w; return 1; }
    }
  } else if (e.vx < 0) {
    const tx = Math.floor(e.x / T);
    for (let ty = y0; ty <= y1; ty++) {
      if (isSolidCh(tileAt(lv, tx, ty))) { e.x = (tx + 1) * T; return -1; }
    }
  }
  return 0;
}

// kembalikan: 1 mendarat, -1 kepala terbentur (panggil onHead), 0 netral
function moveY(e, lv, onHead) {
  const prevBottom = e.y + e.h;
  e.y += e.vy;
  const x0 = Math.floor(e.x / T), x1 = Math.floor((e.x + e.w - 1) / T);
  if (e.vy > 0) {
    const ty = Math.floor((e.y + e.h - 1) / T);
    for (let tx = x0; tx <= x1; tx++) {
      const ch = tileAt(lv, tx, ty);
      const top = ty * T;
      if (isSolidCh(ch) || (ch === '=' && prevBottom <= top + 9)) {
        e.y = top - e.h; e.vy = 0;
        return 1;
      }
    }
  } else if (e.vy < 0) {
    const ty = Math.floor(e.y / T);
    let bestD = 1e9, hitTx = null;
    for (let tx = x0; tx <= x1; tx++) {
      if (isSolidCh(tileAt(lv, tx, ty))) {
        const d = Math.abs((tx + 0.5) * T - (e.x + e.w / 2));
        if (d < bestD) { bestD = d; hitTx = tx; }
      }
    }
    if (hitTx !== null) {
      e.y = (ty + 1) * T; e.vy = 0;
      if (onHead) onHead(hitTx, ty);
      return -1;
    }
  }
  return 0;
}

function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// ============================================================
// BIMO (pemain)
// ============================================================
class Player {
  constructor(x, y) {
    this.x = x; this.y = y; this.w = 22; this.h = 28;
    this.vx = 0; this.vy = 0;
    this.big = false;
    this.face = 1;         // 1 kanan, -1 kiri
    this.grounded = false;
    this.coyote = 0;       // toleransi lompat setelah meninggalkan bibir
    this.inv = 0;          // kebal sesaat setelah terluka
    this.prevBottom = y + 28;
    this.animT = 0;
  }

  get spriteSet() { return this.big ? SPR.big : SPR.small; }

  grow() {
    if (!this.big) {
      this.big = true;
      this.y -= 14; this.h = 42;
    }
    AudioSys.sfx.power();
  }

  shrink() {
    this.big = false;
    this.y += 14; this.h = 28;
    this.inv = 120;
    AudioSys.sfx.shrink();
  }

  update(g) {
    const ACC = 0.3, MAXV = 3.4;

    if (Input.left)  { this.vx -= ACC; this.face = -1; }
    if (Input.right) { this.vx += ACC; this.face = 1; }
    if (!Input.left && !Input.right) {
      this.vx *= this.grounded ? 0.8 : 0.96;
      if (Math.abs(this.vx) < 0.05) this.vx = 0;
    }
    this.vx = Math.max(-MAXV, Math.min(MAXV, this.vx));

    // lompat (dengan buffer + coyote time)
    if (Input.jumpBuf > 0 && (this.grounded || this.coyote > 0)) {
      this.vy = -11;
      this.grounded = false;
      this.coyote = 0;
      Input.jumpBuf = 0;
      AudioSys.sfx.jump();
    }

    // gravitasi variabel: tahan tombol = lompatan lebih tinggi
    this.vy += (this.vy < 0 && Input.jump) ? 0.44 : 0.55;
    if (this.vy > 12) this.vy = 12;

    if (moveX(this, g.lv) !== 0) this.vx = 0;
    this.prevBottom = this.y + this.h;
    const vert = moveY(this, g.lv, (tx, ty) => g.headHit(tx, ty));
    this.grounded = (vert === 1);
    this.coyote = this.grounded ? 6 : Math.max(0, this.coyote - 1);

    if (this.inv > 0) this.inv--;
    this.animT++;

    // ambil koin yang menempel di tile
    const x0 = Math.floor(this.x / T), x1 = Math.floor((this.x + this.w - 1) / T);
    const y0 = Math.floor(this.y / T), y1 = Math.floor((this.y + this.h - 1) / T);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (tileAt(g.lv, tx, ty) === 'o') {
          g.lv.grid[ty][tx] = ' ';
          g.collectCoin(tx * T + 16, ty * T + 16);
        }
      }
    }

    // jatuh ke jurang
    if (this.y > VH + 96) g.killPlayer(true);
  }

  render(ctx) {
    if (this.inv > 0 && (this.inv >> 2) % 2 === 0) return; // kedip saat kebal
    const set = this.spriteSet;
    let spr;
    if (Game.state === 'DYING') spr = SPR.small.dead;
    else if (!this.grounded) spr = set.jump;
    else if (Math.abs(this.vx) > 0.3) spr = set[SPR.walkCycle[Math.floor(this.animT / 6) % 4]];
    else spr = set.idle;
    const dx = Math.round(this.x + this.w / 2 - spr.width / 2);
    const dy = Math.round(this.y + this.h - spr.height);
    drawSpr(ctx, spr, dx, dy, this.face < 0);
  }
}

// ============================================================
// MUSUH
// ============================================================
class Slime {
  constructor(x, y) {
    this.x = x; this.y = y; this.w = 26; this.h = 20;
    this.vx = -1.0; this.vy = 0;
    this.active = false;
    this.dead = false;
    this.squashT = 0;
    this.animT = 0;
  }
  update(g) {
    if (!this.active) {
      if (this.x < g.cam + VW + 96) this.active = true;
      else return;
    }
    if (this.dead) { this.squashT++; if (this.squashT > 26) this.gone = true; return; }
    this.animT++;
    this.vy += 0.55; if (this.vy > 12) this.vy = 12;
    if (moveX(this, g.lv) !== 0) this.vx = -this.vx;
    moveY(this, g.lv);
    if (this.y > VH + 96) this.gone = true;
  }
  render(ctx) {
    if (!this.active) return;
    if (this.dead) {
      drawSpr(ctx, SPR.slimeFlat, Math.round(this.x - 1), Math.round(this.y), false);
      return;
    }
    const spr = SPR.slime[Math.floor(this.animT / 14) % 2];
    drawSpr(ctx, spr, Math.round(this.x - 1), Math.round(this.y - 0), this.vx > 0);
  }
}

class Spiky {
  constructor(x, y) {
    this.x = x; this.y = y; this.w = 26; this.h = 22;
    this.vx = -1.3; this.vy = 0;
    this.active = false;
    this.animT = 0;
  }
  update(g) {
    if (!this.active) {
      if (this.x < g.cam + VW + 96) this.active = true;
      else return;
    }
    this.animT++;
    this.vy += 0.55; if (this.vy > 12) this.vy = 12;
    if (moveX(this, g.lv) !== 0) this.vx = -this.vx;
    const grounded = moveY(this, g.lv) === 1;
    // berbalik di bibir agar tidak jatuh dari platform
    if (grounded) {
      const frontX = this.vx > 0 ? this.x + this.w + 2 : this.x - 2;
      const ftx = Math.floor(frontX / T);
      const fty = Math.floor((this.y + this.h + 4) / T);
      const ch = tileAt(g.lv, ftx, fty);
      if (!isSolidCh(ch) && ch !== '=') this.vx = -this.vx;
    }
    if (this.y > VH + 96) this.gone = true;
  }
  render(ctx) {
    if (!this.active) return;
    const spr = SPR.spiky[Math.floor(this.animT / 12) % 2];
    drawSpr(ctx, spr, Math.round(this.x - 1), Math.round(this.y - 2), this.vx > 0);
  }
}

// ============================================================
// ITEM & EFEK
// ============================================================
class Berry {
  constructor(tx, ty) {
    this.x = tx * T + 4; this.y = ty * T - 2;
    this.w = 24; this.h = 24;
    this.vx = 1.1; this.vy = 0;
    this.mode = 'rise';
    this.targetY = ty * T - 26;
  }
  update(g) {
    if (this.mode === 'rise') {
      this.y -= 0.8;
      if (this.y <= this.targetY) this.mode = 'walk';
      return;
    }
    this.vy += 0.5; if (this.vy > 10) this.vy = 10;
    if (moveX(this, g.lv) !== 0) this.vx = -this.vx;
    moveY(this, g.lv);
    if (this.y > VH + 96) this.gone = true;
  }
  render(ctx) { drawSpr(ctx, SPR.berry, Math.round(this.x), Math.round(this.y), false); }
}

class CoinPop {
  constructor(x, y) { this.x = x; this.y = y; this.vy = -7.5; this.t = 0; }
  update() { this.vy += 0.45; this.y += this.vy; this.t++; if (this.t > 30) this.gone = true; }
  render(ctx, frame) {
    const w = Math.abs(Math.cos(frame * 0.3)) * 16 + 4;
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, w / 2, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b07d10';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, Math.max(w / 4 - 1, 1), 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

class Particle {
  constructor(x, y, vx, vy, color, size, life, shape) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.color = color; this.size = size || 5; this.life = life || 40; this.t = 0;
    this.shape = shape || 'rect';
  }
  update() {
    this.vy += this.shape === 'heart' ? 0 : 0.4; // hati melayang tanpa gravitasi
    this.x += this.vx; this.y += this.vy; this.t++;
    if (this.t > this.life) this.gone = true;
  }
  render(ctx) {
    ctx.globalAlpha = Math.max(0, 1 - this.t / this.life);
    if (this.shape === 'heart') {
      ctx.fillStyle = this.color;
      const s = this.size;
      ctx.beginPath();
      ctx.arc(this.x - s / 4, this.y - s / 4, s / 3, 0, Math.PI * 2);
      ctx.arc(this.x + s / 4, this.y - s / 4, s / 3, 0, Math.PI * 2);
      ctx.moveTo(this.x - s * 0.55, this.y - s * 0.05);
      ctx.lineTo(this.x, this.y + s * 0.55);
      ctx.lineTo(this.x + s * 0.55, this.y - s * 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }
    ctx.fillStyle = this.color;
    ctx.fillRect(Math.round(this.x), Math.round(this.y), this.size, this.size);
    ctx.globalAlpha = 1;
  }
}

class Popup {
  constructor(x, y, text, color) {
    this.x = x; this.y = y; this.text = text; this.color = color || '#ffffff'; this.t = 0;
  }
  update() { this.y -= 0.9; this.t++; if (this.t > 48) this.gone = true; }
  render(ctx) {
    ctx.globalAlpha = Math.max(0, 1 - this.t / 48);
    drawText(ctx, this.text, this.x, this.y, 16, this.color, 'center');
    ctx.globalAlpha = 1;
  }
}
