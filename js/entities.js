'use strict';
NE.Entities = (() => {
  let uid = 1;
  function food(x = NE.rand(35, NE.C.width - 35), y = NE.rand(35, NE.C.height - 35), special = false) { return { id: uid++, kind: 'food', x, y, r: special ? 4.8 : NE.rand(2.5, 4), mass: special ? 2 : .8, xp: special ? 4 : 2, special, dead: false, seed: NE.rand(0, 100) }; }
  function player(skin = 0) { return { id: uid++, kind: 'player', x: NE.C.width / 2, y: NE.C.height / 2, vx: 0, vy: 0, angle: -.6, mass: 18, r: NE.radius(18), hp: 100, maxHp: 100, energy: 100, maxEnergy: 100, level: 1, xp: 0, xpNext: 42, stage: 0, skin, upgrades: Object.fromEntries(NE.upgrades.map(u => [u.id, 0])), cooldowns: { pulse: 0, phase: 0, vortex: 0 }, phase: 0, vortex: 0, flash: 0, invulnerable: 0, trail: [], dead: false, phaseHits: new Set(), seed: 0 }; }
  function enemy(type = 0, x, y, mass) {
    const species = NE.species[type]; mass = mass ?? NE.rand(...species.mass);
    const r = NE.radius(mass);
    return { id: uid++, kind: 'enemy', type, x: x ?? NE.rand(70, NE.C.width - 70), y: y ?? NE.rand(70, NE.C.height - 70), mass, r, vx: 0, vy: 0, angle: NE.rand(-Math.PI, Math.PI), hp: 20 + mass * .65, maxHp: 20 + mass * .65, dead: false, think: NE.rand(0, .35), target: null, state: 'graze', wander: { x: NE.rand(50, NE.C.width - 50), y: NE.rand(50, NE.C.height - 50) }, flash: 0, seed: NE.rand(0, 100), trail: [], knockX: 0, knockY: 0, migration: false, anchor: { x: x ?? NE.rand(100, NE.C.width - 100), y: y ?? NE.rand(100, NE.C.height - 100) } };
  }
  function boss(game) {
    const p = game.player, hp = 520 + p.mass * 1.5;
    return { id: uid++, kind: 'boss', x: NE.clamp(p.x + 580, 170, NE.C.width - 170), y: NE.clamp(p.y - 220, 170, NE.C.height - 170), mass: 1000, r: 86, hp, maxHp: hp, phase: 1, state: 'approach', timer: 2.5, angle: 0, vx: 0, vy: 0, targetX: p.x, targetY: p.y, dead: false, flash: 0, seed: 12, attackCount: 0, trail: [], knockX: 0, knockY: 0 };
  }
  return { food, player, enemy, boss };
})();
