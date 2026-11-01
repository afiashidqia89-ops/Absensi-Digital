// ============================================================
// MAIN SUPER BIMO - bootstrap & game loop (fixed timestep 60fps)
// ============================================================

(function () {
  let canvas;

  function loop(now) {
    if (!GAME.last) GAME.last = now;
    let dt = now - GAME.last;
    GAME.last = now;
    if (dt > 120) dt = 120; // anti-lompatan saat tab tidak aktif
    GAME.acc = (GAME.acc || 0) + dt;
    while (GAME.acc >= 1000 / 60) {
      GAME.update();
      GAME.acc -= 1000 / 60;
    }
    GAME.render();
    requestAnimationFrame(loop);
  }

  window.addEventListener('load', function () {
    canvas = document.getElementById('game');
    GAME.init(canvas);
    Input.init();

    // jeda otomatis saat tab tidak aktif
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && GAME.state === 'PLAY' && !GAME.paused) GAME.togglePause();
    });

    // untuk pengujian/debug dari konsol
    window.GameAPI = { game: GAME, input: Input, audio: AudioSys };

    requestAnimationFrame(loop);
  });
})();
