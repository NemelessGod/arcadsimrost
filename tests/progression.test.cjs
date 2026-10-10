'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('playwright');
const URL = process.env.NE_TEST_URL || 'http://127.0.0.1:8080';
let count = 0;
async function check(name, run) { await run(); console.log(`PASS ${++count} · ${name}`); }

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL);
  async function helpers() {
    await page.evaluate(() => {
      window.fresh = () => { NE.UI.mainMenu(); NE.Save.importText('{"version":3}'); NE.Hub.updateMenu(); };
      window.fixture = (sector) => {
        NE.UI.start(false, sector === undefined ? {} : { mode: 'campaign', sectorId: sector });
        const g = NE.game; g.food = []; g.enemies = []; g.spawnTimer = -10000; g.nextEvent = Infinity; g.nextBoss = Infinity; g.questIndex = g.quests.length; g.player.invulnerable = 0; g.grid.rebuild([g.player]); return g;
      };
      window.unlockAll = () => { NE.Save.data.campaign.stars = [1, 1, 1, 1, 1, 1]; };
      window.meetGoals = g => { for (const goal of g.sector.goals) { if (['level', 'mass'].includes(goal.key)) g.player[goal.key] = goal.target; else if (goal.key === 'time') g.time = goal.target; else g.stats[goal.key] = goal.target; } };
    });
  }
  await helpers();
  try {
    await check('Fresh profile, six sectors and lock enforcement', async () => {
      await page.evaluate(() => fresh()); await page.click('[data-action="campaign"]');
      assert.equal(await page.locator('.sector-card').count(), 6); assert.equal(await page.locator('[data-sector]:disabled').count(), 5);
      assert.equal(await page.evaluate(() => NE.UI.start(false, { mode: 'campaign', sectorId: 4 })), false);
      assert.equal(await page.evaluate(() => NE.game), null); await page.click('[data-sector="0"]');
      assert.equal(await page.evaluate(() => NE.game.sector.biome), 'nursery');
    });
    await check('Real collection, level growth and campaign HUD', async () => {
      assert.equal(await page.evaluate(() => {
        fresh(); const g = fixture(0); for (let i = 0; i < 40; i++) g.collect(NE.Entities.food(g.player.x, g.player.y));
        while (g.pendingUpgrades) { if (g.state !== 'upgrade') NE.UI.showUpgrade(g); g.applyUpgrade(g.offered[0]); }
        if (NE.Progress.campaignProgress(g).complete) return false; // The level objective still matters.
        g.addXP(150); while (g.pendingUpgrades) g.applyUpgrade(g.offered[0]);
        NE.UI.updateHUD(g); return g.player.level >= 4 && NE.Progress.campaignProgress(g).complete && document.getElementById('quest-title').textContent.includes('40 частиц');
      }), true);
    });
    await check('Large prey still rewards growth while limiting exponential mass and XP inflation', async () => {
      assert.equal(await page.evaluate(() => {
        fresh(); const g = fixture(), p = g.player; p.upgrades.xp = 2; p.upgrades.growth = 1; const mass = p.mass;
        g.absorb(NE.Entities.enemy(1, p.x, p.y, 650));
        const earned = p.xp + 42 + 60; // The first two level thresholds consumed 102 XP.
        return p.level === 3 && Math.abs(earned - 130) < .001 && Math.abs(p.mass - mass - 70 * 1.18) < .001 && g.labels.at(-1).text === '+130 XP';
      }), true);
    });
    await check('Campaign completion, stars, rewards, next-sector button and restart', async () => {
      assert.equal(await page.evaluate(() => {
        fresh(); const g = fixture(0); meetGoals(g); g.time = 30; g.score = 1500; g.update(1 / 60);
        return g.state === 'result' && g.win && NE.Save.data.campaign.stars[0] === 3 && NE.Progress.isSectorUnlocked(1) && !NE.Progress.isSectorUnlocked(2) && g.settlement.firstClear && g.settlement.crystals >= 175;
      }), true);
      await page.click('[data-sector="1"]'); assert.equal(await page.evaluate(() => NE.game.sector.id), 1);
      await page.keyboard.press('Escape'); await page.click('[data-ui="restart"]'); assert.equal(await page.evaluate(() => NE.game.sector.id), 1);
    });
    await check('First-clear prizes and improved stars cannot be claimed repeatedly', async () => {
      assert.equal(await page.evaluate(() => {
        fresh(); const first = fixture(0); meetGoals(first); first.time = 35; first.score = 600; first.player.hp = 40; first.end(true);
        const a = first.settlement; const second = fixture(0); meetGoals(second); second.time = 35; second.score = 1600; second.player.hp = 100; second.end(true);
        const b = second.settlement; const third = fixture(0); meetGoals(third); third.time = 35; third.score = 1600; third.player.hp = 100; third.end(true);
        const c = third.settlement; return a.stars === 1 && b.stars === 3 && c.stars === 3 && !b.firstClear && !c.firstClear && b.crystals - c.crystals === 50 && NE.Save.data.campaign.stars[0] === 3;
      }), true);
    });
    await check('Each of the six mission conditions requires every goal', async () => {
      assert.equal(await page.evaluate(() => {
        fresh(); unlockAll();
        for (let id = 0; id < 6; id++) { const g = fixture(id); if (NE.Progress.campaignProgress(g).complete) return false; meetGoals(g); if (!NE.Progress.campaignProgress(g).complete) return false; const goal = g.sector.goals.at(-1); if (['level', 'mass'].includes(goal.key)) g.player[goal.key] = goal.target - 1; else if (goal.key === 'time') g.time = goal.target - 1; else g.stats[goal.key] = goal.target - 1; if (NE.Progress.campaignProgress(g).complete) return false; }
        return true;
      }), true);
    });
    await check('Current biome drifts player and enemies; wild arena does not drift', async () => {
      assert.equal(await page.evaluate(() => {
        fresh(); unlockAll(); const g = fixture(2), p = g.player, x = p.x, y = p.y, e = g.spawnEnemy(0, p.x + 100, p.y, 8); const ex = e.x;
        g.update(.2); if (Math.hypot(p.x - x, p.y - y) <= 1 || e.x === ex || !g.currentAt(600, 800).x) return false;
        const normal = fixture(), ox = normal.player.x, oy = normal.player.y; normal.update(.2); return normal.player.x === ox && normal.player.y === oy;
      }), true);
    });
    await check('Ion fields telegraph, damage, and respect phase invulnerability', async () => {
      assert.equal(await page.evaluate(() => {
        fresh(); unlockAll(); const g = fixture(3), z = g.terrain[0], p = g.player; p.x = z.x; p.y = z.y; g.time = 0; g.updateTerrain(); if (p.hp !== 100) return false;
        g.time = 3; g.updateTerrain(); if (p.hp !== 87) return false; p.invulnerable = 0; p.phase = 1; g.updateTerrain(); return p.hp === 87 && g.eventIndex === 2;
      }), true);
    });
    await check('Abyss, palette, food population and empowered boss alter gameplay', async () => {
      assert.equal(await page.evaluate(() => {
        fresh(); unlockAll(); NE.UI.start(false, { mode: 'campaign', sectorId: 4 }); if (NE.game.biome !== 'abyss' || NE.game.food.length !== 315) return false;
        const core = fixture(5); core.spawnBoss(); const normal = new NE.Game(); normal.spawnBoss();
        if (Math.abs(core.boss.maxHp / normal.boss.maxHp - 1.35) > .001 || !core.boss.empowered || core.terrain.length !== 8) return false;
        core.boss.state = 'recover'; core.boss.timer = 0; core.boss.attackCount = 1; NE.AI.boss(core.boss, core, 1 / 60); return core.projectiles[0].damage > 19;
      }), true);
    });
    await check('Core victory opens final achievement and uses health before boss healing', async () => {
      assert.equal(await page.evaluate(() => {
        fresh(); unlockAll(); NE.Save.data.campaign.stars[5] = 0; const g = fixture(5); g.spawnBoss(); g.score = 16000; g.player.hp = 20; g.damageEnemy(g.boss, 1e6);
        return g.win && g.state === 'result' && g.settlement.stars === 2 && NE.Save.data.achievements.includes('expedition') && document.getElementById('dialog-content').textContent.includes('Все шесть миров');
      }), true);
    });
    await check('Death settles rewards once; instant deaths earn no currency or mastery', async () => {
      assert.equal(await page.evaluate(() => {
        fresh(); const instant = fixture(); instant.hurt(1000); if (instant.settlement.xp || instant.settlement.rating || instant.settlement.crystals) return false;
        const g = fixture(); g.time = 90; g.stats.food = 120; g.stats.kills = 5; const before = NE.Save.data.profile.xp; g.end(false); const data = NE.Save.exportText(); NE.Save.record(g, false); NE.Progress.settle(g, false); return g.settlement.xp > 0 && g.settlement.crystals > 0 && NE.Save.data.profile.xp > before && NE.Save.exportText() === data;
      }), true);
    });
    await check('Profile-level boundaries and all six league boundaries', async () => {
      assert.equal(await page.evaluate(() => {
        if (NE.Progress.profile(149).level !== 1 || NE.Progress.profile(150).level !== 2 || NE.Progress.profile(360).level !== 3 || NE.Progress.profile(1e8).level !== 50) return false;
        return NE.leagues.every((l, i) => NE.Progress.league(l.points).id === l.id && (i === 0 || NE.Progress.league(l.points - 1).index === i - 1));
      }), true);
    });
    await check('League promotion settles a real run and claims each prize once', async () => {
      assert.equal(await page.evaluate(() => {
        fresh(); NE.Save.data.profile.rating = 195; const g = fixture(); g.time = 60; g.stats.food = 40; g.stats.kills = 4; g.end(false);
        if (!g.settlement.promoted || g.settlement.league !== 'Бронза' || !NE.Progress.claimLeague('bronze')) return false;
        const balance = NE.Save.data.profile.crystals; if (NE.Progress.claimLeague('bronze') || NE.Save.data.profile.crystals !== balance || NE.Progress.claimLeague('gold')) return false;
        NE.Save.data.profile.rating = 1400; return NE.Progress.claimLeague('gold') && NE.Save.data.cosmetics.owned.includes('archon') && NE.Save.data.achievements.includes('goldLeague');
      }), true);
    });
    await check('All 15 path prizes unlock at thresholds; three exclusive skins and duplicate guards', async () => {
      assert.equal(await page.evaluate(() => {
        fresh(); if (NE.Progress.claimPath(1)) return false; NE.Save.data.profile.xp = 3600;
        for (const r of NE.pathRewards) { if (!NE.Progress.claimPath(r.step)) return false; const balance = NE.Save.data.profile.crystals; if (NE.Progress.claimPath(r.step) || balance !== NE.Save.data.profile.crystals) return false; }
        return ['void', 'aurora', 'nebula'].every(id => NE.Save.data.cosmetics.owned.includes(id)) && NE.Save.data.claims.path.length === 15;
      }), true);
    });
    await check('Purchases enforce price, ownership and cosmetic-only statistics', async () => {
      assert.equal(await page.evaluate(() => {
        fresh(); if (NE.Progress.buy('solar') || NE.Progress.equip('archon')) return false;
        NE.Save.data.profile.crystals = 2000; const baseline = new NE.Game().player; if (!NE.Progress.buy('solar') || NE.Save.data.profile.crystals !== 1820 || NE.Progress.buy('solar')) return false;
        const painted = new NE.Game().player; if (painted.paint !== 'solar' || painted.mass !== baseline.mass || painted.hp !== baseline.hp || painted.energy !== baseline.energy) return false;
        for (const id of ['glacier', 'orchid', 'ember', 'mono']) if (!NE.Progress.buy(id)) return false;
        return NE.Save.data.achievements.includes('collector') && NE.Progress.equip('mint') && NE.Save.data.cosmetics.selected === 'mint';
      }), true);
    });
    await check('Shop canvases are populated, purchase and equip buttons work', async () => {
      await page.evaluate(() => { fresh(); NE.Save.data.profile.crystals = 900; NE.Save.persist(); }); await page.click('[data-action="skins"]'); assert.equal(await page.locator('[data-skin-preview]').count(), 12);
      await page.waitForTimeout(100); assert.equal(await page.evaluate(() => [...document.querySelectorAll('[data-skin-preview]')].every(c => c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some(v => v > 0))), true);
      await page.click('[data-buy="prism"]'); assert.equal(await page.evaluate(() => NE.Save.data.cosmetics.selected), 'prism'); assert.equal(await page.evaluate(() => NE.Save.data.profile.crystals), 250);
      await page.click('[data-equip="mint"]'); assert.equal(await page.evaluate(() => NE.Save.data.cosmetics.selected), 'mint'); await page.click('#dialog-close');
    });
    await check('Daily contracts deterministic, unique, credited on completion, and reset next day', async () => {
      assert.equal(await page.evaluate(() => {
        fresh(); const day = NE.Progress.ensureDaily(), list = NE.Progress.dailyList(); if (new Set(list.map(c => c.id)).size !== 3 || JSON.stringify(list) !== JSON.stringify(NE.Progress.dailyList())) return false;
        const g = fixture(); for (const key of ['food', 'kills', 'abilities', 'events', 'bosses']) g.stats[key] = 200; g.time = 300; g.end(false);
        for (const c of list) { if (!NE.Progress.claimContract(c.id)) return false; const balance = NE.Save.data.profile.crystals; if (NE.Progress.claimContract(c.id) || balance !== NE.Save.data.profile.crystals) return false; }
        const balance = NE.Save.data.profile.crystals; const tomorrow = NE.Progress.ensureDaily('2099-01-02'); return tomorrow.food === 0 && tomorrow.claimed.length === 0 && NE.Save.data.profile.crystals === balance && day.day !== tomorrow.day;
      }), true);
    });
    await check('Claim buttons, contracts and campaign record tabs navigate correctly', async () => {
      await page.evaluate(() => { fresh(); NE.Save.data.profile.xp = 1500; NE.Save.data.profile.rating = 1400; NE.Save.persist(); }); await page.click('[data-action="prizes"]'); await page.click('[data-claim-league="gold"]'); assert.equal(await page.locator('[data-claim-league="gold"]').isDisabled(), true);
      await page.click('[data-prize-tab="path"]'); await page.click('[data-claim-path="5"]'); assert.equal(await page.evaluate(() => NE.Save.data.cosmetics.owned.includes('void')), true); await page.click('#dialog-close');
      await page.click('[data-action="contracts"]'); assert.equal(await page.locator('.contract-card').count(), 3); await page.click('[data-ui="close"]'); await page.click('[data-action="records"]'); await page.click('[data-tab="campaign"]'); assert.ok((await page.locator('#dialog-content').textContent()).includes('Твоя история')); await page.click('#dialog-close');
    });
    await check('Version 2 migrates without losing settings, forms, records and legacy gift', async () => {
      const legacyContext = await browser.newContext(), p = await legacyContext.newPage(); p.on('pageerror', e => errors.push(e.message));
      await p.addInitScript(() => { if (!localStorage.getItem('neon-evolution.save')) localStorage.setItem('neon-evolution.save', JSON.stringify({ version: 2, runs: 3, forms: [0, 1, 2], selectedForm: 2, settings: { volume: .61, quality: 'low', sound: false }, achievements: ['first'], records: { survival: [{ score: 9000, time: 160, stage: 2, win: false, date: '2026-10-10' }], endless: [] } })); });
      await p.goto(URL); const data = await p.evaluate(() => ({ version: NE.Save.data.version, volume: NE.Save.data.settings.volume, form: NE.Save.data.selectedForm, score: NE.Save.best(), crystals: NE.Save.data.profile.crystals, xp: NE.Save.data.profile.xp }));
      assert.deepEqual(data, { version: 3, volume: .61, form: 2, score: 9000, crystals: 60, xp: 240 }); await p.reload(); assert.equal(await p.evaluate(() => NE.Save.data.profile.crystals), 60); await legacyContext.close();
    });
    await check('Backup export downloads valid JSON; import restores and rejects corruption atomically', async () => {
      await page.evaluate(() => { fresh(); NE.Save.data.profile.crystals = 777; NE.Save.data.campaign.stars = [3, 1, 0, 0, 0, 0]; NE.Save.data.cosmetics.owned.push('solar'); NE.Save.data.cosmetics.selected = 'solar'; NE.Save.data.settings.touch = true; NE.Save.persist(); }); await page.click('[data-action="profile"]');
      const downloadPromise = page.waitForEvent('download'); await page.click('[data-hub-action="export"]'); const download = await downloadPromise; const text = await fs.readFile(await download.path(), 'utf8'); assert.equal(JSON.parse(text).profile.crystals, 777);
      await page.evaluate(() => { NE.Save.data.profile.crystals = 1; NE.Save.data.settings.touch = false; document.body.classList.remove('touch'); NE.Save.persist(); });
      await page.locator('#save-import').setInputFiles({ name: 'profile.json', mimeType: 'application/json', buffer: Buffer.from(text) }); await page.waitForFunction(() => NE.Save.data.profile.crystals === 777);
      assert.equal(await page.evaluate(() => document.body.classList.contains('touch') && NE.Save.data.settings.touch), true);
      const before = await page.evaluate(() => NE.Save.exportText()); await page.locator('#save-import').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{broken') }); await page.waitForTimeout(100); assert.equal(await page.evaluate(() => NE.Save.exportText()), before);
      await page.reload(); await helpers(); assert.equal(await page.evaluate(() => NE.Save.data.cosmetics.selected), 'solar'); assert.deepEqual(await page.evaluate(() => NE.Save.data.campaign.stars), [3, 1, 0, 0, 0, 0]);
    });
    await check('Malformed v3 profile, out-of-order sectors, claims and cosmetic IDs are sanitized', async () => {
      assert.equal(await page.evaluate(() => {
        const data = NE.Save.validate({ version: 3, profile: { xp: -7, crystals: Infinity, rating: '999', bestLevel: 900 }, campaign: { stars: [0, 3, 3, -5, 100, '3'], selected: 900 }, cosmetics: { owned: ['forged', 'mint', 'solar', 'solar'], selected: 'forged' }, claims: { path: [15, 99], leagues: ['gold', 'forged'] } });
        return data.profile.xp === 0 && data.profile.crystals === 0 && data.profile.bestLevel === 50 && data.campaign.stars.every(n => n === 0) && data.campaign.selected === 0 && data.cosmetics.selected === 'mint' && data.cosmetics.owned.length === 2 && !data.claims.path.length && !data.claims.leagues.length;
      }), true);
    });
    await check('Profile focus stays inside dialog; all new panels fit mobile portrait and landscape', async () => {
      await page.click('[data-action="profile"]'); await page.locator('[data-hub-action="import"]').focus(); await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.id), 'dialog-close'); await page.click('#dialog-close');
      for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
        const mobile = await browser.newContext({ viewport, isMobile: true, hasTouch: true }), p = await mobile.newPage(); p.on('pageerror', e => errors.push(e.message)); await p.goto(URL);
        for (const action of ['profile', 'campaign', 'skins', 'prizes', 'contracts']) { await p.tap(`[data-action="${action}"]`); assert.equal(await p.evaluate(() => document.getElementById('dialog').scrollWidth <= document.getElementById('dialog').clientWidth + 1), true); await p.tap('#dialog-close'); }
        await p.tap('[data-action="campaign"]'); await p.tap('[data-sector="0"]'); assert.equal(await p.evaluate(() => NE.game.mode), 'campaign'); await mobile.close();
      }
    });
    await check('No uncaught JS errors across progression, purchases, import and mobile panels', async () => assert.deepEqual(errors, []));
    console.log(`\n${count} progression checks passed.`);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
