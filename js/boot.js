'use strict';
(() => {
  try {
    NE.renderer = new NE.Renderer(document.getElementById('arena'));
    if (!NE.renderer.ctx) throw new Error('Canvas 2D unavailable');
    NE.game = null;
    let last = performance.now(), accumulator = 0, hudTimer = 0;
    function frame(now) {
      const dt = NE.clamp((now - last) / 1000, 0, .1); last = now;
      const game = NE.game;
      if (game) {
        if (game.state === 'running') { accumulator += dt; let steps = 0; while (accumulator >= NE.C.step && steps < 6 && game.state === 'running') { game.update(NE.C.step); accumulator -= NE.C.step; steps++; } if (game.state !== 'running') accumulator = 0; }
        else { accumulator = 0; if (game.state === 'result') game.updateEffects(dt); }
        NE.renderer.world(game, dt); hudTimer += dt; if (hudTimer >= .1) { NE.UI.updateHUD(game); hudTimer = 0; }
      } else { accumulator = 0; NE.renderer.menu(dt); }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    if (NE.Save.warning) NE.UI.toast(NE.Save.warning, true);
  } catch (error) { document.getElementById('fatal-error').hidden = false; console.error(error); }
})();
