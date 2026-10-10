'use strict';
NE.Audio = (() => {
  let context, master, lastCollect = 0;
  const melodies = { collect: [720, 1060], absorb: [160, 280, 520], evolve: [262, 330, 392, 524, 784], pulse: [170, 65], phase: [440, 880], vortex: [110, 180, 240], hurt: [120, 70], win: [392, 524, 659, 784, 1048], achievement: [660, 880], click: [460] };
  function unlock() {
    try {
      if (!context) { const API = window.AudioContext || window.webkitAudioContext; if (!API) return; context = new API(); master = context.createGain(); master.connect(context.destination); }
      if (context.state === 'suspended') context.resume().catch(() => {});
      volume();
    } catch { /* Sound is optional when a browser has no audio device. */ }
  }
  function volume() { if (master && context) master.gain.setTargetAtTime(NE.Save.data.settings.sound ? NE.Save.data.settings.volume * .18 : 0, context.currentTime, .03); }
  function play(name) {
    if (!context || context.state !== 'running' || !NE.Save.data.settings.sound) return;
    if (name === 'collect') { if (context.currentTime - lastCollect < .065) return; lastCollect = context.currentTime; }
    const notes = melodies[name] || melodies.click;
    const delay = ['evolve', 'win', 'achievement'].includes(name) ? .1 : .035;
    notes.forEach((hz, i) => {
      const osc = context.createOscillator(), gain = context.createGain(), t = context.currentTime + i * delay;
      osc.type = ['hurt', 'pulse'].includes(name) ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(hz, t); osc.frequency.exponentialRampToValueAtTime(hz * (name === 'hurt' ? .4 : 1.1), t + .15);
      gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(.5, t + .012); gain.gain.exponentialRampToValueAtTime(.001, t + .18);
      osc.connect(gain); gain.connect(master); osc.start(t); osc.stop(t + .2); osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    });
  }
  return { unlock, volume, play };
})();
