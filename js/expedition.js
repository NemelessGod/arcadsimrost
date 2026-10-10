'use strict';
// A mission owns its objectives, solid terrain and story; Game still owns simulation/combat.
NE.Expedition = class {
  constructor(game) {
    this.game = game; this.id = game.sector.id; this.phase = 'gather'; this.found = []; this.storyQueue = []; this.story = null;
    this.objects = []; this.obstacles = []; this.hazards = []; this.exit = { x: 3180, y: 2180, r: 75, kind: 'exit', name: 'ШЛЮЗ' };
    this.defense = null; this.waveTimer = 8; this.age = 0; this.trialAge = 0;
    const layouts = [
      [[950, 730], [2630, 820], [2550, 1970]],
      [[650, 570], [2950, 620], [2920, 1990], [680, 2050]],
      [[650, 530], [1900, 430], [3000, 740], [2840, 2050], [700, 2060]],
      [[700, 550], [2900, 550], [2880, 2070], [700, 2070]],
      [[800, 610], [2870, 720], [2150, 2170]]
    ];
    layouts[this.id].forEach(([x, y], i) => this.objects.push({ id: 'mission-' + i, kind: 'target', x, y, r: this.id === 1 ? 44 : 30, name: ['РЕЛЕ', 'ОЧАГ', 'ПАМЯТЬ', 'УЗЕЛ', 'ПЕЧАТЬ'][this.id] + ' ' + (i + 1), charge: 0, duration: [6, 40, 18, 25, 40][this.id], hp: this.id === 1 ? 720 : 0, maxHp: this.id === 1 ? 720 : 0, dead: false, disabled: this.id !== 1, active: false, seed: i }));
    const pillars = [[1280, 670, 115], [2260, 640, 135], [1050, 1550, 155], [2350, 1480, 160], [1610, 2060, 140], [500, 1350, 120], [3150, 1420, 150], [1750, 850, 80], [1600, 480, 100], [1250, 2260, 100], [2550, 2330, 105], [400, 500, 95], [3300, 420, 90], [2120, 1780, 100]];
    pillars.slice(0, this.id === 0 ? 7 : this.id === 2 ? 14 : 12).forEach(([x, y, r]) => this.obstacles.push({ kind: 'obstacle', x, y, r, seed: this.obstacles.length }));
    this.solidGrid = new NE.Grid(240); this.solidGrid.rebuild(this.obstacles);
    if (this.id === 2 || this.id === 4) this.objects.forEach((o, i) => this.hazards.push({ x: o.x + 100, y: o.y + 50, r: this.id === 2 ? 180 : 145, offset: i * 2.1, period: this.id === 2 ? 12 : 10 }));
    if (this.id === 1) this.objects.forEach(o => this.hazards.push({ x: o.x, y: o.y, r: 190, nest: o }));
    game.terrain = []; game.questIndex = game.quests.length; game.nextBoss = Infinity; game.nextEvent = 70; game.eventIndex = 0;
    const genes = NE.Save.data.expedition.upgrades;
    game.player.maxHp += genes.defense * 8; game.player.hp = game.player.maxHp; game.player.invulnerable = this.id === 0 ? 12 : 6;
    game.food = game.food.filter(f => this.passable(f));
    for (const e of game.enemies) this.resolve(e);
    this.say('НЕИЗВЕСТНЫЙ ОПЕРАТОР', ['NE-002, ты слышишь? Собирай свет. Не спеши нападать на крупные организмы.', 'Очаги держат сад в петле. Разрушь оболочки импульсом, затем останься рядом для очистки.', 'В осколках осталась память. Жди безопасного окна: кольцо предупредит о разряде.', 'Узлы питают реактор. Активируй их по очереди, затем вернись в центр для защиты.', 'Сними печати. Источник считает любой свободный организм ошибкой.'][this.id]);
  }
  say(speaker, text) { this.storyQueue.push({ speaker, text, life: 8 }); if (this.storyQueue.length > 6) this.storyQueue.shift(); }
  remember(id) {
    const entry = NE.memory.find(m => m.id === id), saved = NE.Save.data.expedition;
    if (!entry || saved.entries.includes(id)) return;
    saved.entries.push(id); this.found.push(id); NE.Save.persist(); this.say('ЗАПИСЬ / ' + entry.title, entry.text); NE.Audio.play('achievement');
  }
  firstEntry() { return ['cradle-awake', 'garden-root', 'shards-memory', 'reactor-restore', 'core-truth'][this.id]; }
  lastEntry() { return ['cradle-exit', 'garden-exit', 'shards-exit', 'reactor-exit', 'core-exit'][this.id]; }
  passable(e) { return !this.solidGrid.query(e.x, e.y, 240).some(o => NE.distance(e, o) < o.r + (e.r || 8) + 6); }
  resolve(e) {
    if (e.kind === 'player' && e.phase > 0) return;
    for (const o of this.solidGrid.query(e.x, e.y, (e.r || 0) + 180)) {
      const d = NE.distance(e, o), reach = o.r + e.r + 2;
      if (d >= reach) continue;
      const dx = d > .01 ? (e.x - o.x) / d : 1, dy = d > .01 ? (e.y - o.y) / d : 0;
      e.x = NE.clamp(o.x + dx * reach, e.r, NE.C.width - e.r); e.y = NE.clamp(o.y + dy * reach, e.r, NE.C.height - e.r);
    }
  }
  steer(e, dx, dy) {
    const length = Math.hypot(dx, dy) || 1, ux = dx / length, uy = dy / length;
    for (const o of this.solidGrid.query(e.x, e.y, e.r + 300)) {
      const ox = o.x - e.x, oy = o.y - e.y, forward = ox * ux + oy * uy, side = ox * -uy + oy * ux, reach = o.r + e.r + 26;
      if (forward > 0 && forward < reach + 160 && Math.abs(side) < reach) {
        const direction = side > 0 ? -1 : 1; return { x: ux - uy * direction * 1.6, y: uy + ux * direction * 1.6 };
      }
    }
    return { x: dx, y: dy };
  }
  hazardActive(z) { return z.nest ? !z.nest.dead : (this.game.time + z.offset) % z.period >= (this.id === 2 ? 6 : 5); }
  hazardWarning(z) { const age = (this.game.time + (z.offset || 0)) % (z.period || 1); return !z.nest && age >= (this.id === 2 ? 3 : 2) && age < (this.id === 2 ? 6 : 5); }
  slowAt(p) { return this.id === 1 && this.hazards.some(z => !z.nest.dead && NE.distance(p, z) < z.r) ? .65 : 1; }
  damageTarget(o, amount) {
    if (this.phase !== 'objectives' || o.dead || o.disabled) return;
    o.hp = Math.max(0, o.hp - amount); o.flash = .15;
    if (!o.hp) { o.disabled = true; this.game.burst(o.x, o.y, '#c0ff87', 28); this.say('ОПЕРАТОР', 'Оболочка разрушена. Останься в кольце: энергия завершит очистку.'); }
  }
  startTrial() {
    if (this.phase !== 'objectives') return;
    this.phase = 'trial'; this.trialAge = 0; this.remember(this.firstEntry());
    this.game.player.hp = Math.min(this.game.player.maxHp, this.game.player.hp + 30); this.game.player.energy = this.game.player.maxEnergy;
    if (this.id === 1 || this.id === 4) {
      this.game.spawnBoss(); const b = this.game.boss;
      b.name = this.id === 1 ? 'МАТКА САДА' : 'ИСТОЧНИК'; b.hp = b.maxHp = (this.id === 1 ? 1800 : 3200) + this.game.player.mass * (this.id === 1 ? 1.5 : 2.2); b.phaseAge = 0; b.storyBoss = true;
      this.say('ОПЕРАТОР', this.id === 1 ? 'Матка отсечена от очагов. Следи за коридором рывка; между атаками её оболочка уязвима.' : 'Источнику нечего скрывать. Переживи каждую фазу, бей в окна между атаками. Память нельзя стереть.');
    } else {
      const maxHp = (this.id === 3 ? 320 : 260) + NE.Save.data.expedition.upgrades.defense * 10;
      this.defense = { kind: 'defense', x: 1800, y: this.id === 0 ? 520 : 1300, r: 65, hp: maxHp, maxHp, progress: 0, duration: [45, 0, 65, 130][this.id], name: this.id === 0 ? 'ПУСК ШЛЮЗА' : this.id === 2 ? 'ПЕРЕДАЧА ПАМЯТИ' : 'РЕАКТОР' };
      this.waveTimer = 2;
      this.say('ОПЕРАТОР', 'Вернись к отмеченной системе. Перезапуск идёт, пока ты рядом. Отбрасывай диверсантов; близость восстанавливает прочность.');
    }
  }
  bossDefeated() { if (this.phase === 'trial') this.openExit(); }
  openExit() {
    this.phase = 'exit'; this.defense = null; this.game.projectiles = []; this.game.waves = [];
    this.remember(this.lastEntry()); this.game.announce('ВЫХОД ОТКРЫТ', 'ДОБЕРИТЕСЬ ДО БИРЮЗОВОГО ШЛЮЗА · НАГРАДА ПОСЛЕ ЭВАКУАЦИИ', this.game.sector.color);
    this.say('ОПЕРАТОР', 'Выход открыт. Дойди до шлюза: только эвакуация завершает миссию. Записи уже сохранены.');
    this.game.ring(this.exit.x, this.exit.y, '#88ffe1', 300, 1.2);
  }
  nearest() {
    if (this.phase === 'exit') return this.exit;
    if (this.phase === 'trial') return this.defense || (this.game.boss?.dead ? null : this.game.boss);
    if (this.phase === 'gather') return null;
    return this.objects.filter(o => !o.dead).sort((a, b) => NE.distance(this.game.player, a) - NE.distance(this.game.player, b))[0] || null;
  }
  progress() {
    const g = this.game, p = g.player, s = g.sector;
    if (this.phase === 'gather') return { title: 'Соберите энергию и эволюционируйте', fraction: (Math.min(1, g.stats.food / s.energy) + Math.min(1, p.level / s.level)) / 2, label: `Энергия ${Math.min(s.energy, g.stats.food)}/${s.energy} · ур. ${p.level}/${s.level}`, complete: false };
    if (this.phase === 'objectives') { const done = this.objects.filter(o => o.dead).length, o = this.nearest(); return { title: ['Восстановите три реле', 'Очистите четыре очага', 'Найдите пять фрагментов', 'Активируйте четыре узла', 'Снимите три печати'][this.id], fraction: (done + this.objects.filter(o => !o.dead).reduce((n, o) => n + o.charge / o.duration, 0)) / this.objects.length, label: `${done}/${this.objects.length} · ${o?.name || ''}: ${o?.hp > 0 ? Math.ceil(o.hp) + ' HP · Q/E/R' : Math.floor(o?.charge || 0) + '/' + (o?.duration || 0) + ' с · рядом'}`, complete: false }; }
    if (this.phase === 'trial') { const d = this.defense, b = g.boss; return { title: d ? 'Защитите ' + d.name.toLowerCase() : 'Победите ' + (b?.name || 'стража'), fraction: d ? d.progress / d.duration : 1 - (b?.hp || 0) / (b?.maxHp || 1), label: d ? `${NE.time(d.progress)}/${NE.time(d.duration)} · система ${Math.ceil(d.hp)}/${d.maxHp}${NE.distance(p, d) > 370 ? ' · вернитесь!' : ' · ремонт'}` : `Фаза ${b?.phase || 1}/3 · уклоняйтесь от коридора и волн`, complete: false }; }
    return { title: 'Доберитесь до открытого выхода', fraction: 1, label: `Шлюз ↗ ${Math.round(NE.distance(p, this.exit))} м · записи сохранены`, complete: false };
  }
  update(dt) {
    const g = this.game, p = g.player; this.age += dt;
    if (this.story) { this.story.life -= dt; if (this.story.life <= 0) this.story = null; }
    if (!this.story && this.storyQueue.length) this.story = this.storyQueue.shift();
    for (const z of this.hazards) if (this.hazardActive(z) && !z.nest && NE.distance(p, z) < z.r) g.hurt(this.id === 4 ? 14 : 11, { kind: 'field' });
    if (g.state === 'result') return;
    if (this.phase === 'gather') {
      if (g.stats.food >= g.sector.energy && p.level >= g.sector.level) {
        this.phase = 'objectives'; this.objects.forEach(o => o.active = true); this.say('ОПЕРАТОР', ['Ты пробудился. Найди три реле на карте; зарядка идёт сама, когда ты рядом.', 'Сеть открылась. Четыре очага отмечены на карте: сначала оболочка, затем очистка.', 'Канал памяти открыт. Найди все пять осколков; частичная загрузка сохраняется между разрядами.', 'Достигни четырёх узлов. Загрузка расходует энергию и прерывается при ударе.', 'Три печати отключат защиту Источника. Канал включается при приближении.'][this.id]);
        if (!this.id) this.remember('cradle-awake');
        if (this.id) this.objects.forEach((o, i) => { for (let n = 0; n < 2; n++) g.spawnEnemy(this.id === 1 ? 2 : this.id === 4 ? 5 : 4, o.x + (n ? 150 : -150), o.y + 120, 55 + this.id * 35 + i * 12); });
      }
    } else if (this.phase === 'objectives') {
      for (const o of this.objects) if (!o.dead) {
        o.flash = Math.max(0, (o.flash || 0) - dt);
        const d = NE.distance(p, o);
        const hazardous = this.hazards.some(z => !z.nest && this.hazardActive(z) && NE.distance(p, z) < z.r) || this.id === 2 && this.hazardActive(this.hazards[o.seed]);
        if (o.disabled && d < p.r + o.r + 60 && !hazardous && p.energy > 4 * dt && g.time - (g.lastHit?.time ?? -10) > .8) {
          p.energy -= 4 * dt; o.charge = Math.min(o.duration, o.charge + dt);
          if (o.charge >= o.duration) { o.dead = true; g.score += 400; g.addXP(80); p.hp = Math.min(p.maxHp, p.hp + 16); g.ring(o.x, o.y, g.sector.color, 200, .8); g.burst(o.x, o.y, g.sector.color, 24); this.say('СИСТЕМА', `${o.name}: восстановлено. ${this.objects.filter(o => o.dead).length}/${this.objects.length}.`); }
        }
        if (this.id === 1 && !o.disabled && Math.floor(this.age / 22) > Math.floor((this.age - dt) / 22)) g.spawnEnemy(2, o.x + 120, o.y, 35 + Math.min(150, g.time * .22));
      }
      if (g.state === 'running' && this.objects.every(o => o.dead)) this.startTrial();
    } else if (this.phase === 'trial') {
      this.trialAge += dt;
      const d = this.defense;
      if (d) {
        if (NE.distance(p, d) < 370) { d.started = true; d.progress += dt; d.hp = Math.min(d.maxHp, d.hp + (1.6 + p.upgrades.heal * .6 + p.upgrades.armor * .25) * dt); }
        for (const e of g.grid.query(d.x, d.y, d.r + 130, 'enemy')) if (e.saboteur && !e.dead && NE.distance(e, d) < e.r + d.r + 12) d.hp -= (this.id === 0 ? 3 : 3.5) * (1 - p.upgrades.armor * .07) * dt;
        if (d.hp <= 0) { g.lastHit = { kind: 'reactor', time: g.time }; g.end(false); return; }
        if (d.started) this.waveTimer -= dt;
        if (this.waveTimer <= 0) {
          this.waveTimer = this.id === 0 ? 11 : 9;
          for (let i = 0; i < (this.id === 0 ? 2 : 3); i++) {
            const a = this.trialAge * .4 + i * 2.1;
            const e = g.spawnEnemy(i === 2 ? 3 : 2, NE.clamp(d.x + Math.cos(a) * 620, 90, NE.C.width - 90), NE.clamp(d.y + Math.sin(a) * 620, 90, NE.C.height - 90), NE.clamp(p.mass * (i === 2 ? 1.25 : .55), 16, 720));
            if (e) { g.ring(e.x, e.y, '#ff719f', 100, 1.2); e.saboteur = true; e.target = d; e.state = 'hunt'; }
          }
        }
        if (d.progress >= d.duration) this.openExit();
      }
    } else if (this.phase === 'exit' && NE.distance(p, this.exit) < p.r + this.exit.r - 15) {
      g.finishHealthRatio = p.hp / p.maxHp; g.end(true);
    }
  }
};
