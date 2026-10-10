'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const URL = process.env.NE_TEST_URL || 'http://127.0.0.1:8080';
let count = 0;
async function check(name, run) { await run(); console.log(`PASS ${++count} · ${name}`); }

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } }), errors = [];
  page.on('pageerror', e => errors.push(e.message)); await page.goto(URL);
  try {
    await check('Three palettes change both interface and Canvas and persist after reload', async () => {
      await page.click('[data-action=settings]'); const colors = [];
      for (const id of ['lagoon', 'ultraviolet', 'solar']) {
        await page.click(`[data-theme-choice=${id}]`);
        colors.push(await page.evaluate(() => ({ color: getComputedStyle(document.documentElement).getPropertyValue('--mint'), primary: NE.Visuals.palette().primary })));
        assert.equal(await page.locator(`[data-theme-choice=${id}]`).getAttribute('aria-pressed'), 'true');
        assert.equal(await page.locator('[data-theme-choice][aria-pressed=true]').count(), 1);
      }
      assert.equal(new Set(colors.map(v => v.color)).size, 3); assert.equal(new Set(colors.map(v => v.primary)).size, 3);
      await page.reload(); assert.equal(await page.evaluate(() => NE.Save.data.settings.theme === 'solar' && document.documentElement.dataset.theme === 'solar'), true);
    });
    await check('Glow, contrast and reduced ambient motion work and survive reload', async () => {
      await page.click('[data-action=settings]'); await page.locator('#contrast-setting').check(); await page.locator('#motion-setting').uncheck();
      await page.locator('#glow-setting').evaluate(n => { n.value = '0'; n.dispatchEvent(new Event('input', { bubbles: true })); });
      assert.equal(await page.evaluate(() => { NE.renderer.glow('#ffffff', 100); return NE.renderer.ctx.shadowBlur === 0 && document.documentElement.dataset.motion === 'reduced' && document.documentElement.dataset.contrast === 'high'; }), true);
      await page.reload(); assert.deepEqual(await page.evaluate(() => ({ glow: NE.Save.data.settings.glow, motion: NE.Save.data.settings.motion, contrast: NE.Save.data.settings.contrast })), { glow: 0, motion: false, contrast: true });
      assert.equal(await page.evaluate(() => { const r = NE.renderer; r.menu(.1); const a = r.canvas.toDataURL(); r.menu(3); return r.canvas.toDataURL() === a; }), true);
    });
    await check('System reduced-motion preference is honored on a fresh profile', async () => {
      const context = await browser.newContext({ reducedMotion: 'reduce' }), p = await context.newPage(); p.on('pageerror', e => errors.push(e.message)); await p.goto(URL);
      assert.equal(await p.evaluate(() => NE.Save.data.settings.motion === false && document.documentElement.dataset.motion === 'reduced'), true); await context.close();
    });
    await check('Old saves and malformed visual settings recover with valid defaults', async () => {
      assert.equal(await page.evaluate(() => {
        const legacy = NE.Save.validate({ version: 3, profile: { crystals: 477 }, settings: { volume: .2 } });
        const bad = NE.Save.validate({ version: 3, settings: { theme: '<script>', glow: -900, contrast: 'true', motion: [] } });
        const max = NE.Save.validate({ version: 2, settings: { theme: 'solar', glow: 300, motion: false } });
        return legacy.profile.crystals === 477 && legacy.settings.theme === 'lagoon' && bad.settings.theme === 'lagoon' && bad.settings.glow === 0 && !bad.settings.contrast && max.settings.glow === 1 && !max.settings.motion;
      }), true);
    });
    await check('All sectors render in every palette and quality; texture cache remains bounded', async () => {
      const results = await page.evaluate(() => {
        NE.Save.data.expedition.stars = [1, 1, 1, 1, 1]; const hashes = [], r = NE.renderer;
        for (const quality of ['low', 'medium', 'high']) for (const theme of Object.keys(NE.Visuals.themes)) {
          NE.Save.setting('quality', quality); NE.Save.setting('theme', theme); NE.Visuals.apply(); r.resize();
          for (let id = 0; id < 5; id++) {
            NE.UI.start(false, { mode: 'campaign', sectorId: id }); const g = NE.game; g.state = 'paused';
            r.world(g, 1 / 60); const c = r.ctx.getImageData(500, 300, 1, 1).data; hashes.push([...c].join(','));
            if (NE.Visuals.cacheSize > 3 || NE.Visuals.texture(g.biome).width !== (quality === 'low' ? 256 : 512)) return [];
          }
        }
        NE.UI.mainMenu(); return hashes;
      });
      assert.equal(results.length, 45); assert.ok(new Set(results).size > 10);
    });
    await check('Field atlas displays six distinct procedural species and three abilities', async () => {
      await page.click('[data-action=codex]'); assert.equal(await page.locator('.codex-card').count(), 6); assert.equal(await page.locator('.codex-abilities>div').count(), 3);
      const previews = await page.locator('[data-creature-preview]').evaluateAll(nodes => nodes.map(n => n.toDataURL())); assert.equal(new Set(previews).size, 6);
      assert.equal(await page.locator('.relation-guide>div').count(), 3); await page.locator('#dialog').evaluate(n => { n.scrollTop = n.scrollHeight; }); await page.click('#dialog-close');
      await page.click('[data-action=settings]'); assert.equal(await page.locator('#dialog').evaluate(n => n.scrollTop), 0); await page.click('#dialog-close');
      await page.click('#play'); await page.keyboard.press('Escape'); await page.click('[data-ui=codex]'); await page.keyboard.press('Escape');
      assert.equal(await page.locator('[data-ui=resume]').count(), 1); assert.equal(await page.evaluate(() => NE.game.state), 'paused'); await page.click('[data-ui=resume]');
    });
    await check('Number keys choose the offered upgrade once and return to the game', async () => {
      const id = await page.evaluate(() => { NE.game.addXP(43); return NE.game.offered[1]; }); assert.equal(await page.locator('.upgrade-key').count(), 3);
      await page.keyboard.press('Digit2'); assert.equal(await page.evaluate(id => NE.game.player.upgrades[id], id), 1); assert.equal(await page.evaluate(() => NE.game.state), 'running');
      await page.keyboard.press('Digit2'); assert.equal(await page.evaluate(id => NE.game.player.upgrades[id], id), 1);
    });
    await check('Every actual damage source creates an accurate death recap; immunity preserves the source', async () => {
      assert.equal(await page.evaluate(() => {
        const expected = ['Ловец', 'Столкновение с Архонтом', 'Снаряд Архонта', 'Ударная волна Архонта', 'Разряд ионного поля', 'Ионная буря'];
        for (let i = 0; i < 6; i++) {
          NE.UI.start(); const g = NE.game, p = g.player; g.food = []; g.enemies = []; p.invulnerable = 0; p.hp = 1;
          if (i < 2) { const e = i === 0 ? NE.Entities.enemy(3, p.x, p.y, 180) : NE.Entities.boss(g); e.x = p.x; e.y = p.y; g.grid.rebuild([p, e]); NE.Collisions.actors(g, 1 / 60); }
          if (i === 2) { g.grid.rebuild([p]); g.projectile(p.x, p.y, 0, 0, 19); NE.Collisions.actors(g, 1 / 60); }
          if (i === 3) { g.grid.rebuild([p]); g.wave(p.x, p.y, 300, 19); NE.Collisions.actors(g, 1 / 60); }
          if (i === 4) { g.terrain = [{ x: p.x, y: p.y, r: 100, offset: 0 }]; g.time = 3; g.updateTerrain(); }
          if (i === 5) { g.startEvent('storm'); const z = g.event.zones[0]; p.x = z.x; p.y = z.y; g.event.age = 3; g.updateEvent(1 / 60); }
          if (g.state !== 'result' || !document.querySelector('.defeat-recap').textContent.includes(expected[i])) return false;
        }
        NE.UI.start(); const g = NE.game; g.player.invulnerable = 0; g.hurt(2, { kind: 'shot' }); g.hurt(999, { kind: 'wave' }); return g.lastHit.kind === 'shot' && g.player.hp === 98;
      }), true);
    });
    await check('Death and boss victory stop the same collision pass and preserve the recorded result', async () => {
      assert.equal(await page.evaluate(() => {
        NE.UI.start(); const g = NE.game, p = g.player; g.food = []; p.hp = 1; p.invulnerable = 0;
        const killer = NE.Entities.enemy(3, p.x, p.y, 200), food = NE.Entities.enemy(0, p.x, p.y, 8); g.enemies = [killer, food]; g.grid.rebuild(g.enemies, [p]);
        NE.Collisions.actors(g, 1 / 60);
        if (g.state !== 'result' || g.stats.kills !== 0 || food.dead || p.mass !== 18 || g.score !== NE.Save.data.records.survival.find(r => !r.win && r.time === g.time).score) return false;
        NE.UI.start(); const b = NE.game; b.food = []; b.spawnBoss(); b.boss.x = b.player.x; b.boss.y = b.player.y; b.boss.hp = 1;
        const prey = NE.Entities.enemy(0, b.player.x, b.player.y, 8); b.enemies = [prey]; b.grid.rebuild([b.boss, prey, b.player]);
        b.useAbility('pulse');
        return b.state === 'result' && b.win && !prey.dead && b.stats.kills === 0 && b.score === NE.Save.data.records.survival.find(r => r.win && r.time === b.time).score;
      }), true);
    });
    await check('Evolution and boss-phase banners expire with effects and do not advance during pause', async () => {
      assert.equal(await page.evaluate(() => {
        NE.UI.start(); const g = NE.game; g.player.level = 4; g.checkEvolution(); if (!g.announcement.title.includes('ЛУЧ')) return false;
        g.updateEffects(4); if (g.announcement.life !== 0) return false; g.spawnBoss(); if (!g.announcement.title.includes('АРХОНТ')) return false;
        g.boss.hp *= .2; NE.AI.boss(g.boss, g, 1 / 60); if (!g.announcement.title.includes('III')) return false;
        const life = g.announcement.life; NE.UI.pause(); g.update(2); return g.announcement.life === life;
      }), true);
    });
    await check('New settings and atlas fit mobile portrait and landscape with working navigation', async () => {
      for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
        const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true }), p = await context.newPage(); p.on('pageerror', e => errors.push(e.message)); await p.goto(URL);
        await p.tap('[data-action=codex]'); assert.equal(await p.locator('.codex-card').count(), 6);
        assert.equal(await p.locator('#dialog').evaluate(n => n.scrollWidth <= n.clientWidth + 2), true); await p.tap('#dialog-close');
        await p.tap('[data-action=settings]'); await p.tap('[data-theme-choice=solar]'); assert.equal(await p.evaluate(() => NE.Save.data.settings.theme), 'solar');
        assert.equal(await p.locator('#dialog').evaluate(n => n.scrollWidth <= n.clientWidth + 2), true);
        await p.locator('[data-ui=close]').tap(); await p.tap('#play'); assert.equal(await p.evaluate(() => NE.game.state), 'running'); await context.close();
      }
    });
    await check('No uncaught JavaScript errors across new render paths and UI scenarios', async () => assert.deepEqual(errors, []));
    console.log(`\n${count} visual and polish checks passed.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
