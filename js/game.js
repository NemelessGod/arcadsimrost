'use strict';
NE.Game = class {
  constructor(mode = 'survival', tutorial = false, options = {}) {
    this.mode = mode; this.sector = mode === 'campaign' ? NE.sectors[NE.clamp(Math.floor(options.sectorId ?? NE.Save.data.campaign.selected), 0, 5)] : null;
    this.biome = this.sector?.biome || 'wild'; this.terrain = [];
    this.tutorial = tutorial; this.state = 'running'; this.time = 0; this.score = 0; this.player = NE.Entities.player(NE.Save.data.selectedForm);
    this.player.paint = NE.Save.data.cosmetics.selected;
    this.food = []; this.enemies = []; this.particles = []; this.rings = []; this.labels = []; this.projectiles = []; this.waves = []; this.boss = null; this.grid = new NE.Grid();
    this.stats = { food: 0, kills: 0, abilities: 0, events: 0, bosses: 0, distance: 0 }; this.pendingUpgrades = 0; this.offered = [];
    this.spawnTimer = 0; this.trailTimer = 0; this.shake = 0; this.event = null; this.eventIndex = this.biome === 'storm' ? 2 : 0; this.nextEvent = this.biome === 'storm' ? 12 : 40; this.nextBoss = this.sector ? (this.sector.bossTime ?? Infinity) : NE.C.bossTime; this.questIndex = 0; this.tutorialStep = 0;
    this.announcement = null; this.lastHit = null;
    this.quests = [
      { text: 'Соберите 20 частиц энергии', key: 'food', goal: 20, xp: 36, mass: 6 },
      { text: 'Поглотите 4 слабых существа', key: 'kills', goal: 4, xp: 55, mass: 10 },
      { text: 'Используйте способности 5 раз', key: 'abilities', goal: 5, xp: 60, mass: 10 },
      { text: 'Завершите событие арены', key: 'events', goal: 1, xp: 90, mass: 15 },
      { text: 'Эволюционируйте в Спираль', key: 'stage', goal: 2, xp: 100, mass: 20 },
      { text: 'Поглотите 25 существ', key: 'kills', goal: 25, xp: 130, mass: 25 },
      { text: 'Победите Архонта', key: 'bosses', goal: 1, xp: 200, mass: 35 }
    ];
    for (let i = 0; i < (this.biome === 'abyss' ? 260 : 320); i++) this.food.push(NE.Entities.food(undefined, undefined, this.biome === 'reef' && i % 7 === 0));
    // A rich, safe starting patch makes the initial growth responsive.
    for (let i = 0; i < 55; i++) { const angle = i * 2.4, r = 30 + Math.sqrt(i) * 25; this.food.push(NE.Entities.food(this.player.x + Math.cos(angle) * r, this.player.y + Math.sin(angle) * r)); }
    for (let i = 0; i < (this.sector?.population ?? 54); i++) this.spawnEnemy(i % 6);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; this.spawnEnemy(0, this.player.x + Math.cos(a) * 260, this.player.y + Math.sin(a) * 260, 8 + i); }
    this.grid.rebuild(this.food, this.enemies, [this.player]); this.player.invulnerable = tutorial ? 12 : 3;
    if (['storm', 'core'].includes(this.biome)) for (let i = 0; i < (this.biome === 'core' ? 8 : 6); i++) this.terrain.push({ x: 500 + i % 3 * 1050, y: 450 + Math.floor(i / 3) * 780, r: this.biome === 'core' ? 115 : 145, offset: i * 1.2 });
  }
  relation(e) { return this.player.mass >= e.mass * 1.18 ? 'edible' : e.mass >= this.player.mass * 1.18 ? 'danger' : 'equal'; }
  damageMultiplier() { return 1 + this.player.upgrades.damage * .18 + (this.player.skin === 2 ? .08 : 0); }
  growthMultiplier() { return 1 + this.player.upgrades.growth * .18 + (this.player.skin === 4 ? .1 : 0); }
  speed() { const p = this.player; return 190 / (1 + Math.sqrt(p.mass) / 30) * (1 + p.upgrades.speed * .08 + (p.skin === 1 ? .08 : 0)); }
  spawnEnemy(type, x, y, mass) {
    if (this.enemies.filter(e => !e.dead).length >= NE.C.enemyCap) return null;
    const e = NE.Entities.enemy(type, x, y, mass);
    if (this.sector && mass === undefined) { e.mass = NE.clamp(e.mass * this.sector.difficulty, 5, 650); e.r = NE.radius(e.mass); e.hp = e.maxHp = 20 + e.mass * .65; }
    if (x === undefined && NE.distance(e, this.player) < 440) { const a = NE.rand(0, Math.PI * 2); e.x = NE.clamp(this.player.x + Math.cos(a) * 620, e.r, NE.C.width - e.r); e.y = NE.clamp(this.player.y + Math.sin(a) * 620, e.r, NE.C.height - e.r); }
    e.anchor = { x: e.x, y: e.y }; this.enemies.push(e); return e;
  }
  addMass(amount) { this.player.mass = Math.min(5000, this.player.mass + amount * this.growthMultiplier()); }
  addXP(amount) {
    const p = this.player; if (p.level >= 50) { this.score += amount * 3; return; }
    p.xp += amount * (1 + p.upgrades.xp * .15);
    while (p.xp >= p.xpNext && p.level < 50) { p.xp -= p.xpNext; p.level++; p.xpNext = 24 + p.level * 18; this.pendingUpgrades++; this.checkEvolution(); }
    if (this.pendingUpgrades && this.state === 'running') NE.UI.showUpgrade(this);
  }
  checkEvolution() {
    const p = this.player, stage = NE.forms.reduce((current, f, i) => p.level >= f.level ? i : current, 0);
    if (stage <= p.stage) return;
    p.stage = stage; p.maxHp += 15; p.hp = Math.min(p.maxHp, p.hp + 35); p.maxEnergy += 8; p.energy = p.maxEnergy; this.addMass(8 + stage * 5);
    this.announce('ЭВОЛЮЦИЯ · ' + NE.forms[stage].name.toUpperCase(), stage === 1 ? 'ОТКРЫТ ФАЗОВЫЙ СДВИГ · E' : stage === 2 ? 'ОТКРЫТ ГРАВИТАЦИОННЫЙ ВИХРЬ · R' : 'НОВАЯ ФОРМА · БОЛЬШЕ ЖИЗНИ И ЭНЕРГИИ', NE.forms[stage].color);
    this.ring(p.x, p.y, NE.forms[stage].color, 230, 1.3); this.burst(p.x, p.y, NE.forms[stage].color, 60); NE.Audio.play('evolve'); NE.Save.unlockForm(stage); NE.UI.toast(`ЭВОЛЮЦИЯ · ${NE.forms[stage].name}. ${stage === 1 ? 'Открыт фазовый сдвиг [E]' : stage === 2 ? 'Открыт вихрь [R]' : 'Вы становитесь сильнее!'}`);
    if (stage >= 2) NE.Save.achievement('helix'); if (stage === 4) NE.Save.achievement('sovereign');
  }
  applyUpgrade(id) {
    const p = this.player, item = NE.upgrades.find(u => u.id === id);
    if (!item || p.upgrades[id] >= item.max || !this.offered.includes(id) || !this.pendingUpgrades || this.state !== 'upgrade') return false;
    p.upgrades[id]++;
    if (id === 'capacity') { p.maxEnergy += 20; p.energy = Math.min(p.maxEnergy, p.energy + 20); }
    if (id === 'vitality') { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25); }
    this.pendingUpgrades--; NE.Audio.play('achievement');
    if (this.pendingUpgrades) NE.UI.showUpgrade(this); else { this.state = 'running'; NE.UI.closeOverlay(); NE.Input.reset(); }
    return true;
  }
  collect(f) {
    if (f.dead) return; f.dead = true; const p = this.player; this.stats.food++; this.score += f.special ? 25 : 10; this.addMass(f.mass);
    p.energy = Math.min(p.maxEnergy, p.energy + (f.special ? 5 : 2)); p.hp = Math.min(p.maxHp, p.hp + .6);
    if (f.special && this.event?.type === 'bloom') this.event.progress++;
    this.burst(f.x, f.y, f.special ? '#e2ff91' : '#a6ffce', 3, p); NE.Audio.play('collect'); NE.Save.achievement('first'); this.addXP(f.xp);
  }
  absorb(e) {
    if (e.dead) return; e.dead = true; const p = this.player, xp = Math.min(NE.C.preyXpCap, e.mass * .7 + 5);
    this.stats.kills++; this.score += Math.ceil(e.mass * 11); this.addMass(Math.min(NE.C.preyMassCap, e.mass * .22));
    p.energy = Math.min(p.maxEnergy, p.energy + 15); p.hp = Math.min(p.maxHp, p.hp + 5);
    if (e.migration && this.event?.type === 'migration') this.event.progress++;
    this.burst(e.x, e.y, NE.species[e.type].color, 18, p); this.ring(e.x, e.y, '#a6ffce', e.r * 2.5, .4); this.label(e.x, e.y, '+' + Math.round(xp * (1 + p.upgrades.xp * .15)) + ' XP'); NE.Audio.play('absorb');
    NE.Save.achievement('predator'); if (this.stats.kills >= 25) NE.Save.achievement('hunter'); this.addXP(xp);
  }
  hurt(amount, source = { kind: 'unknown' }) {
    const p = this.player; if (p.dead || p.invulnerable > 0 || p.phase > 0 || this.state === 'result') return false;
    const reduction = NE.clamp(p.upgrades.armor * .1 + (p.skin === 3 ? .08 : 0), 0, .58), damage = amount * (1 - reduction);
    this.lastHit = { kind: source.kind, type: source.type, damage: Math.ceil(damage), time: this.time };
    p.hp = Math.max(0, p.hp - damage); p.invulnerable = .75; p.flash = .25; this.shake = .7; this.burst(p.x, p.y, '#ff6a9b', 12); this.label(p.x, p.y - p.r, '−' + Math.ceil(damage), '#ff6a9b'); NE.Audio.play('hurt');
    if (p.hp <= 0) { p.dead = true; this.burst(p.x, p.y, NE.forms[p.stage].color, 65); this.end(false); } return true;
  }
  damageEnemy(e, amount) {
    if (e.dead) return; e.hp -= amount * (e.kind === 'enemy' && e.type === 4 ? .6 : 1); e.flash = .1;
    if (e.hp <= 0) {
      if (e.kind === 'boss') {
        e.dead = true; this.stats.bosses++; this.score += 5000; this.burst(e.x, e.y, '#ff84ba', 90); this.ring(e.x, e.y, '#fff3cb', 500, 1.7); NE.Audio.play('win'); NE.Save.achievement('boss');
        this.finishHealthRatio = this.player.hp / this.player.maxHp;
        this.projectiles = []; this.waves = []; this.player.hp = this.player.maxHp; this.player.energy = this.player.maxEnergy; this.nextBoss = this.time + 150;
        if (this.mode !== 'endless') { this.checkQuest(); this.end(true); } else { this.boss = null; this.addMass(60); this.addXP(220); NE.UI.toast('Архонт повержен! Следующая охота через 2:30.'); }
      } else if (this.player.mass >= e.mass * .85) this.absorb(e);
      else {
        e.dead = true; this.score += Math.ceil(e.mass * 5); this.burst(e.x, e.y, '#ffcc9d', 16); const room = NE.C.foodCap - this.food.filter(f => !f.dead).length;
        for (let i = 0; i < Math.min(room, 12); i++) this.food.push(NE.Entities.food(e.x + NE.rand(-35, 35), e.y + NE.rand(-35, 35), true)); this.addXP(12);
      }
    }
  }
  useAbility(id) {
    const p = this.player, ability = NE.abilities[id];
    if (!ability || this.state !== 'running') return false;
    if (p.level < ability.level) { NE.UI.toast(`${ability.name}: нужен уровень ${ability.level}`); return false; }
    if (p.cooldowns[id] > 0) return false;
    if (p.energy < ability.cost) { NE.UI.toast('Не хватает энергии. Соберите светящиеся частицы.', true); return false; }
    p.energy -= ability.cost; p.cooldowns[id] = ability.cooldown * Math.max(.5, 1 - p.upgrades.cooldown * .1); this.stats.abilities++; NE.Audio.play(id);
    if (id === 'pulse') {
      const radius = (140 + p.r) * (1 + p.upgrades.pulse * .22); this.ring(p.x, p.y, '#4ce6e0', radius, .65); this.burst(p.x, p.y, '#4ce6e0', 20);
      for (const e of this.grid.query(p.x, p.y, radius + 100)) if ((e.kind === 'enemy' || e.kind === 'boss') && NE.distance(p, e) < radius + e.r) {
        const d = NE.distance(p, e) || 1;
        if (e.kind !== 'boss') { e.knockX = (e.x - p.x) / d * 330; e.knockY = (e.y - p.y) / d * 330; }
        this.damageEnemy(e, (30 + p.mass * .28) * (1 + p.upgrades.pulse * .15) * this.damageMultiplier());
        if (this.state === 'result') break;
      }
    } else if (id === 'phase') { p.phase = 2.2 + p.upgrades.phase * .6; p.phaseHits.clear(); this.ring(p.x, p.y, '#d7ffff', p.r * 4, .55); }
    else { p.vortex = 3.6; this.ring(p.x, p.y, '#b4a1ff', 210 * (1 + p.upgrades.vortex * .22), .5); }
    return true;
  }
  startEvent(type) {
    if (!['bloom', 'migration', 'storm'].includes(type)) return;
    const p = this.player, x = NE.clamp(p.x + NE.rand(-360, 360), 270, NE.C.width - 270), y = NE.clamp(p.y + NE.rand(-360, 360), 270, NE.C.height - 270);
    this.event = { type, x, y, r: 260, age: 0, duration: 30, progress: 0, completed: false, zones: [] };
    if (type === 'bloom') {
      // Replace ordinary food only when needed to respect the global cap.
      this.food = this.food.filter(f => !f.dead).slice(0, NE.C.foodCap - 55);
      for (let i = 0; i < 55; i++) { const a = NE.rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * 250; this.food.push(NE.Entities.food(x + Math.cos(a) * r, y + Math.sin(a) * r, true)); }
      NE.UI.toast('Энергетический расцвет: соберите 12 золотых частиц!');
    } else if (type === 'migration') {
      for (let i = 0; i < 10; i++) { const e = this.spawnEnemy(0, x + NE.rand(-170, 170), y + NE.rand(-170, 170), Math.max(5, p.mass * NE.rand(.25, .65))); if (e) { e.migration = true; e.wander = { x: NE.clamp(x + 550, 60, NE.C.width - 60), y }; } }
      NE.UI.toast('Миграция: догоните и поглотите 3 странников!');
    } else {
      for (let i = 0; i < 3; i++) this.event.zones.push({ x: NE.clamp(p.x + (i - 1) * 280, 220, NE.C.width - 220), y: NE.clamp(p.y + NE.rand(-250, 250), 220, NE.C.height - 220), r: 180 + i * 35 });
      NE.UI.toast('Ионная буря: избегайте розовых полей 30 секунд.', true);
    }
  }
  updateEvent(dt) {
    const event = this.event; if (!event) return; event.age += dt;
    if (event.type === 'storm' && event.age > 2) for (const z of event.zones) if (NE.distance(this.player, z) < z.r && this.player.phase <= 0) this.hurt(12, { kind: 'storm' });
    if (!event.completed && ((event.type === 'bloom' && event.progress >= 12) || (event.type === 'migration' && event.progress >= 3) || (event.type === 'storm' && event.age >= event.duration))) {
      if (this.state === 'result') return;
      event.completed = true; this.stats.events++; this.score += 600; this.addMass(10); this.player.hp = Math.min(this.player.maxHp, this.player.hp + 18); this.player.energy = this.player.maxEnergy; this.addXP(55); NE.Save.achievement('event'); if (event.type === 'storm') NE.Save.achievement('storm'); NE.UI.toast('Событие завершено · +600 очков · +55 XP'); NE.Audio.play('achievement');
    }
    if (event.age >= event.duration) { this.event = null; this.nextEvent = this.time + 35; }
  }
  checkQuest() {
    const q = this.quests[this.questIndex]; if (!q) return;
    const current = q.key === 'stage' ? this.player.stage : this.stats[q.key];
    if (current >= q.goal) { this.questIndex++; this.score += 300; this.addMass(q.mass); this.addXP(q.xp); this.player.hp = Math.min(this.player.maxHp, this.player.hp + 12); NE.UI.toast(`Задача выполнена · +${q.xp} XP · +${q.mass} массы`); }
  }
  spawnBoss() { if (this.boss && !this.boss.dead) return; this.boss = NE.Entities.boss(this); if (this.biome === 'core') { this.boss.hp *= 1.35; this.boss.maxHp = this.boss.hp; this.boss.empowered = true; } this.announce(this.boss.empowered ? 'ВЕРХОВНЫЙ АРХОНТ' : 'АРХОНТ ПРОБУДИЛСЯ', 'АТАКУЙТЕ СПОСОБНОСТЯМИ · УХОДИТЕ ИЗ КОРИДОРА РЫВКА', '#ff719f'); this.ring(this.boss.x, this.boss.y, '#ff6a9b', 350, 1.5); NE.UI.toast(`${this.biome === 'core' ? 'ВЕРХОВНЫЙ ' : ''}АРХОНТ ПРОБУДИЛСЯ. Атакуйте способностями, уклоняйтесь от рывков.`, true); NE.Audio.play('hurt'); }
  currentAt(x, y) { return this.biome === 'current' ? { x: Math.sin(y / 260 + this.time * .12) * 25, y: Math.cos(x / 380 - this.time * .1) * 18 } : { x: 0, y: 0 }; }
  terrainActive(zone) { return (this.time + zone.offset) % 9 >= 2.3; }
  updateTerrain() { for (const zone of this.terrain) if (this.terrainActive(zone) && NE.distance(this.player, zone) < zone.r && this.player.phase <= 0) this.hurt(this.biome === 'core' ? 17 : 13, { kind: 'field' }); }
  announce(title, detail, color) { this.announcement = { title, detail, color, life: 3.4 }; }
  projectile(x, y, angle, speed, damage) { if (this.projectiles.length >= NE.C.projectileCap) return; this.projectiles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: 5, damage, life: 6, dead: false }); }
  wave(x, y, radius, damage) { if (this.waves.length < 6) this.waves.push({ x, y, r: 0, maxR: radius, damage, hit: false }); }
  burst(x, y, color, count, target) {
    const quality = NE.Save.data.settings.quality, cap = quality === 'high' ? NE.C.particleCap : quality === 'medium' ? 180 : 65;
    count = Math.ceil(count * (quality === 'low' ? .35 : quality === 'medium' ? .65 : 1));
    for (let i = 0; i < count && this.particles.length < cap; i++) { const a = NE.rand(0, Math.PI * 2), speed = NE.rand(20, 145), life = NE.rand(.3, .9); this.particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, color, life, maxLife: life, r: NE.rand(1, 3.5), target }); }
  }
  ring(x, y, color, radius, life) { if (this.rings.length < 28) this.rings.push({ x, y, color, radius, life, maxLife: life }); }
  label(x, y, text, color = '#a6ffce') { if (this.labels.length < 24) this.labels.push({ x, y, text, color, life: 1.2 }); }
  updateEffects(dt) {
    if (this.announcement) this.announcement.life = Math.max(0, this.announcement.life - dt);
    for (const particle of this.particles) { particle.life -= dt; if (particle.target && particle.life < particle.maxLife * .75) { particle.x += (particle.target.x - particle.x) * (1 - Math.exp(-10 * dt)); particle.y += (particle.target.y - particle.y) * (1 - Math.exp(-10 * dt)); } else { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vx *= Math.exp(-3 * dt); particle.vy *= Math.exp(-3 * dt); } }
    this.particles = this.particles.filter(p => p.life > 0); this.rings.forEach(r => r.life -= dt); this.rings = this.rings.filter(r => r.life > 0); this.labels.forEach(l => { l.life -= dt; l.y -= 22 * dt; }); this.labels = this.labels.filter(l => l.life > 0); this.shake = Math.max(0, this.shake - dt * 2);
  }
  update(dt) {
    if (this.state !== 'running') return;
    const p = this.player; this.time += dt; this.score += dt * 2; p.invulnerable = Math.max(0, p.invulnerable - dt); p.flash = Math.max(0, p.flash - dt); p.phase = Math.max(0, p.phase - dt); p.vortex = Math.max(0, p.vortex - dt);
    for (const id of Object.keys(p.cooldowns)) p.cooldowns[id] = Math.max(0, p.cooldowns[id] - dt);
    const dir = NE.Input.direction(), moving = Math.hypot(dir.x, dir.y) > .08;
    if (p.energy < 1) p.boostExhausted = true; if (p.energy >= 12) p.boostExhausted = false;
    p.boosting = NE.Input.boosting() && moving && !p.boostExhausted && p.energy > 1;
    let speed = this.speed(); if (p.boosting) speed *= 1.85 + p.upgrades.boost * .12; if (p.phase > 0) speed *= 1.6;
    const smooth = 1 - Math.exp(-12 * dt); p.vx += (dir.x * speed - p.vx) * smooth; p.vy += (dir.y * speed - p.vy) * smooth;
    const flow = this.currentAt(p.x, p.y);
    const ox = p.x, oy = p.y; p.x = NE.clamp(p.x + (p.vx + flow.x) * dt, p.r + 4, NE.C.width - p.r - 4); p.y = NE.clamp(p.y + (p.vy + flow.y) * dt, p.r + 4, NE.C.height - p.r - 4); this.stats.distance += Math.hypot(p.x - ox, p.y - oy);
    if (moving) p.angle = Math.atan2(p.vy, p.vx);
    p.energy = NE.clamp(p.energy + (p.boosting ? -21 * Math.max(.5, 1 - p.upgrades.boost * .1) : 7 + p.upgrades.regen * 1.8) * dt, 0, p.maxEnergy);
    p.hp = Math.min(p.maxHp, p.hp + (.12 + p.upgrades.heal * .7) * dt); p.r += (NE.radius(p.mass) - p.r) * (1 - Math.exp(-2.2 * dt));
    this.grid.rebuild(this.food, this.enemies, [p], this.boss && !this.boss.dead ? [this.boss] : []);
    for (const e of this.enemies) if (!e.dead) { NE.AI.update(e, this, dt); const drift = this.currentAt(e.x, e.y); e.x = NE.clamp(e.x + drift.x * dt, e.r, NE.C.width - e.r); e.y = NE.clamp(e.y + drift.y * dt, e.r, NE.C.height - e.r); }
    if (this.boss && !this.boss.dead) NE.AI.boss(this.boss, this, dt);
    this.grid.rebuild(this.food, this.enemies, [p], this.boss && !this.boss.dead ? [this.boss] : []);
    NE.Collisions.food(this, dt); if (this.state === 'result') return;
    NE.Collisions.actors(this, dt); if (this.state === 'result') return;
    for (const shot of this.projectiles) { shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.life -= dt; if (shot.life <= 0 || shot.x < 0 || shot.x > NE.C.width || shot.y < 0 || shot.y > NE.C.height) shot.dead = true; }
    this.projectiles = this.projectiles.filter(s => !s.dead); this.waves.forEach(w => w.r += 230 * dt); this.waves = this.waves.filter(w => w.r < w.maxR);
    this.updateEvent(dt); this.updateTerrain(); if (this.state === 'result') return; this.checkQuest(); this.updateEffects(dt);
    this.food = this.food.filter(f => !f.dead); this.enemies = this.enemies.filter(e => !e.dead);
    this.spawnTimer += dt;
    if (this.spawnTimer > .7) {
      this.spawnTimer = 0;
      const count = Math.min(24, (this.sector?.food ?? 340) - this.food.length);
      for (let i = 0; i < count; i++) { if (i % 3 === 0) { const a = NE.rand(0, Math.PI * 2), radius = NE.rand(110, 650); this.food.push(NE.Entities.food(NE.clamp(p.x + Math.cos(a) * radius, 20, NE.C.width - 20), NE.clamp(p.y + Math.sin(a) * radius, 20, NE.C.height - 20))); } else this.food.push(NE.Entities.food()); }
      if (this.enemies.length < (this.sector?.population ?? 58) + Math.min(this.sector ? 12 : 16, Math.floor(this.time / 30))) {
        const type = Math.floor(NE.rand(0, 6)), scale = (1 + this.time / 750) * (this.sector?.difficulty ?? 1); const mass = Math.random() < .5 ? NE.rand(p.mass * .3, p.mass * .82) : NE.rand(...NE.species[type].mass) * scale; this.spawnEnemy(type, undefined, undefined, NE.clamp(mass, 5, 650));
      }
    }
    if (!this.event && this.time >= this.nextEvent) this.startEvent(['bloom', 'migration', 'storm'][this.eventIndex++ % 3]);
    const bossEnabled = !this.sector || this.sector.bossTime !== null;
    if (bossEnabled && (!this.boss || this.boss.dead) && (this.time >= this.nextBoss || (p.stage === 4 && this.stats.bosses === 0))) this.spawnBoss();
    if (this.time >= 180) NE.Save.achievement('survivor'); if (this.score >= 10000) NE.Save.achievement('score');
    this.trailTimer += dt; if (this.trailTimer > .07) { this.trailTimer = 0; p.trail.push({ x: p.x, y: p.y }); if (p.trail.length > 18) p.trail.shift(); for (const e of this.enemies) { e.trail.push({ x: e.x, y: e.y }); if (e.trail.length > 7) e.trail.shift(); } if (p.boosting) this.burst(p.x - Math.cos(p.angle) * p.r, p.y - Math.sin(p.angle) * p.r, '#4ce6e0', 2); }
    if (this.tutorial) this.updateTutorial();
    if (this.sector && this.state === 'running' && NE.Progress.campaignProgress(this).complete) this.end(true);
  }
  updateTutorial() {
    const conditions = [this.stats.distance > 120, this.stats.food >= 5, this.player.boosting && this.player.energy < 80, this.stats.abilities >= 1, this.stats.kills >= 1];
    if (conditions[this.tutorialStep]) { this.tutorialStep++; NE.UI.updateTutorial(this); }
  }
  end(win) {
    if (this.state === 'result') return; this.state = 'result'; this.win = win; this.pendingUpgrades = 0; NE.Input.reset(); if (this.score >= 10000) NE.Save.achievement('score'); this.saved = NE.Save.record(this, win); NE.UI.result(this, win);
  }
};
