// ============================================================
// SPRITES SUPER BIMO
// Semua gambar karakter dibuat dari pixel-art (deretan string),
// jadi 100% aset original - tidak ada gambar eksternal.
// Ubah huruf di sini untuk mengubah tampilan karakter!
// ============================================================

// Palet warna global (huruf -> warna)
const COLORS = {
  G: '#43aa3f', // topi hijau
  g: '#2b7a2b', // topi hijau gelap
  H: '#5a3a20', // rambut coklat
  S: '#f5c396', // kulit
  s: '#dda475', // kulit bayangan
  e: '#1f1f1f', // mata
  X: '#e5383b', // mata saat mati
  O: '#f2842c', // baju oranye
  o: '#c25a1d', // baju oranye gelap
  W: '#ffffff',
  P: '#2b3a67', // celana biru tua
  B: '#6b3e1e', // sepatu bot
  V: '#9b5de5', // lendir ungu
  v: '#6f3fbf', // lendir ungu gelap
  K: '#3a0d5e', // mulut lendir
  R: '#e5383b', // badan berduri
  r: '#a4161a', // merah gelap
  Y: '#ffd166', // duri kuning
  M: '#e9b44c', // rambut Rara
  m: '#c28f2c', // rambut Rara gelap
  F: '#ff8fac', // gaun Rara
  L: '#4cc9f0', // aksen
  D: '#2b1d0e'
};

// Buat canvas kecil dari pixel-art (skala 2x per pixel)
function buildSprite(rows, scale) {
  scale = scale || 2;
  const w = rows[0].length, h = rows.length;
  const cv = document.createElement('canvas');
  cv.width = w * scale; cv.height = h * scale;
  const c = cv.getContext('2d');
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch === '.' || ch === ' ') continue;
      c.fillStyle = COLORS[ch] || '#ff00ff';
      c.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  return cv;
}

// Gambar sprite dengan opsi dibalik (menghadap kiri)
function drawSpr(ctx, spr, x, y, flip) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (flip) { ctx.translate(spr.width, 0); ctx.scale(-1, 1); }
  ctx.drawImage(spr, 0, 0);
  ctx.restore();
}

// ---------- BIMO KECIL (14x16, digambar 28x32) ----------
const PS_KEPALA = [
  '....GGGGGG....',
  '..GGGGGGGGGG..',
  '..GGGGGGGGGG..',
  '.gggggggggggg.',
  '..HSSSSSSSSs..',
  '..HSSeSSeSSs..',
  '...SSSSSSSs...'
];
const PS_IDLE = PS_KEPALA.concat([
  '...OOOOOOOO...',
  '..OOWWWWWWOO..',
  '..oOWWWWWWOOo.',
  '...OOOOOOOO...',
  '...PPPPPPPP...',
  '...PPP..PPP...',
  '...PPP..PPP...',
  '...BBB..BBB...',
  '..BBBB..BBBB..'
]);
const PS_JALAN1 = PS_KEPALA.concat([
  '...OOOOOOOO...',
  '..OOWWWWWWOO..',
  '..oOWWWWWWOOo.',
  '...OOOOOOOO...',
  '...PPPPPPPP...',
  '..PPP....PPP..',
  '..PPP....PPP..',
  '..BBB....BBB..',
  '.BBBB....BBBB.'
]);
const PS_JALAN2 = PS_KEPALA.concat([
  '...OOOOOOOO...',
  '..OOWWWWWWOO..',
  '..oOWWWWWWOOo.',
  '...OOOOOOOO...',
  '...PPPPPPPP...',
  '....PPPPPP....',
  '....PPPPPP....',
  '....BBBBB.....',
  '...BBBBBB.....'
]);
const PS_LOMPAT = PS_KEPALA.concat([
  '...OOOOOOOO...',
  '..OOWWWWWWOO..',
  'OOoOWWWWWWOOoO',
  '...OOOOOOOO...',
  '...PPPPPPPP...',
  '...PPP..PPP...',
  '...BBB..PPP...',
  '..BBBB..BBB...',
  '..............'
]);
// Bimo mati: mata X, tangan ke atas
const PS_MATI = [
  '....GGGGGG....',
  '..GGGGGGGGGG..',
  '..GGGGGGGGGG..',
  '.gggggggggggg.',
  '..HSSXXXXSSs..',
  '..HSSSSSSSSs..',
  '...SSSSSSSs...',
  'O..OOOOOOOO..O',
  'OO.OOWWWWOO.OO',
  '.O.OOWWWWOO.O.',
  '...OOOOOOOO...',
  '...PPPPPPPP...',
  '...PPP..PPP...',
  '...PPP..PPP...',
  '...BBB..BBB...',
  '..BBBB..BBBB..'
];

