'use strict';
NE.Renderer = class {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false }); this.width = 0; this.height = 0; this.dpr = 1;
    this.camera = { x: NE.C.width / 2, y: NE.C.height / 2, zoom: 1 }; this.menuTime = 0; this.mapTimer = 0;
    this.decor = Array.from({ length: 120 }, (_, i) => ({ x: NE.Visuals.seed(i + 400) * NE.C.width, y: NE.Visuals.seed(i + 800) * NE.C.height, r: 20 + i % 6 * 11, seed: i * 6.7 }));
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
  glow(color, amount) { this.ctx.shadowColor = color; this.ctx.shadowBlur = NE.Save.data.settings.quality === 'low' ? 0 : amount * NE.Save.data.settings.glow * 1.4; }
  circle(x, y, r, color, stroke = false) { const c = this.ctx; c.beginPath(); c.arc(x, y, Math.max(.1, r), 0, Math.PI * 2); if (stroke) { c.strokeStyle = color; c.stroke(); } else { c.fillStyle = color; c.fill(); } }
  organism(e, color, time, player = false, menu = false) {
    const c = this.ctx, r = e.r, shape = player ? e.stage : NE.species[e.type]?.shape || 0;
    c.save(); c.translate(e.x, e.y); c.rotate(e.angle || 0);
    const pulse = 1 + Math.sin(time * 3.5 + e.seed) * .035;
    c.scale(pulse, 1 / pulse);
    if (shape === 1) c.scale(1.08, .92);
    if (shape === 3 || shape === 5) c.scale(1.12, .9);
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
    gradient.addColorStop(0, '#edfff1'); gradient.addColorStop(.18, color + 'a0'); gradient.addColorStop(.56, (this.scenePalette?.deep || '#0a1722') + 'ee'); gradient.addColorStop(1, color + '90');
    c.fillStyle = gradient; c.strokeStyle = e.flash > 0 ? '#ffffff' : color; c.lineWidth = player ? 2 : 1.2;
    c.beginPath();
    const segments = NE.Save.data.settings.quality === 'low' ? 32 : 64;
    for (let i = 0; i <= segments; i++) { const a = i / segments * Math.PI * 2, ripple = 1 + Math.sin(a * (shape === 4 ? 6 : shape === 2 ? 3 : 5) + (shape === 4 ? 0 : time * 1.5) + e.seed) * (shape === 4 || shape === 2 ? .13 : .045), x = Math.cos(a) * r * ripple, y = Math.sin(a) * r * ripple; if (!i) c.moveTo(x, y); else c.lineTo(x, y); }
    c.closePath(); c.fill(); c.stroke(); c.shadowBlur = 0;
    c.strokeStyle = color + '55'; c.lineWidth = .7;
    c.beginPath(); c.ellipse(-r * .1, 0, r * .71, r * .67, 0, .3, Math.PI * 1.75); c.stroke();
    if (shape >= 2) {
      c.save(); c.rotate(time * .32); c.strokeStyle = color + '77';
      for (let j = 0; j < (shape === 4 ? 3 : 2); j++) { c.beginPath(); c.arc(0, 0, r * (.34 + j * .17), j * 2.1, j * 2.1 + Math.PI * 1.25); c.stroke(); } c.restore();
    }
    // Internal organelles orbit independently from movement.
    if (NE.Save.data.settings.quality !== 'low') {
      c.strokeStyle = color + '30';
      for (let i = 0; i < 5; i++) { const a = i * Math.PI * .4; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(Math.cos(a + .7) * r * .4, Math.sin(a + .7) * r * .4, Math.cos(a) * r * .76, Math.sin(a) * r * .76); c.stroke(); }
    }
    if (shape === 3) { c.fillStyle = color + 'bb'; for (const side of [-1, 1]) { c.beginPath(); c.moveTo(r * .55, side * r * .26); c.lineTo(r * 1.08, side * r * .13); c.lineTo(r * .73, side * r * .42); c.closePath(); c.fill(); } }
    if (shape === 4) { c.strokeStyle = color + '88'; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; c.beginPath(); c.moveTo(Math.cos(a) * r * .68, Math.sin(a) * r * .68); c.lineTo(Math.cos(a + .32) * r * .9, Math.sin(a + .32) * r * .9); c.lineTo(Math.cos(a + .68) * r * .68, Math.sin(a + .68) * r * .68); c.stroke(); } }
    for (let i = 0; i < (NE.Save.data.settings.quality === 'low' ? 4 : menu ? 23 : 8 + shape * 2); i++) {
      const a = i * 2.4 + time * .15, rr = r * (.25 + (i % 5) * .115);
      this.circle(Math.cos(a) * rr, Math.sin(a) * rr, (menu ? 1.8 : 1) + (i % 2) * .5, color + (i % 3 ? '55' : '99'));
    }
    this.glow(color, 12); this.circle(0, 0, r * .13, '#e5fff2'); this.circle(0, 0, r * .27, color + '25');
    // Eyes point toward the creature's heading.
    this.circle(r * .46, -r * .22, Math.max(1.6, r * .065), '#e7ffef'); this.circle(r * .46, r * .22, Math.max(1.6, r * .065), '#e7ffef');
    if (player) this.drawPaint(e, time);
    c.shadowBlur = 0; c.restore();
    if (player && !menu) {
      c.save(); c.textAlign = 'center'; c.font = 'bold ' + Math.min(24, 11 / this.camera.zoom) + 'px monospace'; c.fillStyle = '#e5fff6'; c.fillText('ТЫ · LV ' + e.level, e.x, e.y - r - 20);
      c.strokeStyle = '#edfff180'; c.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + .45; c.beginPath(); c.arc(e.x, e.y, r + 6, a, a + .6); c.stroke(); }
      c.fillStyle = '#d9fff3'; c.beginPath(); c.moveTo(e.x, e.y + r + 10); c.lineTo(e.x - 3, e.y + r + 16); c.lineTo(e.x + 3, e.y + r + 16); c.closePath(); c.fill(); c.restore();
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
    this.organism({ x: canvas.width / 2, y: canvas.height / 2, r: 27, angle: -.65, stage: NE.Save.data.selectedForm, paint: skin.id, seed: 0, flash: 0 }, skin.color || NE.forms[NE.Save.data.selectedForm].color, NE.Save.data.settings.motion ? this.menuTime : 0, true, true);
    this.ctx = previous;
  }
  background(biome = 'wild', time = 0, menu = false) {
    const c = this.ctx, palette = this.scenePalette = NE.Visuals.palette(biome), s = NE.Save.data.settings;
    c.drawImage(NE.Visuals.texture(biome), 0, 0, this.width, this.height);
    if (s.quality === 'low') return;
    const count = s.quality === 'high' ? 72 : 36, drift = s.motion ? time : 0;
    c.save();
    for (let i = 0; i < count; i++) {
      const depth = .025 + (i % 3) * .022, parallaxX = menu ? 0 : this.camera.x * depth, parallaxY = menu ? 0 : this.camera.y * depth;
      const x = ((NE.Visuals.seed(i + 63) * this.width - parallaxX + drift * (i % 2 ? 1.2 : -.7)) % this.width + this.width) % this.width;
      const y = ((NE.Visuals.seed(i + 179) * this.height - parallaxY + Math.sin(drift * .08 + i) * 9) % this.height + this.height) % this.height;
      c.globalAlpha = .16 + (i % 4) * .06; this.circle(x, y, i % 5 ? 1 : 1.6, i % 2 ? palette.primary : palette.secondary);
    }
    c.restore();
  }
  menu(dt) {
    this.menuTime += dt; const t = NE.Save.data.settings.motion ? this.menuTime : 0, c = this.ctx; c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); this.background('wild', t, true);
    c.lineWidth = .5; c.strokeStyle = '#18272c44';
    for (let x = 30; x < this.width; x += 60) for (let y = 30; y < this.height; y += 60) { c.beginPath(); c.moveTo(x - 2, y); c.lineTo(x + 2, y); c.moveTo(x, y - 2); c.lineTo(x, y + 2); c.stroke(); }
    for (const f of this.menuFood) { const x = f.x * this.width + Math.sin(t * .2 + f.seed) * 9, y = f.y * this.height + Math.cos(t * .25 + f.seed) * 7; c.globalAlpha = f.x < .45 ? .16 : .48; this.glow(this.scenePalette.primary, 8); this.circle(x, y, f.r, this.scenePalette.primary); }
    c.globalAlpha = 1; c.shadowBlur = 0;
    const box = document.querySelector('.specimen').getBoundingClientRect();
    const r = this.width < 480 ? 47 : this.width < 760 ? 52 : this.width < 1100 ? 81 : 98;
    const s = NE.Save.data.selectedForm, e = { x: box.left + box.width * .5 + Math.sin(t * .55) * 5, y: box.top + box.height * .43 + Math.cos(t * .65) * 7, r, angle: -.65 + Math.sin(t * .2) * .2, stage: s, paint: NE.Save.data.cosmetics.selected, seed: 0, flash: 0 };
    // A broad halo preserves contrast while avoiding external image assets.
    const g = c.createRadialGradient(e.x, e.y, 0, e.x, e.y, r * 2.5); g.addColorStop(0, this.scenePalette.primary + '35'); g.addColorStop(.5, this.scenePalette.secondary + '12'); g.addColorStop(1, this.scenePalette.primary + '00'); c.fillStyle = g; c.fillRect(e.x - r * 3, e.y - r * 3, r * 6, r * 6);
    this.organism(e, NE.Progress.color(e), t, true, true);
    for (let i = 0; i < 7; i++) { const a = i * .89 + t * .12, d = r * (1.55 + i % 3 * .42); c.globalAlpha = .5; this.glow('#9effcb', 9); this.circle(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, 1.6 + i % 2, '#a6ffce'); }
    c.globalAlpha = 1; c.shadowBlur = 0;
  }
  visible(e, margin = 150) { return Math.abs(e.x - this.camera.x) < this.width / this.camera.zoom / 2 + margin && Math.abs(e.y - this.camera.y) < this.height / this.camera.zoom / 2 + margin; }
  trail(e, color) {
    const c = this.ctx; if (e.trail.length < 2) return;
    c.save(); const first = e.trail[0], last = e.trail.at(-1), gradient = c.createLinearGradient(first.x, first.y, last.x + .01, last.y + .01); gradient.addColorStop(0, color + '00'); gradient.addColorStop(1, color + '55'); c.strokeStyle = gradient; c.lineCap = 'round'; c.lineWidth = e.r * .42;
    c.beginPath(); e.trail.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.stroke(); c.restore();
  }
  world(game, dt) {
    const c = this.ctx, p = game.player, cam = this.camera, t = NE.Save.data.settings.motion ? game.time : 0;
    const follow = 1 - Math.exp(-6 * dt); cam.x += (p.x - cam.x) * follow; cam.y += (p.y - cam.y) * follow;
    const targetZoom = NE.clamp(1.05 - (p.r - 17) / 130, .48, 1.05) * (this.width < 600 ? .85 : 1); cam.zoom += (targetZoom - cam.zoom) * (1 - Math.exp(-1.4 * dt));
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); this.background(game.biome, t);
    const shake = NE.Save.data.settings.motion && NE.Save.data.settings.shake && game.shake > 0 ? game.shake * 4 : 0;
    c.save(); c.translate(this.width / 2 + Math.sin(t * 83) * shake, this.height / 2 + Math.cos(t * 73) * shake); c.scale(cam.zoom, cam.zoom); c.translate(-cam.x, -cam.y);
    this.drawGround(game); if (game.mission) this.drawMission(game);
    for (const e of game.enemies) if (this.visible(e)) this.trail(e, NE.species[e.type].color);
    this.trail(p, NE.Progress.color(p));
    for (const f of game.food) if (!f.dead && this.visible(f, 10)) {
      const alpha = .66 + Math.sin(t * 3 + f.seed) * .16; c.globalAlpha = alpha; this.glow(f.special ? '#e5ff85' : '#85fbd0', f.special ? 13 : 7);
      if (f.special) { c.save(); c.translate(f.x, f.y); c.rotate(t + f.seed); c.fillStyle = '#e2ff91'; c.fillRect(-f.r * .6, -f.r * .6, f.r * 1.2, f.r * 1.2); c.restore(); }
      else this.circle(f.x, f.y, f.r * (1 + Math.sin(t * 2 + f.seed) * .08), '#9affce');
      c.shadowBlur = 0; this.circle(f.x, f.y, f.r * .32, f.special ? '#fff7de' : '#e0fff1');
    }
    c.globalAlpha = 1; c.shadowBlur = 0;
    for (const e of game.enemies) if (!e.dead && this.visible(e)) {
      if (e.attackState === 'windup') {
        const angle = Math.atan2(e.aimY - e.y, e.aimX - e.x); c.save(); c.translate(e.x, e.y); c.rotate(angle); c.fillStyle = '#ff719f22'; c.fillRect(0, -e.r * .8, 260, e.r * 1.6); c.strokeStyle = '#ff719faa'; c.lineWidth = 2; c.setLineDash([8, 6]); c.strokeRect(0, -e.r * .8, 260, e.r * 1.6); c.restore();
      }
      const relation = game.relation(e), col = NE.Visuals.relations[relation].color;
      this.organism(e, NE.Visuals.mix(NE.species[e.type].color, col, .28), t); this.drawRelation(e, relation, game);
      if (NE.distance(e, p) < 440) {
        c.textAlign = 'center'; c.font = 'bold ' + Math.min(24, 10 / cam.zoom) + 'px monospace'; c.fillStyle = col;
        c.fillText(`${NE.Visuals.relations[relation].symbol} ${Math.ceil(e.mass)} μ`, e.x, e.y - e.r - 18);
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
    for (const shot of game.projectiles) { c.strokeStyle = '#ff719f55'; c.lineWidth = 3; c.beginPath(); c.moveTo(shot.x - shot.vx * .065, shot.y - shot.vy * .065); c.lineTo(shot.x, shot.y); c.stroke(); this.glow('#ff6a9b', 11); this.circle(shot.x, shot.y, shot.r, '#ff90b4'); c.shadowBlur = 0; this.circle(shot.x, shot.y, 1.6, '#ffecf3'); }
    c.shadowBlur = 0;
    for (const wave of game.waves) { c.lineWidth = 5; this.circle(wave.x, wave.y, wave.r, '#ff6a9b55', true); c.lineWidth = 1; this.circle(wave.x, wave.y, wave.r + 7, '#ff6a9b88', true); }
    for (const effect of game.rings) { c.save(); const age = 1 - effect.life / effect.maxLife, radius = effect.radius * age; c.globalAlpha = NE.clamp(effect.life / effect.maxLife, 0, 1); c.lineWidth = 2 + (1 - age) * 2; this.glow(effect.color, 12); this.circle(effect.x, effect.y, radius, effect.color, true); c.shadowBlur = 0; if (NE.Save.data.settings.quality !== 'low') { c.lineWidth = 1; this.circle(effect.x, effect.y, radius * .92, effect.color + '66', true); } c.restore(); }
    for (const particle of game.particles) { c.globalAlpha = NE.clamp(particle.life / particle.maxLife, 0, 1); this.circle(particle.x, particle.y, particle.r * Math.max(.15, particle.life / particle.maxLife), particle.color); }
    c.globalAlpha = 1; c.shadowBlur = 0;
    for (const label of game.labels) { c.save(); c.globalAlpha = Math.min(1, label.life); c.textAlign = 'center'; c.font = 'bold 11px monospace'; c.fillStyle = label.color; c.fillText(label.text, label.x, label.y); c.restore(); }
    c.restore();
    if (game.biome === 'abyss') { const fog = c.createRadialGradient(this.width / 2, this.height / 2, Math.min(this.width, this.height) * .16, this.width / 2, this.height / 2, Math.max(this.width, this.height) * .6); fog.addColorStop(0, '#05071200'); fog.addColorStop(1, '#050712e0'); c.fillStyle = fog; c.fillRect(0, 0, this.width, this.height); }
    this.drawAnnouncement(game);
    this.drawArrow(game);
    if (p.hp < p.maxHp * .25 && game.state === 'running') { const g = c.createRadialGradient(this.width / 2, this.height / 2, this.width * .15, this.width / 2, this.height / 2, Math.max(this.width, this.height) * .7); g.addColorStop(0, '#ff174a00'); g.addColorStop(1, '#ff174a28'); c.fillStyle = g; c.fillRect(0, 0, this.width, this.height); }
    this.mapTimer += dt; if (this.mapTimer >= .12) { this.minimap(game); this.mapTimer = 0; }
  }
  drawRelation(e, relation, game) {
    const c = this.ctx, high = NE.Save.data.settings.contrast, close = NE.distance(e, game.player) < 480;
    if (!close && relation === 'edible' && !high) return;
    c.save(); c.lineWidth = high ? 2.6 : 1.4; c.strokeStyle = NE.Visuals.relations[relation].color + (high || relation === 'danger' ? 'b0' : '70');
    if (relation === 'equal') c.setLineDash([6, 5]);
    this.circle(e.x, e.y, e.r * 1.12 + 5, c.strokeStyle, true); c.setLineDash([]);
    if (relation === 'danger') {
      c.translate(e.x, e.y);
      for (let i = 0; i < 3; i++) { c.save(); c.rotate(i * Math.PI * 2 / 3); c.fillStyle = NE.Visuals.relations.danger.color; c.beginPath(); c.moveTo(0, -e.r - 15); c.lineTo(-3, -e.r - 9); c.lineTo(3, -e.r - 9); c.closePath(); c.fill(); c.restore(); }
    }
    c.restore();
  }
  drawHabitat(game) {
    const c = this.ctx, palette = this.scenePalette, quality = NE.Save.data.settings.quality;
    const count = quality === 'low' ? 32 : quality === 'medium' ? 72 : 120;
    const time = NE.Save.data.settings.motion ? game.time : 0;
    for (const item of this.decor.slice(0, count)) {
      if (!this.visible(item, item.r * 2)) continue;
      const r = item.r, color = item.seed % 2 > 1 ? palette.primary : palette.secondary;
      c.save(); c.translate(item.x, item.y); c.rotate(item.seed); c.lineWidth = 1.2; c.fillStyle = color + '0e'; c.strokeStyle = color + '35';
      if (game.biome === 'reef') {
        for (let i = 0; i < 3; i++) { c.save(); c.translate((i - 1) * r * .45, i % 2 * r * .4); c.rotate(i * .8); c.beginPath(); c.moveTo(0, -r); c.lineTo(r * .4, -r * .5); c.lineTo(r * .32, r * .6); c.lineTo(-r * .24, r * .8); c.lineTo(-r * .4, -r * .4); c.closePath(); c.fill(); c.stroke(); c.beginPath(); c.moveTo(0, -r); c.lineTo(-r * .04, r * .2); c.lineTo(r * .32, r * .6); c.moveTo(-r * .4, -r * .4); c.lineTo(-r * .04, r * .2); c.lineTo(-r * .24, r * .8); c.stroke(); c.restore(); }
      } else if (game.biome === 'current') {
        for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-r * 1.7, (i - 2) * r * .22); c.bezierCurveTo(-r * .6, -r * .8 + i * r * .24, r * .6, r + i * r * .22, r * 1.7, (i - 2) * r * .22); c.stroke(); }
      } else if (game.biome === 'storm' || game.biome === 'core') {
        const sides = game.biome === 'core' ? 8 : 6;
        for (let j = 0; j < 2; j++) { c.beginPath(); for (let i = 0; i <= sides; i++) { const a = i / sides * Math.PI * 2, radius = r * (j ? .55 : 1); if (!i) c.moveTo(Math.cos(a) * radius, Math.sin(a) * radius); else c.lineTo(Math.cos(a) * radius, Math.sin(a) * radius); } c.fill(); c.stroke(); }
        for (let i = 0; i < sides; i++) { const a = i * Math.PI * 2 / sides; c.beginPath(); c.moveTo(Math.cos(a) * r * .55, Math.sin(a) * r * .55); c.lineTo(Math.cos(a) * r * 1.2, Math.sin(a) * r * 1.2); c.stroke(); this.circle(Math.cos(a) * r, Math.sin(a) * r, 2, color + '66'); }
      } else if (game.biome === 'abyss') {
        this.circle(0, 0, r, '#07091888');
        for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(0, 0, r * (1 + i * .2), r * (.4 + i * .1), i * .6, .2, Math.PI * 1.8); c.stroke(); }
        this.circle(0, 0, 2.5, palette.primary + '80');
      } else {
        for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5 + Math.sin(time * .45 + item.seed) * .04; c.save(); c.rotate(a); c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(r * .25, -r * .45, r, -r * .25, r * 1.3, 0); c.bezierCurveTo(r * .7, r * .5, r * .3, r * .2, 0, 0); c.fill(); c.stroke(); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(r * .6, -r * .1, r * 1.3, 0); c.stroke(); this.circle(r * 1.3, 0, 1.8, color + '66'); c.restore(); }
      }
      c.restore();
    }
  }
  drawAnnouncement(game) {
    const a = game.announcement;
    if (!a || a.life <= 0) return;
    const c = this.ctx, fade = Math.min(1, a.life * 1.5), w = Math.min(this.width - 40, 440), y = this.height < 500 ? this.height * .38 : this.height * .23;
    c.save(); c.globalAlpha = fade; c.textAlign = 'center'; c.fillStyle = '#08131be8'; c.fillRect(this.width / 2 - w / 2, y - 35, w, 66); c.fillStyle = a.color; c.fillRect(this.width / 2 - w / 2, y - 35, 3, 66);
    c.font = 'bold ' + (this.width < 600 ? 17 : 23) + 'px Arial'; c.fillText(a.title, this.width / 2, y - 6, w - 25); c.font = '10px monospace'; c.fillStyle = '#e5eef8'; c.fillText(a.detail, this.width / 2, y + 16, w - 25); c.restore();
  }
  creaturePreview(canvas, type) {
    const previous = this.ctx; this.ctx = canvas.getContext('2d'); this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.organism({ x: canvas.width / 2, y: canvas.height / 2, r: 30, angle: -.5, type, seed: type * 3, flash: 0 }, NE.species[type].color, NE.Save.data.settings.motion ? this.menuTime : 0);
    this.ctx = previous;
  }
  drawGround(game) {
    const c = this.ctx, cam = this.camera, minX = Math.max(0, cam.x - this.width / cam.zoom / 2 - 120), maxX = Math.min(NE.C.width, cam.x + this.width / cam.zoom / 2 + 120), minY = Math.max(0, cam.y - this.height / cam.zoom / 2 - 120), maxY = Math.min(NE.C.height, cam.y + this.height / cam.zoom / 2 + 120);
    this.drawHabitat(game);
    c.lineWidth = .6; c.strokeStyle = this.scenePalette.primary + '12';
    for (let x = Math.floor(minX / 100) * 100; x <= maxX; x += 100) for (let y = Math.floor(minY / 100) * 100; y <= maxY; y += 100) { c.beginPath(); c.moveTo(x - 3, y); c.lineTo(x + 3, y); c.moveTo(x, y - 3); c.lineTo(x, y + 3); c.stroke(); }
    c.lineWidth = 2; c.strokeStyle = '#4ce6e066'; c.strokeRect(0, 0, NE.C.width, NE.C.height); c.lineWidth = 1; c.strokeStyle = '#4ce6e016'; c.strokeRect(12, 12, NE.C.width - 24, NE.C.height - 24);
    c.font = '10px monospace'; c.fillStyle = '#36525666'; c.textAlign = 'left';
    for (let x = 600; x < NE.C.width; x += 600) for (let y = 600; y < NE.C.height; y += 600) if (x > minX && x < maxX && y > minY && y < maxY) c.fillText('СЕКТОР ' + Math.floor(x / 600) + '.' + Math.floor(y / 600), x, y);
    if (game.biome === 'current') {
      c.strokeStyle = '#7cbaff33'; c.lineWidth = 1;
      for (let x = Math.floor(minX / 180) * 180; x < maxX; x += 180) for (let y = Math.floor(minY / 180) * 180; y < maxY; y += 180) { const flow = game.currentAt(x, y), angle = Math.atan2(flow.y, flow.x); c.save(); c.translate(x, y); c.rotate(angle); c.beginPath(); c.moveTo(-22, 0); c.lineTo(22, 0); c.lineTo(14, -5); c.moveTo(22, 0); c.lineTo(14, 5); c.stroke(); c.restore(); }
    }
    for (const zone of game.terrain) if (this.visible(zone, zone.r)) {
      const active = game.terrainActive(zone), col = active ? '#ff6a9b' : '#dfb7ff', charge = Math.min(1, (game.time + zone.offset) % 9 / 2.3);
      c.lineWidth = 2; this.circle(zone.x, zone.y, zone.r, col + (active ? '20' : '08')); c.setLineDash(active ? [] : [8, 8]); this.circle(zone.x, zone.y, zone.r, col + (active ? 'b0' : '70'), true); c.setLineDash([]);
      c.beginPath(); c.arc(zone.x, zone.y, zone.r + 6, -Math.PI / 2, -Math.PI / 2 + charge * Math.PI * 2); c.strokeStyle = col + 'aa'; c.stroke();
      c.font = 'bold 10px monospace'; c.fillStyle = col; c.textAlign = 'center'; c.fillText(active ? '▲ ИОННЫЙ РАЗРЯД' : '◇ ПОЛЕ ЗАРЯЖАЕТСЯ', zone.x, zone.y);
    }
    const event = game.event;
    if (event) {
      if (event.type === 'storm') for (const zone of event.zones) { const active = event.age > 2; c.fillStyle = active ? '#ff6a9b15' : '#ff6a9b08'; c.strokeStyle = active ? '#ff6a9b77' : '#ff6a9b44'; c.lineWidth = 2; this.circle(zone.x, zone.y, zone.r, c.fillStyle); this.circle(zone.x, zone.y, zone.r * (1 + Math.sin(game.time * 4) * .02), c.strokeStyle, true); c.textAlign = 'center'; c.font = '10px monospace'; c.fillStyle = '#ff6a9b99'; c.fillText(active ? 'ИОННОЕ ПОЛЕ' : 'РАЗРЯД ЧЕРЕЗ 2 СЕК', zone.x, zone.y); }
      else { c.lineWidth = 1; this.circle(event.x, event.y, event.r, '#b9ff9e12'); this.circle(event.x, event.y, event.r, '#b9ff9e44', true); c.fillStyle = '#b9ff9e66'; c.font = '10px monospace'; c.textAlign = 'center'; c.fillText(event.type === 'bloom' ? 'ЭНЕРГЕТИЧЕСКИЙ РАСЦВЕТ' : 'МИГРАЦИЯ', event.x, event.y - event.r - 16); }
    }
  }
  drawMission(game) {
    const m = game.mission, c = this.ctx, color = game.sector.color;
    for (const o of m.obstacles) if (this.visible(o, o.r)) {
      c.save(); c.translate(o.x, o.y); c.rotate(o.seed * .7); c.fillStyle = game.biome === 'reef' ? '#143223' : '#182b36'; c.strokeStyle = color + '99'; c.lineWidth = 3;
      c.beginPath(); for (let i = 0; i <= 7; i++) { const a = i / 7 * Math.PI * 2; if (!i) c.moveTo(Math.cos(a) * o.r, Math.sin(a) * o.r); else c.lineTo(Math.cos(a) * o.r, Math.sin(a) * o.r); } c.fill(); c.stroke();
      c.strokeStyle = color + '33'; c.lineWidth = 1; c.beginPath(); c.moveTo(-o.r * .6, -o.r * .3); c.lineTo(o.r * .3, o.r * .5); c.lineTo(o.r * .65, -o.r * .5); c.stroke(); c.restore();
    }
    for (const z of m.hazards) if ((!z.nest || !z.nest.dead) && this.visible(z, z.r)) {
      const active = m.hazardActive(z), warning = m.hazardWarning(z), col = z.nest ? '#c0ff87' : '#ff719f';
      this.circle(z.x, z.y, z.r, col + (active ? '1c' : warning ? '14' : '06')); c.lineWidth = warning ? 3 : 1; c.setLineDash(active ? [] : [7, 8]); this.circle(z.x, z.y, z.r, col + (active ? '99' : warning ? 'cc' : '50'), true); c.setLineDash([]);
      c.textAlign = 'center'; c.font = '11px monospace'; c.fillStyle = col; c.fillText(z.nest ? 'СПОРЫ · СКОРОСТЬ −35%' : active ? '▲ РАЗРЯД' : warning ? '▲ РАЗРЯД СКОРО' : '◇ БЕЗОПАСНОЕ ОКНО', z.x, z.y - z.r - 12);
    }
    for (const o of [...m.objects, ...(m.defense ? [m.defense] : []), m.exit]) if (this.visible(o, o.r + 90)) {
      const active = o.kind === 'exit' ? m.phase === 'exit' : !o.dead && (o.active || o.kind === 'defense'), col = active ? o.hp > 0 && o.kind === 'target' ? '#ff719f' : color : '#4d6b71';
      c.save(); c.translate(o.x, o.y); this.glow(col, active ? 16 : 0); c.lineWidth = 2; this.circle(0, 0, o.r + 24, col + '99', true); this.circle(0, 0, o.r, col + '18');
      c.strokeStyle = col; c.beginPath(); const a = game.time * .3; for (let i = 0; i <= 4; i++) { const angle = i / 4 * Math.PI * 2 + (o.kind === 'exit' ? Math.PI / 4 : a); if (!i) c.moveTo(Math.cos(angle) * o.r * .7, Math.sin(angle) * o.r * .7); else c.lineTo(Math.cos(angle) * o.r * .7, Math.sin(angle) * o.r * .7); } c.stroke(); c.shadowBlur = 0;
      const fraction = o.kind === 'defense' ? o.progress / o.duration : o.charge ? o.charge / o.duration : 0;
      c.beginPath(); c.arc(0, 0, o.r + 29, -Math.PI / 2, -Math.PI / 2 + fraction * Math.PI * 2); c.lineWidth = 5; c.stroke();
      c.font = 'bold ' + Math.min(22, 11 / this.camera.zoom) + 'px monospace'; c.textAlign = 'center'; c.fillStyle = col; c.fillText(o.dead ? '✓ ВОССТАНОВЛЕНО' : o.kind === 'exit' ? active ? 'ВЫХОД ОТКРЫТ' : 'ВЫХОД ЗАКРЫТ' : o.name, 0, -o.r - 40);
      if (o.maxHp > 0 && !o.dead) { c.fillStyle = '#27353c'; c.fillRect(-35, o.r + 40, 70, 5); c.fillStyle = col; c.fillRect(-35, o.r + 40, 70 * o.hp / o.maxHp, 5); }
      c.restore();
    }
  }
  drawBoss(b, game) {
    const c = this.ctx; c.save();
    if (b.state === 'ringwarn') { this.circle(b.x, b.y, b.r + 50, '#ffe19a99', true); c.strokeStyle = '#ffe19a66'; c.lineWidth = 2; for (let i = 0; i < 10 + b.phase * 3; i++) { const a = i / (10 + b.phase * 3) * Math.PI * 2 + b.attackCount * .23; c.beginPath(); c.moveTo(b.x + Math.cos(a) * b.r, b.y + Math.sin(a) * b.r); c.lineTo(b.x + Math.cos(a) * (b.r + 110), b.y + Math.sin(a) * (b.r + 110)); c.stroke(); } }
    if (b.state === 'telegraph') {
      const a = Math.atan2(b.targetY - b.y, b.targetX - b.x); c.translate(b.x, b.y); c.rotate(a); c.fillStyle = '#ff6a9b18'; c.fillRect(0, -b.r, 500, b.r * 2); c.strokeStyle = '#ff6a9baa'; c.setLineDash([12, 8]); c.lineWidth = 2; c.strokeRect(0, -b.r, 500, b.r * 2); c.setLineDash([]); c.restore(); c.save();
    }
    if (b.shielded) { c.lineWidth = 4; this.circle(b.x, b.y, b.r * 1.6, '#88ffe199', true); c.font = '11px monospace'; c.textAlign = 'center'; c.fillStyle = '#88ffe1'; c.fillText('ЩИТ ПЕРЕСТРАИВАЕТСЯ · УКЛОНЯЙТЕСЬ', b.x, b.y + b.r * 1.8); }
    this.organism({ ...b, type: 4, angle: b.angle + game.time * .1 }, b.flash > 0 ? '#fff2f8' : '#ff6a9b', game.time);
    const phaseColor = ['#ff719f', '#ffac87', '#ffe09b'][b.phase - 1], time = NE.Save.data.settings.motion ? game.time : 0;
    c.translate(b.x, b.y); c.rotate(-time * .4); this.glow(phaseColor, 12); c.strokeStyle = phaseColor + 'b0'; c.fillStyle = phaseColor + '22'; c.lineWidth = 2;
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; c.beginPath(); c.arc(0, 0, b.r * 1.38, a, a + .55); c.stroke(); c.save(); c.rotate(a + .25); c.beginPath(); c.moveTo(b.r * 1.16, -7); c.lineTo(b.r * (1.52 + b.phase * .08), 0); c.lineTo(b.r * 1.16, 7); c.closePath(); c.fill(); c.stroke(); c.restore(); }
    c.shadowBlur = 0; this.circle(0, 0, b.r * .19, '#331128'); this.circle(0, 0, b.r * .12, phaseColor); c.restore();
    c.fillStyle = phaseColor; c.font = 'bold ' + Math.min(24, 11 / this.camera.zoom) + 'px monospace'; c.textAlign = 'center'; c.fillText((b.name || (b.empowered ? 'ВЕРХОВНЫЙ АРХОНТ' : 'АРХОНТ')) + ' · ' + ['I', 'II', 'III'][b.phase - 1], b.x, b.y - b.r * 1.75); c.shadowBlur = 0;
  }
  drawArrow(game) {
    const c = this.ctx, target = game.mission?.nearest() || (game.boss && !game.boss.dead ? game.boss : game.event && game.event.type !== 'storm' ? game.event : null);
    if (!target) return;
    const dx = (target.x - this.camera.x) * this.camera.zoom, dy = (target.y - this.camera.y) * this.camera.zoom;
    if (Math.abs(dx) < this.width * .44 && Math.abs(dy) < this.height * .4) return;
    const a = Math.atan2(dy, dx), padding = this.width < 600 ? 50 : 100, scale = Math.min((this.width / 2 - padding) / Math.max(1, Math.abs(dx)), (this.height / 2 - 90) / Math.max(1, Math.abs(dy)));
    const x = this.width / 2 + dx * scale, y = this.height / 2 + dy * scale;
    c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = target.kind === 'boss' ? '#ff6a9b' : '#a6ffce'; c.beginPath(); c.moveTo(9, 0); c.lineTo(-6, -5); c.lineTo(-6, 5); c.closePath(); c.fill(); c.restore(); c.textAlign = 'center'; c.font = '9px monospace'; c.fillStyle = target.kind === 'boss' ? '#ff6a9b' : '#a6ffce'; c.fillText(target.name || (target.kind === 'boss' ? 'АРХОНТ' : 'СОБЫТИЕ'), x, y + 19);
  }
  minimap(game) {
    const canvas = document.getElementById('minimap'), c = canvas.getContext('2d'), w = canvas.width, h = canvas.height, sx = w / NE.C.width, sy = h / NE.C.height;
    c.fillStyle = NE.Visuals.palette(game.biome).bg; c.fillRect(0, 0, w, h); c.strokeStyle = '#24383c'; c.lineWidth = .5;
    for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(w / 4 * i, 0); c.lineTo(w / 4 * i, h); c.moveTo(0, h / 4 * i); c.lineTo(w, h / 4 * i); c.stroke(); }
    if (game.event) { c.strokeStyle = '#b4ff9866'; if (game.event.type === 'storm') { c.strokeStyle = '#ff6a9b88'; for (const z of game.event.zones) { c.beginPath(); c.arc(z.x * sx, z.y * sy, z.r * sx, 0, Math.PI * 2); c.stroke(); } } else { c.beginPath(); c.arc(game.event.x * sx, game.event.y * sy, game.event.r * sx, 0, Math.PI * 2); c.stroke(); } }
    for (const e of game.enemies) { const relation = game.relation(e); c.fillStyle = NE.Visuals.relations[relation].color; if (relation === 'danger') { const x = e.x * sx, y = e.y * sy; c.beginPath(); c.moveTo(x, y - 2); c.lineTo(x - 2, y + 2); c.lineTo(x + 2, y + 2); c.closePath(); c.fill(); } else c.fillRect(e.x * sx, e.y * sy, 2, 2); }
    for (const z of game.terrain) { c.strokeStyle = game.terrainActive(z) ? '#ff6a9b66' : '#dfb7ff44'; c.beginPath(); c.arc(z.x * sx, z.y * sy, z.r * sx, 0, Math.PI * 2); c.stroke(); }
    if (game.boss && !game.boss.dead) { c.fillStyle = '#ff6a9b'; c.fillRect(game.boss.x * sx - 3, game.boss.y * sy - 3, 6, 6); }
    if (game.mission) {
      for (const o of game.mission.obstacles) { c.fillStyle = '#607e8866'; c.beginPath(); c.arc(o.x * sx, o.y * sy, o.r * sx, 0, Math.PI * 2); c.fill(); }
      for (const o of [...game.mission.objects, ...(game.mission.defense ? [game.mission.defense] : []), game.mission.exit]) { c.fillStyle = o.dead ? '#466965' : o.kind === 'exit' && game.mission.phase !== 'exit' ? '#425463' : o.kind === 'target' && o.hp > 0 ? '#ff719f' : '#88ffe1'; c.fillRect(o.x * sx - 2, o.y * sy - 2, 5, 5); }
    }
    const p = game.player; c.strokeStyle = '#a6ffce33'; c.strokeRect((p.x - this.width / this.camera.zoom / 2) * sx, (p.y - this.height / this.camera.zoom / 2) * sy, this.width / this.camera.zoom * sx, this.height / this.camera.zoom * sy); c.fillStyle = '#c7ffdc'; c.beginPath(); c.arc(p.x * sx, p.y * sy, 3, 0, Math.PI * 2); c.fill();
  }
};
