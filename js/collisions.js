'use strict';
NE.Collisions = {
  food(game, dt) {
    const p = game.player, magnet = p.r + 26 * (1 + p.upgrades.magnet * .26 + (p.skin === 0 ? .1 : 0)), vortex = p.vortex > 0 ? 210 * (1 + p.upgrades.vortex * .22) : 0;
    for (const f of game.grid.query(p.x, p.y, Math.max(magnet, vortex) + 8, 'food')) {
      const d = NE.distance(p, f);
      if (d < p.r + f.r + 4) game.collect(f);
      else if (d < Math.max(magnet, vortex)) { const pull = (p.vortex > 0 ? 280 : 130) * dt; f.x += (p.x - f.x) / d * Math.min(pull, d); f.y += (p.y - f.y) / d * Math.min(pull, d); }
    }
    for (const e of game.enemies) {
      if (e.dead) continue;
      for (const f of game.grid.query(e.x, e.y, e.r + 8, 'food')) if (!f.dead && NE.distance(e, f) < e.r + f.r) { f.dead = true; e.mass = Math.min(600, e.mass + f.mass * .4); e.hp = Math.min(e.maxHp, e.hp + 1); }
    }
  },
  actors(game, dt) {
    const p = game.player;
    if (p.dead || game.state === 'result') return;
    const searchRadius = Math.max(p.r + 200, p.vortex > 0 ? 210 * (1 + p.upgrades.vortex * .22) + 100 : 0);
    for (const e of game.grid.query(p.x, p.y, searchRadius)) {
      if (e.kind !== 'enemy' && e.kind !== 'boss') continue;
      const d = NE.distance(p, e), contact = p.r + e.r;
      if (p.vortex > 0) {
        const range = 210 * (1 + p.upgrades.vortex * .22);
        if (d < range + e.r) { if (e.kind !== 'boss') { const pull = 160 * dt; e.x += (p.x - e.x) / Math.max(1, d) * pull; e.y += (p.y - e.y) / Math.max(1, d) * pull; } game.damageEnemy(e, (18 + p.mass * .075) * (1 + p.upgrades.vortex * .15) * game.damageMultiplier() * dt); if (game.state === 'result') return; }
      }
      if (e.dead || d > contact) continue;
      if (p.phase > 0) {
        if (!p.phaseHits.has(e.id)) { p.phaseHits.add(e.id); game.damageEnemy(e, (26 + p.mass * .22) * game.damageMultiplier()); game.burst(e.x, e.y, '#4ce6e0', 13); if (game.state === 'result') return; }
      }
      if (e.dead) continue;
      if (e.kind === 'enemy' && p.mass >= e.mass * 1.18) { game.absorb(e); continue; }
      if (p.phase <= 0) {
        if (e.kind === 'boss') game.hurt(24 + (e.state === 'charge' ? 15 : 0), { kind: 'boss' });
        else game.hurt(10 + Math.min(30, e.mass / p.mass * 8), { kind: 'enemy', type: e.type });
      }
      if (game.state === 'result') return;
      game.damageEnemy(e, (12 + p.mass * .055) * game.damageMultiplier() * dt);
      if (game.state === 'result') return;
      if (e.kind !== 'boss' && p.phase <= 0) { const push = (contact - d + 1) * .15; e.x += (e.x - p.x) / Math.max(1, d) * push; e.y += (e.y - p.y) / Math.max(1, d) * push; }
    }
    // Only neighboring pairs interact; each pair is handled once.
    for (const e of game.enemies) {
      if (e.dead) continue;
      for (const other of game.grid.query(e.x, e.y, e.r + 100, 'enemy')) {
        if (other.id <= e.id || other.dead || NE.distance(e, other) > e.r + other.r - 3) continue;
        const predator = e.mass > other.mass ? e : other, prey = predator === e ? other : e;
        if (predator.mass > prey.mass * 1.3 && ['hunt', 'guard', 'ambush', 'pack'].includes(NE.species[predator.type].behavior)) { prey.dead = true; predator.mass = Math.min(650, predator.mass + prey.mass * .13); }
      }
    }
    for (const shot of game.projectiles) {
      if (shot.dead || NE.distance(p, shot) > p.r + shot.r) continue;
      if (p.phase <= 0) game.hurt(shot.damage, { kind: 'shot' }); shot.dead = true; game.burst(shot.x, shot.y, '#ff6a9b', 7);
      if (game.state === 'result') return;
    }
    for (const wave of game.waves) {
      if (!wave.hit && Math.abs(NE.distance(p, wave) - wave.r) < p.r + 12) { if (p.phase <= 0) game.hurt(wave.damage, { kind: 'wave' }); wave.hit = true; }
      if (game.state === 'result') return;
    }
  }
};