// ---------- BIMO BESAR (14x22, digambar 28x44) ----------
const PB_KEPALA = PS_KEPALA;
const PB_IDLE = PB_KEPALA.concat([
  '...OOOOOOOO...',
  '..OOOOOOOOOO..',
  '..OOWWWWWWOO..',
  '..OOWWWWWWOO..',
  '..oOWWWWWWOOo.',
  '..oOOOOOOOOo..',
  '...OOOOOOOO...',
  '...OOOOOOOO...',
  '...PPPPPPPP...',
  '...PPPPPPPP...',
  '...PPPPPPPP...',
  '...PPP..PPP...',
  '...PPP..PPP...',
  '...PPP..PPP...',
  '...BBB..BBB...',
  '..BBBB..BBBB..'
]);
const PB_JALAN1 = PB_KEPALA.concat([
  '...OOOOOOOO...',
  '..OOOOOOOOOO..',
  '..OOWWWWWWOO..',
  '..OOWWWWWWOO..',
  '..oOWWWWWWOOo.',
  '..oOOOOOOOOo..',
  '...OOOOOOOO...',
  '...OOOOOOOO...',
  '...PPPPPPPP...',
  '...PPPPPPPP...',
  '...PPPPPPPP...',
  '..PPP....PPP..',
  '..PPP....PPP..',
  '..PPP....PPP..',
  '..BBB....BBB..',
  '.BBBB....BBBB.'
]);
const PB_JALAN2 = PB_KEPALA.concat([
  '...OOOOOOOO...',
  '..OOOOOOOOOO..',
  '..OOWWWWWWOO..',
  '..OOWWWWWWOO..',
  '..oOWWWWWWOOo.',
  '..oOOOOOOOOo..',
  '...OOOOOOOO...',
  '...OOOOOOOO...',
  '...PPPPPPPP...',
  '...PPPPPPPP...',
  '...PPPPPPPP...',
  '....PPPPPP....',
  '....PPPPPP....',
  '....PPPPPP....',
  '....BBBBB.....',
  '...BBBBBB.....'
]);
const PB_LOMPAT = PB_KEPALA.concat([
  '...OOOOOOOO...',
  '..OOOOOOOOOO..',
  '..OOWWWWWWOO..',
  '..OOWWWWWWOO..',
  'OOoOWWWWWWOOoO',
  'OOoOOOOOOOOoOO',
  '...OOOOOOOO...',
  '...OOOOOOOO...',
  '...PPPPPPPP...',
  '...PPPPPPPP...',
  '...PPPPPPPP...',
  '...PPP..PPP...',
  '...BBB..PPP...',
  '..BBBB..PPP...',
  '........BBB...',
  '..............'
]);

// ---------- MUSUH LENDIR "GLOOB" (14x10, digambar 28x20) ----------
const SLIME_1 = [
  '....VVVVVV....',
  '..VVVVVVVVVV..',
  '.VVVVVVVVVVVV.',
  '.VWWKVVVVWWKV.',
  'VVWWKVVVVWWKVV',
  'VVVVvKKKKvVVVV',
  'VVVVVVVVVVVVVV',
  'vVVVVVVVVVVVVv',
  'vvVVVVVVVVVVvv',
  '.vvvvvvvvvvvv.'
];
const SLIME_2 = [
  '..............',
  '..............',
  '....VVVVVV....',
  '..VVVVVVVVVV..',
  '.VVWWKVVVWWKV.',
  'VVWWKVVVVWWKVV',
  'VVVVvKKKKvVVVV',
  'vVVVVVVVVVVVVv',
  'vvVVVVVVVVVVvv',
  '.vvvvvvvvvvvv.'
];
const SLIME_GEBLEK = [
  '..............',
  '..............',
  '..............',
  '..............',
  '..VVVVVVVVVV..',
  '.VVWWKVVVWWKV.',
  'VVVVVVVVVVVVVV',
  'vVVvKKKKKKvVVv',
  'vvVVVVVVVVVVvv',
  '.vvvvvvvvvvvv.'
];

