// ============================================================
// INPUT SUPER BIMO
// Keyboard (untuk uji di browser) + tombol sentuh (untuk Android).
// ============================================================

const Input = {
  left: false,
  right: false,
  jump: false,
  jumpBuf: 0,      // buffer lompatan (frame) - tekan sedikit sebelum mendarat tetap lompat
  anyPressed: false, // untuk menu (tekan apa saja)

  pressAny() { this.anyPressed = true; },

  pressJump() {
    this.jump = true;
    this.jumpBuf = 7;
    this.pressAny();
  },

  releaseJump() { this.jump = false; },

  consumeAny() {
    const v = this.anyPressed;
    this.anyPressed = false;
    return v;
  },

  tick() { if (this.jumpBuf > 0) this.jumpBuf--; },

  init() {
    const unlockAudio = () => AudioSys.unlock();

    window.addEventListener('keydown', (e) => {
      unlockAudio();
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      switch (e.code) {
        case 'ArrowLeft': case 'KeyA': this.left = true; break;
        case 'ArrowRight': case 'KeyD': this.right = true; break;
        case 'Space': case 'ArrowUp': case 'KeyW':
          if (!e.repeat) this.pressJump(); else this.jump = true;
          break;
        case 'KeyM': {
          const m = AudioSys.toggleMute();
          const b = document.getElementById('btn-mute');
          if (b) b.classList.toggle('off', m);
          break;
        }
        case 'KeyP': case 'Escape': Game.togglePause(); break;
      }
      if (!e.repeat) this.pressAny();
    }, { passive: false });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'ArrowLeft': case 'KeyA': this.left = false; break;
        case 'ArrowRight': case 'KeyD': this.right = false; break;
        case 'Space': case 'ArrowUp': case 'KeyW': this.releaseJump(); break;
      }
    });

    // ---- tombol sentuh ----
    const bindBtn = (id, down, up) => {
      const el = document.getElementById(id);
      if (!el) return;
      const onDown = (ev) => {
        ev.preventDefault();
        unlockAudio();
        el.classList.add('active');
        down();
      };
      const onUp = (ev) => {
        ev.preventDefault();
        el.classList.remove('active');
        up();
      };
      el.addEventListener('pointerdown', onDown);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onUp);
      el.addEventListener('pointerleave', onUp);
      el.addEventListener('contextmenu', (ev) => ev.preventDefault());
    };

    bindBtn('btn-left',  () => { this.left = true; this.pressAny(); },
                         () => { this.left = false; });
    bindBtn('btn-right', () => { this.right = true; this.pressAny(); },
                         () => { this.right = false; });
    bindBtn('btn-jump',  () => this.pressJump(), () => this.releaseJump());

    // sentuh di mana pun = "mulai" di menu
    window.addEventListener('pointerdown', () => {
      unlockAudio();
      this.pressAny();
    });

    // tombol suara & layar penuh
    const muteBtn = document.getElementById('btn-mute');
    if (muteBtn) muteBtn.addEventListener('pointerdown', (ev) => {
      ev.stopPropagation();
      unlockAudio();
      const m = AudioSys.toggleMute();
      muteBtn.classList.toggle('off', m);
    });
    const fsBtn = document.getElementById('btn-fs');
    if (fsBtn) fsBtn.addEventListener('pointerdown', (ev) => {
      ev.stopPropagation();
      try {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen();
      } catch (e) { /* diabaikan */ }
    });

    // tampilkan tombol sentuh hanya di perangkat layar sentuh
    if (('ontouchstart' in window) || navigator.maxTouchPoints > 0) {
      document.getElementById('touch-controls').classList.remove('hidden');
    }
  }
};
