'use strict';
NE.AI = {
  think(e, game) {
    const spec = NE.species[e.type], neighbors = game.grid.query(e.x, e.y, spec.sense), p = game.player;
    let threat = null, prey = null, meal = null, dangerDist = Infinity, preyDist = Infinity, foodDist = Infinity;
    for (const n of neighbors) {
      if (n.id === e.id) continue;
      const d = NE.distance(e, n);
      if (n.kind === 'food') { if (d < foodDist) { meal = n; foodDist = d; } }
      else if ((n.kind === 'player' && !n.dead) || n.kind === 'enemy' || n.kind === 'boss') {
        if ((n.mass > e.mass * 1.22 || n.kind === 'boss' || (n.kind === 'player' && n.phase > 0)) && d < dangerDist) { threat = n; dangerDist = d; }
        if (n.kind !== 'boss' && n.mass * 1.22 < e.mass && d < preyDist) { prey = n; preyDist = d; }
      }
    }
    if (e.saboteur && game.mission?.defense) { e.target = game.mission.defense; e.state = 'hunt'; return; }
    if (e.migration) { if (NE.distance(e, p) < 350) { e.target = p; e.state = 'flee'; } else { e.target = e.wander; e.state = 'migrate'; } return; }
    if (threat && dangerDist < (spec.behavior === 'guard' ? 135 : spec.sense * .65)) { e.target = threat; e.state = 'flee'; return; }
    if (spec.behavior === 'pack') {
      const mates = neighbors.filter(n => n.kind === 'enemy' && n.type === 2 && n.id !== e.id);
      if (prey && (mates.length >= 2 || prey.mass < e.mass * .65)) { e.target = prey; e.state = 'hunt'; return; }
      if (!meal && mates.length) { e.target = mates[0]; e.state = 'flock'; return; }
    }
    if ((spec.behavior === 'hunt' || spec.behavior === 'ambush') && prey) {
      e.target = prey; e.state = spec.behavior === 'ambush' && preyDist > 190 ? 'stalk' : 'hunt'; return;
    }
    if (spec.behavior === 'guard' && prey && NE.distance(prey, e.anchor) < 300) { e.target = prey; e.state = 'hunt'; return; }
    if (meal && (spec.behavior !== 'guard' || NE.distance(meal, e.anchor) < 320)) { e.target = meal; e.state = 'graze'; return; }
    if (NE.distance(e, e.wander) < 40) e.wander = { x: NE.rand(60, NE.C.width - 60), y: NE.rand(60, NE.C.height - 60) };
    e.target = spec.behavior === 'guard' && NE.distance(e, e.anchor) > 350 ? e.anchor : e.wander; e.state = 'wander';
  },
  update(e, game, dt) {
    e.think -= dt;
    if (e.think <= 0 || e.target?.dead) { this.think(e, game); e.think = .18 + (e.id % 7) * .018; }
    e.attackTimer = Math.max(0, (e.attackTimer || 0) - dt);
    if (!e.attackState && [3, 5].includes(e.type) && e.target === game.player && e.state === 'hunt' && game.relation(e) === 'danger' && NE.distance(e, game.player) < 360) {
      e.attackState = 'windup'; e.attackTimer = 1; e.aimX = game.player.x; e.aimY = game.player.y;
    }
    if (e.attackState && e.attackTimer <= 0) {
      if (e.attackState === 'windup') { e.attackState = 'charge'; e.attackTimer = .65; const a = Math.atan2(e.aimY - e.y, e.aimX - e.x); e.chargeX = Math.cos(a); e.chargeY = Math.sin(a); }
      else if (e.attackState === 'charge') { e.attackState = 'recover'; e.attackTimer = 2; }
      else e.attackState = null;
    }
    let dx = (e.target?.x ?? e.x) - e.x, dy = (e.target?.y ?? e.y) - e.y;
    if (e.state === 'flee') { dx = -dx; dy = -dy; }
    if (game.mission) { const steered = game.mission.steer(e, dx, dy); dx = steered.x; dy = steered.y; }
    const spec = NE.species[e.type];
    if (e.attackState === 'charge') { dx = e.chargeX; dy = e.chargeY; }
    const dist = Math.hypot(dx, dy) || 1;
    const speed = (e.attackState === 'windup' ? 0 : e.attackState === 'charge' ? 265 : spec.speed) * (e.state === 'hunt' ? 1.22 : e.state === 'flee' ? 1.18 : e.state === 'stalk' ? .25 : 1) / (1 + Math.max(0, e.mass - spec.mass[0]) / 900);
    const smooth = 1 - Math.exp(-5 * dt);
    e.vx += (dx / dist * speed - e.vx) * smooth; e.vy += (dy / dist * speed - e.vy) * smooth;
    e.x = NE.clamp(e.x + (e.vx + e.knockX) * dt, e.r, NE.C.width - e.r); e.y = NE.clamp(e.y + (e.vy + e.knockY) * dt, e.r, NE.C.height - e.r);
    e.knockX *= Math.exp(-4 * dt); e.knockY *= Math.exp(-4 * dt);
    if (Math.hypot(e.vx, e.vy) > 3) e.angle = Math.atan2(e.vy, e.vx);
    e.r += (NE.radius(e.mass) - e.r) * (1 - Math.exp(-3 * dt)); e.flash = Math.max(0, e.flash - dt);
  },
  bossRing(b, game) {
    const phase = b.phase;
    for (let i = 0; i < 10 + phase * 3; i++) { const angle = i / (10 + phase * 3) * Math.PI * 2 + b.attackCount * .23; game.projectile(b.x, b.y, angle, (phase === 3 ? 200 : 150) * (b.empowered ? 1.15 : 1), (16 + phase * 3) * (b.empowered ? 1.2 : 1)); }
    if (phase === 3) game.wave(b.x, b.y, 430, 14);
  },
  boss(b, game, dt) {
    const p = game.player, ratio = b.hp / b.maxHp;
    const wantedPhase = ratio <= .320001 ? 3 : ratio <= .680001 ? 2 : 1;
    const phase = b.storyBoss && wantedPhase > b.phase && (b.phaseAge || 0) < 10 ? b.phase : wantedPhase;
    b.shielded = b.storyBoss && (b.phaseAge || 0) < 10 && ratio <= (b.phase === 1 ? .680001 : b.phase === 2 ? .320001 : .00101);
    if (phase !== b.phase) { b.phase = phase; b.phaseAge = 0; game.announce((b.name || 'АРХОНТ') + ' · ФАЗА ' + ['I', 'II', 'III'][phase - 1], phase === 2 ? 'НОВАЯ УГРОЗА · ПРИЗЫВ ПОМОЩНИКОВ' : 'ФИНАЛЬНАЯ ФАЗА · БЫСТРЫЕ РЫВКИ И ВОЛНЫ', '#ff719f'); game.ring(b.x, b.y, '#ff6a9b', 220, .9); NE.UI.toast(`${b.name || 'Архонт'} · фаза ${phase}. ${phase === 2 ? 'Появляются помощники!' : 'Осторожно: двойные волны!'}`, true); }
    b.phaseAge = (b.phaseAge || 0) + dt; b.timer -= dt; b.flash = Math.max(0, b.flash - dt);
    if (b.state === 'ringwarn') {
      if (b.timer <= 0) { this.bossRing(b, game); b.state = 'recover'; b.timer = phase === 3 ? 1.4 : 2.6; }
    } else if (b.state === 'charge') {
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.timer <= 0) { b.state = 'recover'; b.timer = phase === 3 ? .8 : 1.5; }
    } else if (b.state === 'telegraph') {
      if (b.timer <= 0) { const angle = Math.atan2(b.targetY - b.y, b.targetX - b.x), power = b.empowered ? 1.12 : 1; b.vx = Math.cos(angle) * (phase === 3 ? 440 : 340) * power; b.vy = Math.sin(angle) * (phase === 3 ? 440 : 340) * power; b.angle = angle; b.state = 'charge'; b.timer = .85; }
    } else {
      const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy) || 1; b.angle = Math.atan2(dy, dx);
      if (d > b.r + p.r + 110 && b.state !== 'recover') { b.x += dx / d * 53 * dt; b.y += dy / d * 53 * dt; }
      if (b.timer <= 0) {
        b.attackCount++;
        if (b.attackCount % 2 === 0) {
          if (b.storyBoss) { b.state = 'ringwarn'; b.timer = 1; } else { this.bossRing(b, game); b.state = 'recover'; b.timer = phase === 3 ? 1.4 : 2.6; }
          game.ring(b.x, b.y, '#ff6a9b', 150, .5);
        } else { b.targetX = p.x; b.targetY = p.y; b.state = 'telegraph'; b.timer = phase === 3 ? .65 : 1.05; }
        if (phase >= 2 && b.attackCount % 3 === 0) for (let i = 0; i < 3; i++) game.spawnEnemy(2, b.x + NE.rand(-100, 100), b.y + NE.rand(-100, 100), Math.max(9, p.mass * .55));
      }
    }
    b.x = NE.clamp(b.x, b.r, NE.C.width - b.r); b.y = NE.clamp(b.y, b.r, NE.C.height - b.r);
  }
};