// ---------- MUSUH BERDURI "DURO" (14x12, digambar 28x24) ----------
const SPIKY_1 = [
  '..Y...YY...Y..',
  '.YRY.RRRR.YRY.',
  '.RRRRRRRRRRRR.',
  'RRRrRRRRRRrRRR',
  'RRWWKRRRRWWKRR',
  'RRWWKRRRRWWKRR',
  'RRRRRRrrRRRRRR',
  '.RRRRrrrrRRRR.',
  '.rRRRRRRRRRRr.',
  '..rrRRRRRRrr..',
  '...rrrrrrrr...',
  '..............'
];
const SPIKY_2 = [
  '..............',
  '..Y...YY...Y..',
  '.YRY.RRRR.YRY.',
  '.RRRRRRRRRRRR.',
  'RRRrRRRRRRrRRR',
  'RRWWKRRRRWWKRR',
  'RRWWKRRRRWWKRR',
  'RRRRRRrrRRRRRR',
  '.RRRRrrrrRRRR.',
  '.rRRRRRRRRRRr.',
  '..rrRRRRRRrr..',
  '...rrrrrrrr...'
];

// ---------- BUAH ENERGI "BERRY" (12x12, digambar 24x24) ----------
const BERRY = [
  '....GG......',
  '.....GG.....',
  '...RRRRRR...',
  '..RRRRRRRR..',
  '.RRWRRRRRRR.',
  '.RWRRRRRRRR.',
  '.RRRRRRRRRR.',
  '.RRRRRRRRRR.',
  '..RRRRRRRR..',
  '...RRRRRR...',
  '....rrrr....',
  '............'
];

// ---------- PUTRI RARA (14x20, digambar 28x40) ----------
const RARA = [
  '.....Y.Y.Y....',
  '....YYYYYYY...',
  '...MMMMMMMMM..',
  '..MMMMMMMMMMM.',
  '..MMSSSSSSMM..',
  '..MMSeSSeSMM..',
  '..MMSSSSSSMM..',
  '..MMSSsSSSMM..',
  '..MMMMMMMMMM..',
  '.MMMFFFFFFMMM.',
  '.MMFFFFFFFMM..',
  '.MMFFFFFFFMM..',
  '.MFFFWWWFFFMM.',
  '.FFFWWWWWFFF..',
  '.FFFWWWWWFFF..',
  '.FFFWWWWWFFF..',
  '.FFFWWWWWFFF..',
  '..FFWWWWWFF...',
  '...F.WWW.F....',
  '...s.....s....'
];

// ---------- Kumpulan sprite siap pakai ----------
const SPR = {};
function buildAllSprites() {
  SPR.small = {
    idle: buildSprite(PS_IDLE), walk1: buildSprite(PS_JALAN1),
    walk2: buildSprite(PS_JALAN2), jump: buildSprite(PS_LOMPAT),
    dead: buildSprite(PS_MATI)
  };
  SPR.big = {
    idle: buildSprite(PB_IDLE), walk1: buildSprite(PB_JALAN1),
    walk2: buildSprite(PB_JALAN2), jump: buildSprite(PB_LOMPAT)
  };
  SPR.slime = [buildSprite(SLIME_1), buildSprite(SLIME_2)];
  SPR.slimeFlat = buildSprite(SLIME_GEBLEK);
  SPR.spiky = [buildSprite(SPIKY_1), buildSprite(SPIKY_2)];
  SPR.berry = buildSprite(BERRY);
  SPR.rara = buildSprite(RARA);
  SPR.walkCycle = ['walk1', 'idle', 'walk2', 'idle'];
}
