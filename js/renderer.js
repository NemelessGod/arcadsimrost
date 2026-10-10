'use strict';
NE.Renderer = class {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false }); this.width = 0; this.height = 0; this.dpr = 1;
    this.camera = { x: NE.C.width / 2, y: NE.C.height / 2, zoom: 1 }; this.menuTime = 0; this.mapTimer = 0;
    this.decor = Array.from({ length: 40 }, (_, i) => ({ x: (Math.sin(i * 74.2) * .5 + .5) * NE.C.width, y: (Math.cos(i * 91.7) * .5 + .5) * NE.C.height, r: 12 + (i % 5) * 8, seed: i * 6.7 }));
    this.menuFood = Array.from({ length: 55 }, () => ({ x: Math.random(), y: Math.random(), r: NE.rand(1, 3), seed: NE.rand(0, 20) }));
    this.resize(); window.addEventListener('resize', () => this.resize());
  }
  resize() {
    this.width = window.innerWidth; this.height = window.innerHeight;
    const quality = NE.Save.data.settings.quality;
    this.dpr = Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : quality === 'medium' ? 1.5 : 1);
    this.canvas.width = Math.round(this.width * this.dpr); this.canvas.height = Math.round(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }
  glow(color, amount) { this.ctx.shadowColor = color; this.ctx.shadowBlur = NE.Save.data.settings.quality === 'low' ? 0 : amount; }
  circle(x, y, r, color, stroke = false) { const c = this.ctx; c.beginPath(); c.arc(x, y, Math.max(.1, r), 0, Math.PI * 2); if (stroke) { c.strokeStyle = color; c.stroke(); } else { c.fillStyle = color; c.fill(); } }
  organism(e, color, time, player = false, menu = false) {
    const c = this.ctx, r = e.r, shape = player ? e.stage : NE.species[e.type]?.shape || 0;
    c.save(); c.translate(e.x, e.y); c.rotate(e.angle || 0);
    const pulse = 1 + Math.sin(time * 3.5 + e.seed) * .035;
    c.scale(pulse, 1 / pulse);
    const glow = menu ? 30 : player ? 18 : 8;
    if (player && e.phase > 0) { c.globalAlpha = .65 + Math.sin(time * 25) * .2; this.glow('#d7ffff', 30); }
    else this.glow(color, glow);
    // Flexible cilia give even the first stage a living, procedural silhouette.
    const arms = [11, 7, 9, 8, 12, 6][shape] || 9;
    c.lineWidth = menu ? 1.4 : 1;
    for (let i = 0; i < arms; i++) {
      const a = i / arms * Math.PI * 2, extension = r * (shape === 3 ? .47 : shape === 4 ? .3 : .24), sway = Math.sin(time * 3 + i * 1.8 + e.seed) * .15;
      c.strokeStyle = color + '88'; c.beginPath(); c.moveTo(Math.cos(a) * r * .77, Math.sin(a) * r * .77); c.quadraticCurveTo(Math.cos(a + sway) * (r + extension * .5), Math.sin(a + sway) * (r + extension * .5), Math.cos(a + sway * 2) * (r + extension), Math.sin(a + sway * 2) * (r + extension)); c.stroke();
      if (shape >= 2) this.circle(Math.cos(a + sway * 2) * (r + extension), Math.sin(a + sway * 2) * (r + extension), Math.max(1.2, r * .025), color);
    }
    if (shape === 1 || shape === 3 || shape === 5) {
      c.fillStyle = color + '25'; c.strokeStyle = color + '99';
      for (const direction of [-1, 1]) { c.beginPath(); c.moveTo(r * .5, direction * r * .3); c.quadraticCurveTo(-r * .3, direction * r * 1.75, -r * 1.3, direction * r * .85); c.quadraticCurveTo(-r * .2, direction * r * .6, r * .5, direction * r * .3); c.fill(); c.stroke(); }
    }
    const gradient = c.createRadialGradient(r * .1, -r * .2, r * .08, 0, 0, r);
    gradient.addColorStop(0, color + 'cc'); gradient.addColorStop(.22, color + '65'); gradient.addColorStop(.68, '#102c2dee'); gradient.addColorStop(1, color + '70');
    c.fillStyle = gradient; c.strokeStyle = e.flash > 0 ? '#ffffff' : color; c.lineWidth = player ? 2 : 1.2;
    c.beginPath();
    for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2, ripple = 1 + Math.sin(a * (shape === 4 ? 6 : shape === 2 ? 3 : 5) + time * 1.5 + e.seed) * (shape === 4 ? .12 : .045), x = Math.cos(a) * r * ripple, y = Math.sin(a) * r * ripple; if (!i) c.moveTo(x, y); else c.lineTo(x, y); }
    c.closePath(); c.fill(); c.stroke(); c.shadowBlur = 0;
    c.strokeStyle = color + '55'; c.lineWidth = .7;
    c.beginPath(); c.ellipse(-r * .1, 0, r * .71, r * .67, 0, .3, Math.PI * 1.75); c.stroke();
    if (shape >= 2) {
      c.save(); c.rotate(time * .32); c.strokeStyle = color + '77';
      for (let j = 0; j < (shape === 4 ? 3 : 2); j++) { c.beginPath(); c.arc(0, 0, r * (.34 + j * .17), j * 2.1, j * 2.1 + Math.PI * 1.25); c.stroke(); } c.restore();
    }
    // Internal organelles orbit independently from movement.
    for (let i = 0; i < (menu ? 23 : 8 + shape * 2); i++) {
      const a = i * 2.4 + time * .15, rr = r * (.25 + (i % 5) * .115);
      this.circle(Math.cos(a) * rr, Math.sin(a) * rr, (menu ? 1.8 : 1) + (i % 2) * .5, color + (i % 3 ? '55' : '99'));
    }
    this.glow(color, 12); this.circle(0, 0, r * .13, '#e5fff2'); this.circle(0, 0, r * .27, color + '25');
    // Eyes point toward the creature's heading.
    this.circle(r * .46, -r * .22, Math.max(1.6, r * .065), '#e7ffef'); this.circle(r * .46, r * .22, Math.max(1.6, r * .065), '#e7ffef');
    if (player) this.drawPaint(e, time);
    c.shadowBlur = 0; c.restore();
    if (player && !menu) {
      c.save(); c.textAlign = 'center'; c.font = '8px monospace'; c.fillStyle = color; c.globalAlpha = .7; c.fillText('LV ' + e.level, e.x, e.y - r - 18); c.restore();
      if (e.invulnerable > 0) { c.lineWidth = 2; this.circle(e.x, e.y, r + 8, '#ffffff66', true); }
    }
  }
  drawPaint(e, time) {
    const skin = NE.Progress.paint(e.paint), c = this.ctx, r = e.r;
    if (skin.pattern === 'natural') return;
    c.save(); c.strokeStyle = skin.accent + 'aa'; c.fillStyle = skin.accent + '55'; c.lineWidth = Math.max(.8, r * .016); this.glow(skin.accent, 6);
    const ring = radius => this.circle(0, 0, radius, skin.accent + '88', true);
    if (skin.pattern === 'orbit') {
      ring(r * 1.16); for (let i = 0; i < 3; i++) { const a = time * .65 + i * Math.PI * 2 / 3; this.circle(Math.cos(a) * r * 1.16, Math.sin(a) * r * 1.16, r * .055, skin.accent); }
    } else if (['crystal', 'prism', 'crown'].includes(skin.pattern)) {
      const n = skin.pattern === 'crown' ? 10 : 6;
      for (let i = 0; i < n; i++) { c.save(); c.rotate(i * Math.PI * 2 / n + time * .12); c.beginPath(); c.moveTo(r * .77, -r * .1); c.lineTo(r * (skin.pattern === 'crown' ? 1.33 : 1.1), 0); c.lineTo(r * .77, r * .1); if (skin.pattern === 'prism') c.lineTo(r * .6, 0); c.closePath(); c.fill(); c.stroke(); c.restore(); }
    } else if (skin.pattern === 'petals') {
      for (let i = 0; i < 6; i++) { c.save(); c.rotate(i * Math.PI / 3 + time * .15); c.beginPath(); c.ellipse(r * .56, 0, r * .31, r * .12, 0, 0, Math.PI * 2); c.stroke(); c.restore(); }
    } else if (skin.pattern === 'sparks' || skin.pattern === 'nebula') {
      for (let i = 0; i < 14; i++) { const a = i * 2.4 + time * (skin.pattern === 'sparks' ? .9 : .16), rr = r * (.25 + i % 5 * .13); this.circle(Math.cos(a) * rr, Math.sin(a) * rr, r * (i % 2 ? .035 : .055), i % 2 ? skin.accent : skin.color); }
    } else if (skin.pattern === 'circuit') {
      for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(-r * .6, i * r * .22); c.lineTo(-r * .12, i * r * .22); c.lineTo(r * .2, i * r * .22 + r * .12); c.lineTo(r * .58, i * r * .22 + r * .12); c.stroke(); }
    } else if (skin.pattern === 'bubbles') {
      for (let i = 0; i < 5; i++) this.circle(Math.cos(i * 2.4 + time * .3) * r * .5, Math.sin(i * 2.4 + time * .3) * r * .5, r * (.09 + i % 2 * .05), skin.accent + '99', true);
    } else if (skin.pattern === 'void') { this.circle(0, 0, r * .38, '#071019'); ring(r * .47); this.circle(0, 0, r * .05, skin.accent); }
    else if (skin.pattern === 'aurora') {
      for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(0, 0, r * (.4 + i * .16), time * .6 + i, time * .6 + i + 2.6); c.stroke(); }
    }
    c.restore();
  }
  skinPreview(canvas, skin) {
    const previous = this.ctx; this.ctx = canvas.getContext('2d');
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.organism({ x: canvas.width / 2, y: canvas.height / 2, r: 27, angle: -.65, stage: NE.Save.data.selectedForm, paint: skin.id, seed: 0, flash: 0 }, skin.color || NE.forms[NE.Save.data.selectedForm].color, this.menuTime, true, true);
    this.ctx = previous;
  }
  background(color = '#67c8a0') {
    const c = this.ctx; c.fillStyle = '#080d14'; c.fillRect(0, 0, this.width, this.height);
    const g = c.createRadialGradient(this.width * .63, this.height * .45, 0, this.width * .63, this.height * .45, Math.max(this.width, this.height) * .65);
    g.addColorStop(0, color + '0e'); g.addColorStop(.5, '#0c1b2522'); g.addColorStop(1, '#080d1400'); c.fillStyle = g; c.fillRect(0, 0, this.width, this.height);
  }
  menu(dt) {
    this.menuTime += dt; const t = this.menuTime, c = this.ctx; c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); this.background();
    c.lineWidth = .5; c.strokeStyle = '#18272c44';
    for (let x = 30; x < this.width; x += 60) for (let y = 30; y < this.height; y += 60) { c.beginPath(); c.moveTo(x - 2, y); c.lineTo(x + 2, y); c.moveTo(x, y - 2); c.lineTo(x, y + 2); c.stroke(); }
    for (const f of this.menuFood) { const x = f.x * this.width + Math.sin(t * .2 + f.seed) * 9, y = f.y * this.height + Math.cos(t * .25 + f.seed) * 7; c.globalAlpha = f.x < .45 ? .16 : .48; this.glow('#69dabd', 8); this.circle(x, y, f.r, '#8be3b6'); }
    c.globalAlpha = 1; c.shadowBlur = 0;
    const box = document.querySelector('.specimen').getBoundingClientRect();
    const r = this.width < 480 ? 47 : this.width < 760 ? 52 : this.width < 1100 ? 81 : 98;
    const s = NE.Save.data.selectedForm, e = { x: box.left + box.width * .5 + Math.sin(t * .55) * 5, y: box.top + box.height * .43 + Math.cos(t * .65) * 7, r, angle: -.65 + Math.sin(t * .2) * .2, stage: s, paint: NE.Save.data.cosmetics.selected, seed: 0, flash: 0 };
    // A broad halo preserves contrast while avoiding external image assets.
    const g = c.createRadialGradient(e.x, e.y, 0, e.x, e.y, r * 2.5); g.addColorStop(0, '#70d6a01a'); g.addColorStop(1, '#70d6a000'); c.fillStyle = g; c.fillRect(e.x - r * 3, e.y - r * 3, r * 6, r * 6);
    this.organism(e, NE.Progress.color(e), t, true, true);
    for (let i = 0; i < 7; i++) { const a = i * .89 + t * .12, d = r * (1.55 + i % 3 * .42); c.globalAlpha = .5; this.glow('#9effcb', 9); this.circle(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, 1.6 + i % 2, '#a6ffce'); }
    c.globalAlpha = 1; c.shadowBlur = 0;
  }
  visible(e, margin = 150) { return Math.abs(e.x - this.camera.x) < this.width / this.camera.zoom / 2 + margin && Math.abs(e.y - this.camera.y) < this.height / this.camera.zoom / 2 + margin; }
  trail(e, color) {
    const c = this.ctx; if (e.trail.length < 2) return;
    c.save(); c.strokeStyle = color + '22'; c.lineCap = 'round'; c.lineWidth = e.r * .65;
    c.beginPath(); e.trail.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.stroke(); c.restore();
  }
  world(game, dt) {
    const c = this.ctx, p = game.player, cam = this.camera, t = game.time;
    const follow = 1 - Math.exp(-6 * dt); cam.x += (p.x - cam.x) * follow; cam.y += (p.y - cam.y) * follow;
    const targetZoom = NE.clamp(1.05 - (p.r - 17) / 130, .48, 1.05) * (this.width < 600 ? .85 : 1); cam.zoom += (targetZoom - cam.zoom) * (1 - Math.exp(-1.4 * dt));
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); this.background(game.sector?.color);
    const shake = NE.Save.data.settings.shake && game.shake > 0 ? game.shake * 4 : 0;
    c.save(); c.translate(this.width / 2 + Math.sin(t * 83) * shake, this.height / 2 + Math.cos(t * 73) * shake); c.scale(cam.zoom, cam.zoom); c.translate(-cam.x, -cam.y);
    this.drawGround(game);
    for (const e of game.enemies) if (this.visible(e)) this.trail(e, NE.species[e.type].color);
    this.trail(p, NE.Progress.color(p));
    for (const f of game.food) if (!f.dead && this.visible(f, 10)) {
      const alpha = .66 + Math.sin(t * 3 + f.seed) * .16; c.globalAlpha = alpha; this.glow(f.special ? '#e5ff85' : '#85fbd0', f.special ? 13 : 7);
      if (f.special) { c.save(); c.translate(f.x, f.y); c.rotate(t + f.seed); c.fillStyle = '#e2ff91'; c.fillRect(-f.r * .6, -f.r * .6, f.r * 1.2, f.r * 1.2); c.restore(); }
      else this.circle(f.x, f.y, f.r * (1 + Math.sin(t * 2 + f.seed) * .08), '#9affce');
    }
    c.globalAlpha = 1; c.shadowBlur = 0;
    for (const e of game.enemies) if (!e.dead && this.visible(e)) {
      const relation = game.relation(e), col = relation === 'edible' ? '#5cd8ca' : relation === 'equal' ? '#f4d786' : '#ff6a9b';
      this.organism(e, col, t);
      if (NE.distance(e, p) < 440) {
        c.textAlign = 'center'; c.font = '8px monospace'; c.fillStyle = col; c.globalAlpha = .75;
        c.fillText(`${relation === 'danger' ? '▲' : relation === 'equal' ? '◆' : '●'} ${Math.ceil(e.mass)} μ`, e.x, e.y - e.r - 10); c.globalAlpha = 1;
        if (e.hp < e.maxHp) { c.fillStyle = '#24323a'; c.fillRect(e.x - 17, e.y + e.r + 8, 34, 2); c.fillStyle = col; c.fillRect(e.x - 17, e.y + e.r + 8, 34 * e.hp / e.maxHp, 2); }
      }
    }
    if (game.boss && !game.boss.dead) this.drawBoss(game.boss, game);
    if (p.vortex > 0) {
      c.save(); c.translate(p.x, p.y); c.rotate(t * 2); this.glow('#b4a1ff', 14); c.strokeStyle = '#b4a1ff77'; c.lineWidth = 2;
      const radius = 210 * (1 + p.upgrades.vortex * .22);
      for (let i = 0; i < 4; i++) { c.beginPath(); for (let j = 0; j <= 30; j++) { const a = j / 30 * Math.PI * 1.2 + i * Math.PI / 2, r = radius * (1 - j / 42); if (!j) c.moveTo(Math.cos(a) * r, Math.sin(a) * r); else c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.stroke(); } c.restore();
    }
    if (!p.dead) this.organism(p, p.phase > 0 ? '#aefaff' : NE.Progress.color(p), t, true);
    for (const shot of game.projectiles) { this.glow('#ff6a9b', 11); this.circle(shot.x, shot.y, shot.r, '#ff90b4'); }
    c.shadowBlur = 0;
    for (const wave of game.waves) { c.lineWidth = 5; this.circle(wave.x, wave.y, wave.r, '#ff6a9b55', true); c.lineWidth = 1; this.circle(wave.x, wave.y, wave.r + 7, '#ff6a9b88', true); }
    for (const effect of game.rings) { c.save(); c.globalAlpha = NE.clamp(effect.life / effect.maxLife, 0, 1); c.lineWidth = 2; this.glow(effect.color, 12); this.circle(effect.x, effect.y, effect.radius * (1 - effect.life / effect.maxLife), effect.color, true); c.restore(); }
    for (const particle of game.particles) { c.globalAlpha = NE.clamp(particle.life / particle.maxLife, 0, 1); this.circle(particle.x, particle.y, particle.r * Math.max(.15, particle.life / particle.maxLife), particle.color); }
    c.globalAlpha = 1; c.shadowBlur = 0;
    for (const label of game.labels) { c.save(); c.globalAlpha = Math.min(1, label.life); c.textAlign = 'center'; c.font = 'bold 11px monospace'; c.fillStyle = label.color; c.fillText(label.text, label.x, label.y); c.restore(); }
    c.restore();
    if (game.biome === 'abyss') { const fog = c.createRadialGradient(this.width / 2, this.height / 2, Math.min(this.width, this.height) * .16, this.width / 2, this.height / 2, Math.max(this.width, this.height) * .6); fog.addColorStop(0, '#05071200'); fog.addColorStop(1, '#050712e0'); c.fillStyle = fog; c.fillRect(0, 0, this.width, this.height); }
    this.drawArrow(game);
    if (p.hp < p.maxHp * .25 && game.state === 'running') { const g = c.createRadialGradient(this.width / 2, this.height / 2, this.width * .15, this.width / 2, this.height / 2, Math.max(this.width, this.height) * .7); g.addColorStop(0, '#ff174a00'); g.addColorStop(1, '#ff174a28'); c.fillStyle = g; c.fillRect(0, 0, this.width, this.height); }
    this.mapTimer += dt; if (this.mapTimer >= .12) { this.minimap(game); this.mapTimer = 0; }
  }
  drawGround(game) {
    const c = this.ctx, cam = this.camera, minX = Math.max(0, cam.x - this.width / cam.zoom / 2 - 120), maxX = Math.min(NE.C.width, cam.x + this.width / cam.zoom / 2 + 120), minY = Math.max(0, cam.y - this.height / cam.zoom / 2 - 120), maxY = Math.min(NE.C.height, cam.y + this.height / cam.zoom / 2 + 120);
    c.lineWidth = .6; c.strokeStyle = '#253b4139';
    for (let x = Math.floor(minX / 100) * 100; x <= maxX; x += 100) for (let y = Math.floor(minY / 100) * 100; y <= maxY; y += 100) { c.beginPath(); c.moveTo(x - 3, y); c.lineTo(x + 3, y); c.moveTo(x, y - 3); c.lineTo(x, y + 3); c.stroke(); }
    c.lineWidth = 2; c.strokeStyle = '#4ce6e066'; c.strokeRect(0, 0, NE.C.width, NE.C.height); c.lineWidth = 1; c.strokeStyle = '#4ce6e016'; c.strokeRect(12, 12, NE.C.width - 24, NE.C.height - 24);
    c.font = '10px monospace'; c.fillStyle = '#36525666'; c.textAlign = 'left';
    for (let x = 600; x < NE.C.width; x += 600) for (let y = 600; y < NE.C.height; y += 600) if (x > minX && x < maxX && y > minY && y < maxY) c.fillText('СЕКТОР ' + Math.floor(x / 600) + '.' + Math.floor(y / 600), x, y);
    for (const reef of this.decor) if (this.visible(reef)) { c.save(); c.translate(reef.x, reef.y); c.rotate(reef.seed); c.strokeStyle = '#3156493b'; c.lineWidth = 1; for (let j = 0; j < 5; j++) { const a = j * 1.3; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(Math.cos(a + .4) * reef.r, Math.sin(a + .4) * reef.r, Math.cos(a) * reef.r * 1.8, Math.sin(a) * reef.r * 1.8); c.stroke(); } c.restore(); }
    if (game.biome === 'current') {
      c.strokeStyle = '#7cbaff33'; c.lineWidth = 1;
      for (let x = Math.floor(minX / 180) * 180; x < maxX; x += 180) for (let y = Math.floor(minY / 180) * 180; y < maxY; y += 180) { const flow = game.currentAt(x, y), angle = Math.atan2(flow.y, flow.x); c.save(); c.translate(x, y); c.rotate(angle); c.beginPath(); c.moveTo(-22, 0); c.lineTo(22, 0); c.lineTo(14, -5); c.moveTo(22, 0); c.lineTo(14, 5); c.stroke(); c.restore(); }
    }
    for (const zone of game.terrain) if (this.visible(zone, zone.r)) {
      const active = game.terrainActive(zone), col = active ? '#ff6a9b' : '#dfb7ff'; c.lineWidth = 1.5; this.circle(zone.x, zone.y, zone.r, col + (active ? '18' : '05')); this.circle(zone.x, zone.y, zone.r, col + (active ? '88' : '55'), true); c.font = '9px monospace'; c.fillStyle = col + 'aa'; c.textAlign = 'center'; c.fillText(active ? 'ИОННЫЙ РАЗРЯД' : 'ПОЛЕ ЗАРЯЖАЕТСЯ', zone.x, zone.y);
    }
    const event = game.event;
    if (event) {
      if (event.type === 'storm') for (const zone of event.zones) { const active = event.age > 2; c.fillStyle = active ? '#ff6a9b15' : '#ff6a9b08'; c.strokeStyle = active ? '#ff6a9b77' : '#ff6a9b44'; c.lineWidth = 2; this.circle(zone.x, zone.y, zone.r, c.fillStyle); this.circle(zone.x, zone.y, zone.r * (1 + Math.sin(game.time * 4) * .02), c.strokeStyle, true); c.textAlign = 'center'; c.font = '10px monospace'; c.fillStyle = '#ff6a9b99'; c.fillText(active ? 'ИОННОЕ ПОЛЕ' : 'РАЗРЯД ЧЕРЕЗ 2 СЕК', zone.x, zone.y); }
      else { c.lineWidth = 1; this.circle(event.x, event.y, event.r, '#b9ff9e12'); this.circle(event.x, event.y, event.r, '#b9ff9e44', true); c.fillStyle = '#b9ff9e66'; c.font = '10px monospace'; c.textAlign = 'center'; c.fillText(event.type === 'bloom' ? 'ЭНЕРГЕТИЧЕСКИЙ РАСЦВЕТ' : 'МИГРАЦИЯ', event.x, event.y - event.r - 16); }
    }
  }
  drawBoss(b, game) {
    const c = this.ctx; c.save();
    if (b.state === 'telegraph') {
      const a = Math.atan2(b.targetY - b.y, b.targetX - b.x); c.translate(b.x, b.y); c.rotate(a); c.fillStyle = '#ff6a9b18'; c.fillRect(0, -b.r, 500, b.r * 2); c.strokeStyle = '#ff6a9baa'; c.setLineDash([12, 8]); c.lineWidth = 2; c.strokeRect(0, -b.r, 500, b.r * 2); c.setLineDash([]); c.restore(); c.save();
    }
    this.organism({ ...b, type: 4, angle: b.angle + game.time * .1 }, b.flash > 0 ? '#fff2f8' : '#ff6a9b', game.time);
    c.translate(b.x, b.y); c.rotate(-game.time * .4); this.glow('#ff6a9b', 12); c.strokeStyle = '#ff6a9b99'; c.lineWidth = 2;
    for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(0, 0, b.r * 1.38, i * Math.PI / 3, i * Math.PI / 3 + .55); c.stroke(); } c.restore();
    c.fillStyle = '#ff9fc0'; c.font = '10px monospace'; c.textAlign = 'center'; c.fillText((b.empowered ? 'ВЕРХОВНЫЙ АРХОНТ' : 'АРХОНТ') + ' · ' + ['I', 'II', 'III'][b.phase - 1], b.x, b.y - b.r * 1.55); c.shadowBlur = 0;
  }
  drawArrow(game) {
    const c = this.ctx, target = game.boss && !game.boss.dead ? game.boss : game.event && game.event.type !== 'storm' ? game.event : null;
    if (!target) return;
    const dx = (target.x - this.camera.x) * this.camera.zoom, dy = (target.y - this.camera.y) * this.camera.zoom;
    if (Math.abs(dx) < this.width * .44 && Math.abs(dy) < this.height * .4) return;
    const a = Math.atan2(dy, dx), padding = this.width < 600 ? 50 : 100, scale = Math.min((this.width / 2 - padding) / Math.max(1, Math.abs(dx)), (this.height / 2 - 90) / Math.max(1, Math.abs(dy)));
    const x = this.width / 2 + dx * scale, y = this.height / 2 + dy * scale;
    c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = target.kind === 'boss' ? '#ff6a9b' : '#a6ffce'; c.beginPath(); c.moveTo(9, 0); c.lineTo(-6, -5); c.lineTo(-6, 5); c.closePath(); c.fill(); c.restore(); c.textAlign = 'center'; c.font = '9px monospace'; c.fillStyle = target.kind === 'boss' ? '#ff6a9b' : '#a6ffce'; c.fillText(target.kind === 'boss' ? 'АРХОНТ' : 'СОБЫТИЕ', x, y + 19);
  }
  minimap(game) {
    const canvas = document.getElementById('minimap'), c = canvas.getContext('2d'), w = canvas.width, h = canvas.height, sx = w / NE.C.width, sy = h / NE.C.height;
    c.fillStyle = '#08131b'; c.fillRect(0, 0, w, h); c.strokeStyle = '#24383c'; c.lineWidth = .5;
    for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(w / 4 * i, 0); c.lineTo(w / 4 * i, h); c.moveTo(0, h / 4 * i); c.lineTo(w, h / 4 * i); c.stroke(); }
    if (game.event) { c.strokeStyle = '#b4ff9866'; if (game.event.type === 'storm') { c.strokeStyle = '#ff6a9b88'; for (const z of game.event.zones) { c.beginPath(); c.arc(z.x * sx, z.y * sy, z.r * sx, 0, Math.PI * 2); c.stroke(); } } else { c.beginPath(); c.arc(game.event.x * sx, game.event.y * sy, game.event.r * sx, 0, Math.PI * 2); c.stroke(); } }
    for (const e of game.enemies) { c.fillStyle = game.relation(e) === 'danger' ? '#ff6a9b99' : '#76ccb766'; c.fillRect(e.x * sx, e.y * sy, 2, 2); }
    for (const z of game.terrain) { c.strokeStyle = game.terrainActive(z) ? '#ff6a9b66' : '#dfb7ff44'; c.beginPath(); c.arc(z.x * sx, z.y * sy, z.r * sx, 0, Math.PI * 2); c.stroke(); }
    if (game.boss && !game.boss.dead) { c.fillStyle = '#ff6a9b'; c.fillRect(game.boss.x * sx - 3, game.boss.y * sy - 3, 6, 6); }
    const p = game.player; c.strokeStyle = '#a6ffce33'; c.strokeRect((p.x - this.width / this.camera.zoom / 2) * sx, (p.y - this.height / this.camera.zoom / 2) * sy, this.width / this.camera.zoom * sx, this.height / this.camera.zoom * sy); c.fillStyle = '#c7ffdc'; c.beginPath(); c.arc(p.x * sx, p.y * sy, 3, 0, Math.PI * 2); c.fill();
  }
};
