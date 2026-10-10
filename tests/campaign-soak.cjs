'use strict';
// Runs ordinary gameplay with automated inputs, without assigning health, mass, XP or mission counters.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage(); const errors = [], report = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    if (process.env.NE_TEST_CAPTURE) await fs.mkdir(process.env.NE_TEST_CAPTURE, { recursive: true });
    await page.addInitScript(() => {
      let seed = 41027;
      Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
      // Advance only with explicit fixed simulation ticks; this is a balance run, not a frame-rate benchmark.
      window.requestAnimationFrame = () => 0;
    });
    await page.goto(process.env.NE_TEST_URL || 'http://127.0.0.1:8080');
    await page.evaluate(() => {
      NE.Save.importText('{"version":3,"settings":{"sound":false}}');
      window.bot = { x: 0, y: 0, boost: false };
      NE.Input.direction = () => ({ x: bot.x, y: bot.y }); NE.Input.boosting = () => bot.boost;
      window.advanceBot = () => {
        const g = NE.game, p = g.player;
        const priorities = ['growth', 'xp', 'magnet', 'damage', 'heal', 'armor', 'cooldown', 'pulse', 'speed', 'vortex', 'phase', 'vitality', 'regen', 'boost', 'capacity'];
        if (g.state === 'upgrade') { g.applyUpgrade([...g.offered].sort((a, b) => priorities.indexOf(a) - priorities.indexOf(b))[0]); return; }
        if (g.state !== 'running') return;
        const zones = [...g.terrain, ...(g.event?.type === 'storm' ? g.event.zones : [])];
        const safeTarget = e => !zones.some(z => NE.distance(e, z) < z.r + 50);
        let target = null, cost = Infinity;
        for (const f of g.food) if (!f.dead && safeTarget(f)) {
          const c = NE.distance(p, f) / (f.special && g.event?.type === 'bloom' && !g.event.completed ? 2.8 : 1);
          if (c < cost) { target = f; cost = c; }
        }
        for (const e of g.enemies) if (!e.dead && p.mass > e.mass * 1.2 && safeTarget(e)) {
          const c = Math.max(0, NE.distance(p, e) - e.r - p.r) / (e.migration && g.event?.type === 'migration' ? 4 : 1.7);
          if (c < cost) { target = e; cost = c; }
        }
        let dx = target ? target.x - p.x : NE.C.width / 2 - p.x, dy = target ? target.y - p.y : NE.C.height / 2 - p.y;
        const boss = g.boss && !g.boss.dead ? g.boss : null;
        if (boss) {
          const bx = boss.x - p.x, by = boss.y - p.y, d = Math.hypot(bx, by) || 1;
          const desired = p.r + boss.r + 85, approach = NE.clamp((d - desired) * 2, -200, 200);
          dx = bx / d * approach - by / d * 95; dy = by / d * approach + bx / d * 95;
        }
        let norm = Math.hypot(dx, dy) || 1; dx /= norm; dy /= norm;
        let danger = false;
        for (const e of g.enemies) if (!e.dead && e.mass > p.mass * 1.18) {
          const d = NE.distance(p, e), reach = p.r + e.r + 125;
          if (d < reach) { danger = true; const repel = (reach - d) / reach * 4; dx += (p.x - e.x) / (d || 1) * repel; dy += (p.y - e.y) / (d || 1) * repel; }
        }
        for (const z of zones) {
          const d = NE.distance(p, z), reach = z.r + p.r + 90;
          if (d < reach) { const repel = (reach - d) / reach * 6; dx += (p.x - z.x) / (d || 1) * repel; dy += (p.y - z.y) / (d || 1) * repel; }
        }
        norm = Math.hypot(dx, dy) || 1; bot.x = dx / norm; bot.y = dy / norm;
        bot.boost = p.energy > 65 && (danger || !boss && cost > 80);
        const nearEnemy = g.enemies.some(e => !e.dead && NE.distance(p, e) < (140 + p.r) * (1 + p.upgrades.pulse * .22) + e.r);
        const bossDist = boss ? NE.distance(p, boss) : Infinity;
        if (p.energy > 35 && !p.cooldowns.pulse && (nearEnemy || bossDist < (140 + p.r) * (1 + p.upgrades.pulse * .22) + (boss?.r || 0))) g.useAbility('pulse');
        if (p.level >= 4 && p.energy > 55 && !p.cooldowns.phase && (danger || boss?.state === 'charge')) g.useAbility('phase');
        if (p.level >= 7 && p.energy > 60 && !p.cooldowns.vortex && (bossDist < 210 * (1 + p.upgrades.vortex * .22) + (boss?.r || 0) || g.food.filter(f => !f.dead && NE.distance(p, f) < 210).length > 9)) g.useAbility('vortex');
        g.update(1 / 60);
      };
    });
    for (let id = 0; id < 6; id++) {
      assert.equal(await page.evaluate(id => NE.UI.start(false, { mode: 'campaign', sectorId: id }), id), true);
      let status;
      for (let chunk = 0; chunk < 20; chunk++) {
        status = await page.evaluate(() => {
          for (let i = 0; i < 1500 && NE.game.state !== 'result'; i++) advanceBot();
          const g = NE.game; return { sector: g.sector.name, state: g.state, win: !!g.win, seconds: Math.round(g.time), level: g.player.level, mass: Math.round(g.player.mass), hp: Math.round(g.player.hp), score: Math.floor(g.score), ...g.stats, stars: g.settlement?.stars || 0, bossPhase: g.boss?.phase || 0 };
        });
        if (process.env.NE_TEST_CAPTURE && ((id === 1 && chunk === 0) || (id === 5 && chunk === 1))) {
          await page.setViewportSize({ width: 1440, height: 960 });
          await page.waitForTimeout(150);
          await page.evaluate(() => { while (NE.game.state === 'upgrade') advanceBot(); NE.renderer.resize(); NE.UI.updateHUD(NE.game); for (let i = 0; i < 18; i++) NE.renderer.world(NE.game, .1); });
          await page.waitForTimeout(4000);
          await page.screenshot({ path: path.join(process.env.NE_TEST_CAPTURE, id === 1 ? 'reef.png' : 'archon.png') });
        }
        if (status.state === 'result') break;
      }
      console.log(JSON.stringify(status)); report.push(status);
      assert.equal(status.win, true, `Campaign sector ${id} must be beatable by normal gameplay`);
    }
    const saved = await page.evaluate(() => ({ stars: NE.Save.data.campaign.stars, profile: NE.Progress.profile().level, league: NE.Progress.league().name, crystals: NE.Save.data.profile.crystals, achievements: NE.Save.data.achievements }));
    assert.equal(saved.stars.filter(Boolean).length, 6); assert.ok(saved.achievements.includes('expedition')); assert.deepEqual(errors, []);
    console.log(`PASS · Complete campaign through ordinary gameplay: ${JSON.stringify(saved)}`);
    await page.reload(); assert.equal(await page.evaluate(() => NE.Save.data.campaign.stars.filter(Boolean).length), 6);
    console.log('PASS · Campaign progress survives reload.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
