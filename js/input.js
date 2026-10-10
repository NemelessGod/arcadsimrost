'use strict';
NE.Input = (() => {
  const keys = new Set(); let stick = { x: 0, y: 0 }, stickPointer = null, boostPointer = null;
  const joystick = document.getElementById('joystick'), knob = document.getElementById('joystick-knob'), boost = document.getElementById('boost-button');
  function reset() { keys.clear(); stick = { x: 0, y: 0 }; stickPointer = null; boostPointer = null; knob.style.transform = ''; boost.classList.remove('held'); }
  document.addEventListener('keydown', e => {
    if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    const code = e.code;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) e.preventDefault();
    NE.Audio.unlock(); keys.add(code);
    if (e.repeat) return;
    if (NE.game?.state === 'upgrade' && /^(Digit|Numpad)[123]$/.test(code)) { e.preventDefault(); NE.game.applyUpgrade(NE.game.offered[Number(code.at(-1)) - 1]); return; }
    if (code === 'Escape') NE.UI?.escape();
    const ability = { KeyQ: 'pulse', KeyE: 'phase', KeyR: 'vortex' }[code];
    if (ability && NE.game?.state === 'running') NE.game.useAbility(ability);
  });
  document.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', () => { reset(); if (NE.game?.state === 'running') NE.UI.pause('Игра приостановлена: окно потеряло фокус.'); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { reset(); if (NE.game?.state === 'running') NE.UI.pause('Игра приостановлена: вкладка скрыта.'); } });
  document.addEventListener('pointerdown', () => NE.Audio.unlock(), { passive: true });
  function moveStick(e) {
    const rect = joystick.getBoundingClientRect(), max = rect.width * .32, dx = e.clientX - rect.left - rect.width / 2, dy = e.clientY - rect.top - rect.height / 2, d = Math.hypot(dx, dy), ratio = Math.min(1, max / Math.max(1, d));
    stick = { x: dx * ratio / max, y: dy * ratio / max }; knob.style.transform = `translate(${dx * ratio}px, ${dy * ratio}px)`;
  }
  joystick.addEventListener('pointerdown', e => { if (stickPointer !== null) return; e.preventDefault(); stickPointer = e.pointerId; joystick.setPointerCapture(e.pointerId); moveStick(e); });
  joystick.addEventListener('pointermove', e => { if (e.pointerId === stickPointer) { e.preventDefault(); moveStick(e); } });
  function releaseStick(e) { if (e.pointerId === stickPointer) { stickPointer = null; stick = { x: 0, y: 0 }; knob.style.transform = ''; } }
  joystick.addEventListener('pointerup', releaseStick); joystick.addEventListener('pointercancel', releaseStick); joystick.addEventListener('lostpointercapture', releaseStick);
  boost.addEventListener('pointerdown', e => { if (boostPointer !== null) return; e.preventDefault(); boostPointer = e.pointerId; boost.setPointerCapture(e.pointerId); boost.classList.add('held'); });
  function releaseBoost(e) { if (e.pointerId === boostPointer) { boostPointer = null; boost.classList.remove('held'); } }
  boost.addEventListener('pointerup', releaseBoost); boost.addEventListener('pointercancel', releaseBoost); boost.addEventListener('lostpointercapture', releaseBoost);
  return { reset, direction() { let x = stick.x + (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0), y = stick.y + (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0); const d = Math.hypot(x, y); if (d > 1) { x /= d; y /= d; } return { x, y }; }, boosting() { return keys.has('Space') || boostPointer !== null; } };
})();
