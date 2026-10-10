/* Optional development checks. The game itself has no dependencies. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const URL = process.env.NE_TEST_URL || 'http://127.0.0.1:8080';
let passed = 0, skipped = 0;
async function check(name, run) { const reason = await run(); if (typeof reason === 'string') { skipped++; console.log(`SKIP · ${name}: ${reason}`); } else { passed++; console.log(`PASS ${String(passed).padStart(2, '0')} · ${name}`); } }

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL); await page.waitForFunction(() => !!window.NE?.renderer);
  // Fixtures isolate each scenario, without adding cheats to the product UI.
  await page.evaluate(() => {
    window.fixture = (mode = 'survival') => {
      NE.UI.start(); const g = NE.game; g.mode = mode; g.food = []; g.enemies = []; g.player.invulnerable = 0; g.spawnTimer = -10000; g.nextEvent = Infinity; g.nextBoss = Infinity; g.questIndex = g.quests.length; g.grid.rebuild([g.player]); return g;
    };
    window.setLevel = (g, level) => { g.player.level = level; g.checkEvolution(); g.grid.rebuild(g.food, g.enemies, [g.player]); };
    window.resolveUpgrades = g => { while (g.pendingUpgrades) { if (g.state !== 'upgrade') NE.UI.showUpgrade(g); g.applyUpgrade(g.offered[0]); } };
  });

  try {
    await check('Menu, tutorial, form collection and all settings', async () => {
      await page.click('[data-action="tutorial"]'); assert.equal(await page.locator('.tutorial-step').count(), 4); await page.click('#dialog-close');
      await page.click('[data-action="forms"]'); assert.equal(await page.locator('.form-card').count(), 5); assert.equal(await page.locator('.form-card:disabled').count(), 4); await page.click('[data-ui="close"]');
      await page.click('[data-action="settings"]'); await page.locator('#quality-setting').selectOption('low'); await page.locator('#touch-setting').check(); await page.locator('#sound-setting').uncheck(); await page.locator('#volume-setting').evaluate(node => { node.value = '28'; node.dispatchEvent(new Event('input', { bubbles: true })); });
      assert.deepEqual(await page.evaluate(() => ({ quality: NE.Save.data.settings.quality, touch: NE.Save.data.settings.touch, sound: NE.Save.data.settings.sound, volume: NE.Save.data.settings.volume })), { quality: 'low', touch: true, sound: false, volume: .28 });
      await page.locator('#touch-setting').uncheck(); await page.locator('#sound-setting').check(); await page.locator('#quality-setting').selectOption('high'); await page.click('[data-ui="close"]');
    });
    await check('Keyboard movement, diagonal normalization and energy-consuming boost', async () => {
      await page.evaluate(() => fixture());
      const before = await page.evaluate(() => NE.game.player.x); await page.keyboard.down('KeyD'); await page.waitForTimeout(400); await page.keyboard.up('KeyD');
      assert.ok(await page.evaluate(() => NE.game.player.x) > before + 30);
      await page.evaluate(() => { NE.game.player.energy = 80; NE.game.player.vx = 0; });
      await page.keyboard.down('KeyD'); await page.keyboard.down('Space'); await page.waitForTimeout(400); await page.keyboard.up('Space'); await page.keyboard.up('KeyD');
      assert.ok(await page.evaluate(() => NE.game.player.energy) < 80);
      await page.keyboard.down('KeyW'); await page.keyboard.down('KeyD'); const d = await page.evaluate(() => NE.Input.direction()); assert.ok(Math.abs(Math.hypot(d.x, d.y) - 1) < .0001); await page.keyboard.up('KeyW'); await page.keyboard.up('KeyD');
    });
    await check('Food collision grants mass, XP, energy and health; growth is smooth', async () => {
      assert.equal(await page.evaluate(() => { const g = fixture(), p = g.player; p.energy = 60; p.hp = 80; const r = p.r, f = NE.Entities.food(p.x, p.y); g.food = [f]; g.grid.rebuild(g.food, [p]); NE.Collisions.food(g, 1 / 60); const result = f.dead && p.mass > 18 && p.xp === 2 && p.energy > 60 && p.hp > 80 && p.r === r; g.update(1 / 60); return result && p.r > r && p.r < NE.radius(p.mass); }), true);
    });
    await check('Weak prey absorption and equal-size combat', async () => {
      assert.equal(await page.evaluate(() => { const g = fixture(), p = g.player, e = NE.Entities.enemy(0, p.x, p.y, 8); g.enemies = [e]; g.grid.rebuild(g.enemies, [p]); NE.Collisions.actors(g, 1 / 60); if (!e.dead || g.stats.kills !== 1 || p.mass <= 18) return false; const equal = NE.Entities.enemy(1, p.x, p.y, p.mass); g.enemies = [equal]; p.invulnerable = 0; g.grid.rebuild(g.enemies, [p]); const hp = p.hp; NE.Collisions.actors(g, 1 / 60); return !equal.dead && equal.hp < equal.maxHp && p.hp < hp; }), true);
    });
    await check('Damage immunity window, armor, death and a single recorded result', async () => {
      assert.equal(await page.evaluate(() => { const g = fixture(), p = g.player; p.upgrades.armor = 3; const hp = p.hp; g.hurt(20); if (Math.abs(p.hp - (hp - 14)) > .001) return false; g.hurt(20); if (Math.abs(p.hp - (hp - 14)) > .001) return false; p.invulnerable = 0; p.hp = 1; const runs = NE.Save.data.runs; g.hurt(100); g.end(false); return g.state === 'result' && p.dead && NE.Save.data.runs === runs + 1 && !document.getElementById('overlay').hidden; }), true);
    });
    await check('All six species seek food or prey and flee dangerous neighbors', async () => {
      assert.equal(await page.evaluate(() => {
        for (let type = 0; type < 6; type++) {
          const g = fixture(), p = g.player; p.x = 2600; p.y = 2000; const e = NE.Entities.enemy(type, 800, 800, 100), f = NE.Entities.food(850, 800); e.anchor = { x: 800, y: 800 }; g.enemies = [e]; g.food = [f]; g.grid.rebuild(g.food, g.enemies, [p]); NE.AI.think(e, g); if (e.target !== f || e.state !== 'graze') return false;
          p.x = 870; p.y = 800; p.mass = 400; g.grid.rebuild(g.food, g.enemies, [p]); NE.AI.think(e, g); if (e.target !== p || e.state !== 'flee') return false;
          if (type >= 2) { p.mass = 15; g.grid.rebuild(g.food, g.enemies, [p]); NE.AI.think(e, g); if (e.target !== p || e.state !== 'hunt') return false; }
        } return true;
      }), true);
    });
    await check('All 15 upgrade cards apply and respect stack limits', async () => {
      const result = await page.evaluate(() => {
        const g = fixture(), p = g.player; p.energy = 20; p.hp = 20; const names = [];
        for (const u of NE.upgrades) { g.state = 'upgrade'; g.pendingUpgrades = 1; g.offered = [u.id]; if (!g.applyUpgrade(u.id) || p.upgrades[u.id] !== 1) return []; names.push(u.id); const current = p.upgrades[u.id]; p.upgrades[u.id] = u.max; g.state = 'upgrade'; g.pendingUpgrades = 1; if (g.applyUpgrade(u.id)) return []; p.upgrades[u.id] = current; }
        return p.maxHp === 125 && p.hp === 45 && p.maxEnergy === 120 && p.energy === 40 ? names : [];
      }); assert.equal(result.length, 15);
    });
    await check('Upgrade effects alter speed, growth, XP, regen, boost and cooldowns', async () => {
      assert.equal(await page.evaluate(() => {
        const g = fixture(), p = g.player; const speed = g.speed(); p.upgrades.speed = 1; if (g.speed() <= speed) return false;
        p.upgrades.growth = 1; const mass = p.mass; g.addMass(10); if (Math.abs(p.mass - mass - 11.8) > .01) return false;
        p.upgrades.xp = 2; g.addXP(10); if (Math.abs(p.xp - 13) > .001) return false;
        p.upgrades.regen = 1; p.upgrades.heal = 1; p.energy = 30; p.hp = 50; g.update(1); if (Math.abs(p.energy - 38.8) > .01 || Math.abs(p.hp - 50.82) > .01) return false;
        p.upgrades.cooldown = 2; if (!g.useAbility('pulse') || Math.abs(p.cooldowns.pulse - 5.6) > .001) return false;
        const originalDirection = NE.Input.direction, originalBoost = NE.Input.boosting; NE.Input.direction = () => ({ x: 1, y: 0 }); NE.Input.boosting = () => true;
        try { const base = fixture(); base.update(.2); const improved = fixture(); improved.player.upgrades.boost = 2; improved.update(.2); if (improved.player.energy <= base.player.energy || improved.player.vx <= base.player.vx) return false; }
        finally { NE.Input.direction = originalDirection; NE.Input.boosting = originalBoost; }
        return true;
      }), true);
    });
    await check('Magnet, damage, resonance and phase upgrades change their actual mechanics', async () => {
      assert.equal(await page.evaluate(() => {
        const g = fixture(), p = g.player, f = NE.Entities.food(p.x + 70, p.y); g.food = [f]; g.grid.rebuild(g.food, [p]); NE.Collisions.food(g, 1 / 60); const x = f.x; if (x !== p.x + 70) return false; p.upgrades.magnet = 4; NE.Collisions.food(g, 1 / 60); if (f.x >= x) return false;
        const base = fixture(), e1 = NE.Entities.enemy(3, base.player.x + 100, base.player.y, 100); base.enemies = [e1]; base.grid.rebuild(base.enemies, [base.player]); base.useAbility('pulse'); const damage = e1.maxHp - e1.hp;
        const stronger = fixture(), e2 = NE.Entities.enemy(3, stronger.player.x + 100, stronger.player.y, 100), distant = NE.Entities.enemy(3, stronger.player.x + 245, stronger.player.y, 100); stronger.enemies = [e2, distant]; stronger.player.upgrades.damage = 2; stronger.player.upgrades.pulse = 2; stronger.grid.rebuild(stronger.enemies, [stronger.player]); stronger.useAbility('pulse'); if (e2.maxHp - e2.hp <= damage || distant.hp >= distant.maxHp) return false;
        setLevel(stronger, 4); stronger.player.upgrades.phase = 2; stronger.player.energy = 100; return stronger.useAbility('phase') && Math.abs(stronger.player.phase - 3.4) < .001;
      }), true);
    });
    await check('Pulse damages and repels; locked ability and cooldown are enforced', async () => {
      assert.equal(await page.evaluate(() => { const g = fixture(), p = g.player; const e = NE.Entities.enemy(3, p.x + 90, p.y, 90); g.enemies = [e]; g.grid.rebuild(g.enemies, [p]); const hp = e.hp; if (!g.useAbility('pulse') || e.hp >= hp || e.knockX <= 0 || p.cooldowns.pulse <= 0 || p.energy !== 82) return false; return !g.useAbility('pulse') && !g.useAbility('phase'); }), true);
    });
    await check('Phase blocks damage, accelerates and hits a target only once', async () => {
      assert.equal(await page.evaluate(() => { const g = fixture(), p = g.player; setLevel(g, 4); const e = NE.Entities.enemy(3, p.x, p.y, 160); g.enemies = [e]; g.grid.rebuild(g.enemies, [p]); if (!g.useAbility('phase')) return false; const hp = p.hp, ehp = e.hp; g.hurt(50); NE.Collisions.actors(g, 1 / 60); const once = e.hp; NE.Collisions.actors(g, 1 / 60); return p.hp === hp && once < ehp && Math.abs(once - e.hp) < 1 && p.phaseHits.size === 1; }), true);
    });
    await check('Vortex pulls food and damages distant targets with range upgrades', async () => {
      assert.equal(await page.evaluate(() => { const g = fixture(), p = g.player; setLevel(g, 7); p.upgrades.vortex = 4; const e = NE.Entities.enemy(3, p.x + 335, p.y, 160), f = NE.Entities.food(p.x + 290, p.y); g.enemies = [e]; g.food = [f]; g.grid.rebuild(g.food, g.enemies, [p]); const fx = f.x, ex = e.x; if (!g.useAbility('vortex')) return false; NE.Collisions.food(g, 1 / 60); NE.Collisions.actors(g, 1 / 60); return f.x < fx && e.x < ex && e.hp < e.maxHp; }), true);
    });
    await check('Five evolution stages, HP/energy growth and permanently unlocked forms', async () => {
      assert.deepEqual(await page.evaluate(() => { const g = fixture(), stages = []; for (const level of [1, 4, 7, 10, 13]) { setLevel(g, level); stages.push(g.player.stage); } return { stages, unlocks: NE.Save.data.forms.slice().sort(), health: g.player.maxHp, energy: g.player.maxEnergy }; }), { stages: [0, 1, 2, 3, 4], unlocks: [0, 1, 2, 3, 4], health: 160, energy: 132 });
    });
    await check('Energy bloom and migration rewards; storm damage, survival and achievement', async () => {
      assert.equal(await page.evaluate(() => {
        const g = fixture(); g.startEvent('bloom'); for (const f of g.food.filter(f => f.special).slice(0, 12)) g.collect(f); resolveUpgrades(g); g.updateEvent(1 / 60); resolveUpgrades(g); if (!g.event.completed || g.stats.events !== 1) return false;
        g.startEvent('migration'); const migrants = g.enemies.filter(e => e.migration); if (migrants.length !== 10) return false; migrants.slice(0, 3).forEach(e => g.absorb(e)); resolveUpgrades(g); g.updateEvent(1 / 60); resolveUpgrades(g); if (!g.event.completed || g.stats.events !== 2) return false;
        g.startEvent('storm'); const zone = g.event.zones[0]; g.player.x = zone.x; g.player.y = zone.y; g.player.invulnerable = 0; const hp = g.player.hp; g.event.age = 3; g.updateEvent(1 / 60); if (g.player.hp >= hp) return false; g.player.phase = 1; g.event.age = 29.99; g.updateEvent(.02); return g.stats.events === 3 && g.event === null && NE.Save.data.achievements.includes('storm');
      }), true);
    });
    await check('Quest reward and multiple-level upgrade queue', async () => {
      assert.equal(await page.evaluate(() => { const g = fixture(); g.questIndex = 0; g.stats.food = 20; const mass = g.player.mass; g.checkQuest(); if (g.questIndex !== 1 || g.player.mass <= mass) return false; g.addXP(700); const count = g.pendingUpgrades; const before = Object.values(g.player.upgrades).reduce((a, b) => a + b, 0); resolveUpgrades(g); const after = Object.values(g.player.upgrades).reduce((a, b) => a + b, 0); return count > 1 && after - before === count && g.state === 'running'; }), true);
    });
    await check('Boss telegraphs, charges, emits projectiles, summons and transitions all phases', async () => {
      assert.equal(await page.evaluate(() => { const g = fixture(); g.spawnBoss(); const b = g.boss; b.timer = 0; NE.AI.boss(b, g, 1 / 60); if (b.state !== 'telegraph') return false; b.timer = 0; NE.AI.boss(b, g, 1 / 60); if (b.state !== 'charge' || Math.hypot(b.vx, b.vy) < 300) return false; b.state = 'recover'; b.timer = 0; NE.AI.boss(b, g, 1 / 60); if (!g.projectiles.length) return false; b.hp = b.maxHp * .6; b.state = 'recover'; b.timer = 0; NE.AI.boss(b, g, 1 / 60); if (b.phase !== 2 || !g.enemies.length) return false; b.hp = b.maxHp * .2; b.state = 'recover'; b.timer = 0; NE.AI.boss(b, g, 1 / 60); return b.phase === 3 && g.waves.length === 1; }), true);
    });
    await check('Boss projectile and expanding wave collision damage the player', async () => {
      assert.equal(await page.evaluate(() => { const g = fixture(), p = g.player; g.projectile(p.x, p.y, 0, 100, 19); NE.Collisions.actors(g, 1 / 60); if (p.hp !== 81 || !g.projectiles[0].dead) return false; p.invulnerable = 0; g.wave(p.x - 60, p.y, 100, 14); g.waves[0].r = 60; NE.Collisions.actors(g, 1 / 60); return p.hp === 67 && g.waves[0].hit; }), true);
    });
    await check('Survival boss victory ends once; endless victory keeps the run alive', async () => {
      assert.equal(await page.evaluate(() => { const g = fixture(); g.spawnBoss(); g.damageEnemy(g.boss, 1e6); if (g.state !== 'result' || g.stats.bosses !== 1 || !NE.Save.data.achievements.includes('boss')) return false; const endless = fixture('endless'); endless.spawnBoss(); endless.damageEnemy(endless.boss, 1e6); resolveUpgrades(endless); return endless.state === 'running' && endless.boss === null && endless.nextBoss === 150 && endless.stats.bosses === 1; }), true);
    });
    await check('Spatial grid queries match brute-force proximity, including cell boundaries', async () => {
      assert.equal(await page.evaluate(() => { const grid = new NE.Grid(); const objects = Array.from({ length: 300 }, (_, i) => ({ id: i, kind: i % 2 ? 'food' : 'enemy', x: i * 37 % 1700, y: i * 71 % 1300 })); grid.rebuild(objects); for (const [x, y, radius] of [[140, 140, 140], [280, 281, 10], [0, 0, 200], [1300, 900, 350]]) { const expected = objects.filter(e => Math.hypot(e.x - x, e.y - y) <= radius).map(e => e.id).sort((a, b) => a - b); const actual = grid.query(x, y, radius).map(e => e.id).sort((a, b) => a - b); if (JSON.stringify(actual) !== JSON.stringify(expected)) return false; } return true; }), true);
    });
    await check('Simulation movement is consistent at 30/60/120 Hz; larger bodies are slower', async () => {
      assert.equal(await page.evaluate(() => { const original = NE.Input.direction; NE.Input.direction = () => ({ x: 1, y: 0 }); const results = []; try { for (const hz of [30, 60, 120]) { const g = fixture(); const start = g.player.x; for (let i = 0; i < hz; i++) g.update(1 / hz); results.push(g.player.x - start); } const g = fixture(), small = g.speed(); g.player.mass = 350; return Math.max(...results) - Math.min(...results) < 2.5 && g.speed() < small; } finally { NE.Input.direction = original; } }), true);
    });
    await check('Caps remain bounded under repeated spawning and particle/projectile bursts', async () => {
      assert.equal(await page.evaluate(() => { const g = fixture(); for (let i = 0; i < 200; i++) { g.spawnEnemy(i % 6); g.projectile(100, 100, 0, 100, 10); g.burst(100, 100, '#a6ffce', 40); } for (let i = 0; i < 4; i++) g.startEvent('bloom'); return g.enemies.length <= NE.C.enemyCap && g.food.length <= NE.C.foodCap && g.projectiles.length <= NE.C.projectileCap && g.particles.length <= NE.C.particleCap; }), true);
    });
    await check('Pause freezes time; resume, restart and menu controls work', async () => {
      await page.evaluate(() => fixture()); await page.click('#pause-button'); const t = await page.evaluate(() => NE.game.time); await page.waitForTimeout(200); assert.equal(await page.evaluate(() => NE.game.time), t);
      await page.click('[data-ui="settings"]'); await page.click('[data-ui="close"]'); assert.equal(await page.evaluate(() => NE.game.state), 'paused');
      await page.click('[data-ui="resume"]'); await page.waitForTimeout(100); assert.ok(await page.evaluate(() => NE.game.time) > t);
      await page.keyboard.press('Escape'); await page.click('[data-ui="restart"]'); assert.ok(await page.evaluate(() => NE.game.time) < 1);
      await page.keyboard.press('Escape'); await page.click('[data-ui="menu"]'); assert.equal(await page.evaluate(() => NE.game), null);
    });
    await check('Hidden-tab event automatically pauses the simulation', async () => {
      assert.equal(await page.evaluate(() => { fixture(); Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); delete document.hidden; return NE.game.state === 'paused'; }), true); await page.click('[data-ui="menu"]');
    });
    await check('Settings, forms, records and achievements persist through reload', async () => {
      const saved = await page.evaluate(() => { NE.Save.data.selectedForm = 2; NE.Save.setting('volume', .37); NE.Save.persist(); return { forms: NE.Save.data.forms, records: NE.Save.data.records, achievements: NE.Save.data.achievements }; });
      await page.reload(); await page.waitForFunction(() => !!window.NE?.renderer);
      assert.deepEqual(await page.evaluate(() => ({ forms: NE.Save.data.forms, records: NE.Save.data.records, achievements: NE.Save.data.achievements })), saved); assert.equal(await page.evaluate(() => NE.Save.data.selectedForm), 2); assert.equal(await page.evaluate(() => NE.Save.data.settings.volume), .37);
      await page.click('[data-action="records"]'); await page.click('[data-tab="achievements"]'); assert.equal(await page.locator('.achievement').count(), 10); await page.click('#dialog-close');
    });
    await check('Corrupt, unsupported and malformed save data recover safely', async () => {
      assert.equal(await page.evaluate(() => { const result = NE.Save.validate({ version: 2, forms: [0, -1, 999, '2'], selectedForm: 4, settings: { volume: 100, quality: 'bad', sound: 'no' }, achievements: ['first', 'forged'], records: { survival: [{ score: -1, time: 0, stage: 0 }, { score: 12, time: 5, stage: 0 }] } }); return result.forms.length === 1 && result.selectedForm === 0 && result.settings.volume === 1 && result.settings.quality === 'high' && result.achievements.length === 1 && result.records.survival.length === 1; }), true);
      await page.evaluate(() => localStorage.setItem('neon-evolution.save', '{broken')); await page.reload(); assert.equal(await page.evaluate(() => NE.Save.data.selectedForm), 0); assert.ok(await page.evaluate(() => NE.Save.warning.length > 0));
      await page.evaluate(() => localStorage.setItem('neon-evolution.save', '{"version":999}')); await page.reload(); assert.deepEqual(await page.evaluate(() => NE.Save.data.forms), [0]);
    });
    await check('Storage-denied browser still runs and reports unsaved results', async () => {
      const isolated = await browser.newContext(); const p = await isolated.newPage(); p.on('pageerror', e => errors.push(e.message));
      await p.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException('Denied', 'SecurityError'); }; }); await p.goto(URL); await p.click('#play'); await p.evaluate(() => { NE.game.player.invulnerable = 0; NE.game.hurt(1e4); }); assert.equal(await p.evaluate(() => NE.game.saved), false); assert.ok((await p.locator('#dialog-content').textContent()).includes('Хранилище браузера недоступно')); await isolated.close();
    });
    await check('Direct file:// launch works without a server, modules or network assets', async () => {
      const p = await context.newPage(); p.on('pageerror', e => errors.push(e.message)); const requests = []; p.on('request', r => requests.push(r.url()));
      try { await p.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href); }
      catch (error) { await p.close(); if (error.message.includes('ERR_BLOCKED_BY_ADMINISTRATOR')) return 'Managed browser policy blocks file://. HTTP launch is tested separately.'; throw error; }
      await p.click('#play'); await p.waitForTimeout(250); assert.ok(await p.evaluate(() => NE.game.time > 0 && !!NE.renderer.ctx)); assert.ok(requests.every(url => /^(file:|data:)/.test(url))); await p.close();
    });
    await check('Mobile portrait: simultaneous joystick, boost and ability touches', async () => {
      const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const p = await mobile.newPage(); p.on('pageerror', e => errors.push(e.message)); await p.goto(URL); await p.tap('#play');
      await p.evaluate(() => { const g = NE.game; g.food = []; g.enemies = []; g.spawnTimer = -10000; g.nextEvent = Infinity; g.nextBoss = Infinity; g.player.energy = 90; });
      const stick = await p.locator('#joystick').boundingBox(), boost = await p.locator('#boost-button').boundingBox(), ability = await p.locator('[data-ability="pulse"]').boundingBox(); const cdp = await mobile.newCDPSession(p);
      const finger1 = { x: stick.x + stick.width * .8, y: stick.y + stick.height / 2, id: 1 }, finger2 = { x: boost.x + boost.width / 2, y: boost.y + boost.height / 2, id: 2 }, finger3 = { x: ability.x + ability.width / 2, y: ability.y + ability.height / 2, id: 3 };
      const start = await p.evaluate(() => NE.game.player.x); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [finger1] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [finger1, finger2] }); await p.waitForTimeout(300);
      assert.ok(await p.evaluate(() => NE.game.player.x) > start + 30); assert.ok(await p.evaluate(() => NE.game.player.boosting));
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [finger1, finger2, finger3] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [finger1, finger2] }); await p.waitForTimeout(100); assert.equal(await p.evaluate(() => NE.game.stats.abilities), 1);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(100); assert.equal(await p.evaluate(() => NE.Input.boosting()), false); assert.deepEqual(await p.evaluate(() => NE.Input.direction()), { x: 0, y: 0 });
      await p.screenshot({ path: '/tmp/neon-mobile-portrait.png' }); await mobile.close();
    });
    await check('Mobile landscape UI and multi-touch pointer cancellation', async () => {
      const mobile = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }); const p = await mobile.newPage(); p.on('pageerror', e => errors.push(e.message)); await p.goto(URL); await p.tap('#play'); const b = await p.locator('#joystick').boundingBox(); assert.ok(b.y + b.height < 391);
      const cdp = await mobile.newCDPSession(p); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x + b.width * .8, y: b.y + b.height / 2, id: 1 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); assert.equal(await p.evaluate(() => Math.hypot(...Object.values(NE.Input.direction())) === 0), true);
      await p.screenshot({ path: '/tmp/neon-mobile-landscape.png' }); await mobile.close();
    });
    await check('No uncaught JavaScript errors across desktop, file and mobile scenarios', async () => assert.deepEqual(errors, []));
    console.log(`\n${passed} browser checks passed, ${skipped} skipped.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
