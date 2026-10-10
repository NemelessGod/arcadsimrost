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
      window.fresh = () => { NE.UI.mainMenu(); NE.Save.importText('{"version":4}'); NE.Hub.updateMenu(); };
      window.fixture = (sector) => {
        NE.UI.start(false, sector === undefined ? {} : { mode: 'campaign', sectorId: sector });
        const g = NE.game; g.food = []; g.enemies = []; g.spawnTimer = -10000; g.nextEvent = Infinity; g.nextBoss = Infinity; g.questIndex = g.quests.length; g.player.invulnerable = 0; g.grid.rebuild([g.player]); return g;
      };
      window.unlockAll = () => { NE.Save.data.expedition.stars = [1, 1, 1, 1, 1]; };
      window.resolve = g => { while (g.pendingUpgrades) { if (g.state !== 'upgrade') NE.UI.showUpgrade(g); g.applyUpgrade(g.offered[0]); } };
      window.meetGoals = g => { g.stats.food = g.sector.energy; g.player.level = g.sector.level; g.mission.update(1 / 60); };
    });
  }
  await helpers();
  try {
    await check('Fresh profile, five story sectors and lock enforcement', async () => {
      await page.evaluate(() => fresh()); await page.click('[data-action="campaign"]');
      assert.equal(await page.locator('.sector-card').count(), 5); assert.equal(await page.locator('[data-sector]:disabled').count(), 4);
      assert.equal(await page.evaluate(() => NE.UI.start(false, { mode: 'campaign', sectorId: 4 })), false);
      assert.equal(await page.evaluate(() => NE.game), null); await page.click('[data-sector="0"]'); assert.equal(await page.evaluate(() => NE.game), null); await page.click('[data-launch="0"]');
      assert.equal(await page.evaluate(() => NE.game.sector.biome), 'nursery');
    });
    await check('Real energy collection and evolution unlock relay exploration, not automatic victory', async () => {
      assert.equal(await page.evaluate(() => {
        fresh(); const g = fixture(0); for (let i = 0; i < 60; i++) g.collect(NE.Entities.food(g.player.x, g.player.y)); resolve(g);
        if (g.player.level >= 4) return false;
        g.addXP(400); resolve(g); g.mission.update(1 / 60); NE.UI.updateHUD(g);
        return g.player.level >= 4 && g.mission.phase === 'objectives' && g.state === 'running' && document.getElementById('quest-title').textContent.includes('три реле');
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
    await check('Cradle relays, final defense, physical exit, rewards, next briefing and restart', async () => {
      assert.equal(await page.evaluate(() => {
        fresh(); const g = fixture(0); meetGoals(g); resolve(g);
        for (const o of g.mission.objects) { g.player.x = o.x; g.player.y = o.y; for (let n = 0; n < 400; n++) { g.mission.update(1 / 60); resolve(g); } }
        if (g.mission.phase !== 'trial' || !g.mission.defense) return false;
        const d = g.mission.defense; g.player.x = d.x; g.player.y = d.y; g.time = 130;
        for (let n = 0; n < 2750; n++) g.mission.update(1 / 60);
        if (g.mission.phase !== 'exit' || g.state === 'result' || NE.Progress.isSectorUnlocked(1)) return false;
        g.player.x = g.mission.exit.x; g.player.y = g.mission.exit.y; g.score = 10000; g.mission.update(1 / 60);
        return g.win && g.state === 'result' && NE.Save.data.expedition.stars[0] === 3 && NE.Save.data.expedition.samples === 4 && NE.Progress.isSectorUnlocked(1) && !NE.Progress.isSectorUnlocked(2) && g.settlement.firstClear && g.settlement.crystals >= 175;
      }), true);
      await page.click('[data-sector="1"]'); assert.ok((await page.locator('#dialog-title').textContent()).includes('Заражённый сад')); await page.click('[data-launch="1"]');
      assert.equal(await page.evaluate(() => NE.game.sector.id), 1);
      await page.keyboard.press('Escape'); await page.click('[data-ui="restart"]'); assert.equal(await page.evaluate(() => NE.game.sector.id), 1);
    });
    await check('First-clear reward, improved stars and repeat samples settle only once', async () => {
      assert.equal(await page.evaluate(() => {
        fresh(); const first = fixture(0); first.time = 130; first.score = 600; first.player.hp = 40; first.end(true);
        const a = first.settlement; const second = fixture(0); second.time = 130; second.score = 10000; second.end(true);
        const b = second.settlement; const third = fixture(0); third.time = 130; third.score = 10000; third.end(true);
        const c = third.settlement, balance = NE.Save.data.expedition.samples; NE.Save.record(third, true);
        return a.stars === 1 && b.stars === 3 && c.stars === 3 && a.samples === 4 && b.samples === 1 && balance === 6 && NE.Save.data.expedition.samples === balance && b.crystals - c.crystals === 50;
      }), true);
    });
    await check('Four nest shells take damage from Q, E, R and contact; spores disappear after cleansing', async () => {
      assert.equal(await page.evaluate(() => {
        fresh(); unlockAll(); const g = fixture(1); meetGoals(g); resolve(g); const o = g.mission.objects[0], p = g.player;
        p.x = o.x; p.y = o.y; p.level = 7; g.grid.rebuild([p], g.mission.objects); const hp = o.hp;
        g.useAbility('pulse'); if (o.hp >= hp) return false;
        g.useAbility('vortex'); NE.Collisions.actors(g, .2); if (o.hp >= hp - 35) return false;
        g.useAbility('phase'); NE.Collisions.actors(g, .2); if (!p.phaseHits.has(o.id)) return false;
        g.damageEnemy(o, 10000); if (!o.disabled || o.dead) return false;
        g.time = 20; p.maxEnergy = p.energy = 250; g.enemies = []; for (let n = 0; n < 2420; n++) { g.mission.update(1 / 60); resolve(g); }
        return o.dead && g.mission.slowAt(p) === 1 && g.mission.phase === 'objectives';
      }), true);
    });
    await check('Solid obstacles block actors; phase crosses them; AI steers around obstacles', async () => {
      assert.equal(await page.evaluate(() => {
        fresh(); const g = fixture(0), o = g.mission.obstacles[0], p = g.player; p.x = o.x; p.y = o.y; g.mission.resolve(p); if (NE.distance(p, o) < p.r + o.r) return false;
        p.x = o.x; p.y = o.y; p.phase = 1; g.mission.resolve(p); if (p.x !== o.x) return false;
        const e = { x: o.x - o.r - 100, y: o.y, r: 20 }; const dir = g.mission.steer(e, 1000, 0); return Math.abs(dir.y) > .5;
      }), true);
    });
    await check('Shard download waits out telegraphed discharge and resumes partial progress', async () => {
      assert.equal(await page.evaluate(() => {
        fresh(); unlockAll(); const g = fixture(2); meetGoals(g); resolve(g); const o = g.mission.objects[0], z = g.mission.hazards[0], p = g.player; p.x = o.x; p.y = o.y; g.time = 1;
        g.mission.update(.2); const first = o.charge; g.time = 3; if (!g.mission.hazardWarning(z)) return false;
        g.time = 7; g.mission.update(.2); if (o.charge !== first || p.hp >= 100) return false;
        p.phase = 1; p.invulnerable = 0; const hp = p.hp; g.mission.update(.2); if (p.hp !== hp || o.charge !== first) return false;
        g.time = 12; g.mission.update(.2); return o.charge > first && !o.dead;
      }), true);
    });
    await check('Reactor has currents, conscious saboteurs, player repairs, victory and destruction paths', async () => {
      assert.equal(await page.evaluate(() => {
        fresh(); unlockAll(); const g = fixture(3); meetGoals(g); resolve(g); g.mission.objects.forEach(o => o.dead = true); g.mission.startTrial(); const d = g.mission.defense, p = g.player;
        p.x = d.x; p.y = d.y; d.hp = 200; g.mission.update(.2); if (d.hp <= 200 || d.progress <= 0 || !g.currentAt(600, 800).x) return false;
        const e = g.spawnEnemy(2, d.x, d.y, 300); e.saboteur = true; g.grid.rebuild([e]); NE.AI.think(e, g); if (e.target !== d || e.state !== 'hunt') return false;
        p.x = 400; p.y = 400; const progress = d.progress; g.mission.update(.2); if (d.progress !== progress || d.hp >= 200.32) return false;
        d.hp = .1; g.mission.update(.2); return g.state === 'result' && !g.win && g.lastHit.kind === 'reactor' && !g.settlement.samples;
      }), true);
    });
    await check('Story boss requires three phases and a physical exit; stars use evacuation health', async () => {
      assert.equal(await page.evaluate(() => {
        fresh(); unlockAll(); NE.Save.data.expedition.stars[4] = 0; const g = fixture(4); meetGoals(g); resolve(g); g.mission.objects.forEach(o => o.dead = true); g.mission.startTrial(); const b = g.boss;
        if (!b.storyBoss || b.name !== 'ИСТОЧНИК') return false;
        g.damageEnemy(b, 100000); if (b.hp < b.maxHp * .68) return false;
        const phases = new Set();
        for (let n = 0; n < 150 && !b.dead; n++) { NE.AI.boss(b, g, 1); phases.add(b.phase); g.damageEnemy(b, 100000); }
        if (!b.dead || phases.size !== 3 || g.state === 'result' || g.mission.phase !== 'exit') return false;
        g.score = 500000; g.player.hp = 20; g.player.x = g.mission.exit.x; g.player.y = g.mission.exit.y; g.mission.update(1 / 60);
        return g.win && g.settlement.stars === 2 && NE.Save.data.achievements.includes('expedition');
      }), true);
    });
    await check('Every objective and exit remains accessible at maximum campaign body radius', async () => {
      assert.equal(await page.evaluate(() => { fresh(); unlockAll(); return NE.sectors.every(s => { const g=fixture(s.id); return [...g.mission.objects,g.mission.exit].every(o=>g.mission.obstacles.every(w=>NE.distance(o,w)>w.r+NE.radius(1600)+6)); }); }),true);
    });
    await check('Predators aim once and warn before charging; story bosses warn before radial shots', async () => {
      assert.equal(await page.evaluate(() => {
        fresh(); const g=fixture(), p=g.player, e=g.spawnEnemy(3,p.x+200,p.y,300); g.grid.rebuild([p], [e]); e.think=0; NE.AI.update(e,g,1/60); if(e.attackState!=='windup')return false;
        const aim=e.aimX; p.y+=150; NE.AI.update(e,g,.6); if(e.attackState!=='windup'||e.aimX!==aim)return false; NE.AI.update(e,g,.5); if(e.attackState!=='charge')return false;
        fresh(); unlockAll(); const story=fixture(1); meetGoals(story); resolve(story); story.mission.objects.forEach(o=>o.dead=true); story.mission.startTrial(); const b=story.boss; b.state='recover'; b.timer=0; b.attackCount=1; NE.AI.boss(b,story,1/60);
        if(b.state!=='ringwarn'||story.projectiles.length)return false; NE.AI.boss(b,story,1.1); return story.projectiles.length>0 && story.announcement.title==='МАТКА САДА';
      }),true);
    });
    await check('Operator story does not pause play; found memory survives defeat and retry', async () => {
      assert.equal(await page.evaluate(() => {
        fresh(); const g = fixture(0); g.mission.update(.1); if (!g.mission.story || g.state !== 'running') return false;
        meetGoals(g); resolve(g); if (!NE.Save.data.expedition.entries.includes('cradle-awake')) return false;
        g.hurt(10000); const failed = !g.win && !NE.Save.data.expedition.stars[0] && !g.settlement.samples;
        const retry = fixture(0); return failed && NE.Save.data.expedition.entries.includes('cradle-awake') && retry.mission.phase === 'gather';
      }), true);
    });
    await check('All permanent genes buy three ranks, validate budgets, persist, and leave arena modes unaffected', async () => {
      assert.equal(await page.evaluate(() => {
        fresh(); const e = NE.Save.data.expedition; e.earned = e.samples = 64;
        for (const gene of NE.permanentGenes) { for (let rank = 0; rank < 3; rank++) if (!NE.Progress.buyPermanent(gene.id)) return false; if (NE.Progress.buyPermanent(gene.id)) return false; }
        if (e.samples !== 0 || NE.Progress.buyPermanent('forged')) return false;
        const normal = fixture(), s = normal.speed(), d = normal.damageMultiplier(), hp = normal.player.maxHp, story = fixture(0);
        return story.speed() > s && story.damageMultiplier() > d && story.player.maxHp === hp + 24 && NE.Save.validate(JSON.parse(NE.Save.exportText())).expedition.upgrades.harvest === 3;
      }), true);
    });
    await check('Campaign growth caps preserve score rewards and explain maximum level on the HUD', async () => {
      assert.equal(await page.evaluate(() => { fresh(); const g=fixture(0), p=g.player; p.level=25; p.mass=1600; const xp=p.xp, score=g.score; g.addMass(500); g.addXP(100); NE.UI.updateHUD(g); return p.mass===1600 && p.level===25 && p.xp===xp && g.score===score+300 && document.getElementById('xp-label').textContent.includes('MAX') && document.getElementById('xp-fill').style.width==='100%'; }),true);
    });
    await check('No premature Archon from rapid evolution; survival keeps four-minute arrival', async () => {
      assert.equal(await page.evaluate(() => { fresh(); const g = fixture(); g.nextBoss = 240; g.player.stage = 4; g.time = 100; g.update(1 / 60); if (g.boss) return false; g.time = 240; g.update(1 / 60); return !!g.boss; }), true);
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
      assert.deepEqual(data, { version: 4, volume: .61, form: 2, score: 9000, crystals: 60, xp: 240 }); await p.reload(); assert.equal(await p.evaluate(() => NE.Save.data.profile.crystals), 60); await legacyContext.close();
    });
    await check('Backup export downloads valid JSON; import restores and rejects corruption atomically', async () => {
      await page.evaluate(() => { fresh(); NE.Save.data.profile.crystals = 777; NE.Save.data.expedition.stars = [3, 1, 0, 0, 0]; NE.Save.data.cosmetics.owned.push('solar'); NE.Save.data.cosmetics.selected = 'solar'; NE.Save.data.settings.touch = true; NE.Save.persist(); }); await page.click('[data-action="profile"]');
      const downloadPromise = page.waitForEvent('download'); await page.click('[data-hub-action="export"]'); const download = await downloadPromise; const text = await fs.readFile(await download.path(), 'utf8'); assert.equal(JSON.parse(text).profile.crystals, 777);
      await page.evaluate(() => { NE.Save.data.profile.crystals = 1; NE.Save.data.settings.touch = false; document.body.classList.remove('touch'); NE.Save.persist(); });
      await page.locator('#save-import').setInputFiles({ name: 'profile.json', mimeType: 'application/json', buffer: Buffer.from(text) }); await page.waitForFunction(() => NE.Save.data.profile.crystals === 777);
      assert.equal(await page.evaluate(() => document.body.classList.contains('touch') && NE.Save.data.settings.touch), true);
      const before = await page.evaluate(() => NE.Save.exportText()); await page.locator('#save-import').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{broken') }); await page.waitForTimeout(100); assert.equal(await page.evaluate(() => NE.Save.exportText()), before);
      await page.reload(); await helpers(); assert.equal(await page.evaluate(() => NE.Save.data.cosmetics.selected), 'solar'); assert.deepEqual(await page.evaluate(() => NE.Save.data.expedition.stars), [3, 1, 0, 0, 0]);
    });
    await check('Malformed v3 profile, out-of-order sectors, claims and cosmetic IDs are sanitized', async () => {
      assert.equal(await page.evaluate(() => {
        const data = NE.Save.validate({ version: 3, profile: { xp: -7, crystals: Infinity, rating: '999', bestLevel: 900 }, campaign: { stars: [0, 3, 3, -5, 100, '3'], selected: 900 }, cosmetics: { owned: ['forged', 'mint', 'solar', 'solar'], selected: 'forged' }, claims: { path: [15, 99], leagues: ['gold', 'forged'] } });
        return data.profile.xp === 0 && data.profile.crystals === 0 && data.profile.bestLevel === 50 && data.campaign.stars.every(n => n === 0) && data.campaign.selected === 0 && data.cosmetics.selected === 'mint' && data.cosmetics.owned.length === 2 && !data.claims.path.length && !data.claims.leagues.length;
      }), true);
    });
    await check('Version 3 upgrade preserves legacy campaign, economy, skins, forms and names without resetting gifts', async () => {
      const c = await browser.newContext(), p = await c.newPage(); p.on('pageerror', e => errors.push(e.message));
      await p.addInitScript(() => { if (!localStorage.getItem('neon-evolution.save')) localStorage.setItem('neon-evolution.save', JSON.stringify({ version: 3, runs: 8, forms: [0, 4], selectedForm: 4, profile: { crystals: 777, xp: 1500, rating: 800 }, cosmetics: { owned: ['mint', 'prism'], selected: 'prism' }, campaign: { stars: [3, 2, 1, 0, 0, 0], selected: 3 }, records: { campaign: [{ score: 9000, time: 180, stage: 4, sector: 5, win: false }] } })); });
      await p.goto(URL); assert.deepEqual(await p.evaluate(() => ({ version:NE.Save.data.version, crystals:NE.Save.data.profile.crystals, stars:NE.Save.data.campaign.stars, story:NE.Save.data.expedition.stars, skin:NE.Save.data.cosmetics.selected, form:NE.Save.data.selectedForm })), {version:4,crystals:777,stars:[3,2,1,0,0,0],story:[0,0,0,0,0],skin:'prism',form:4});
      await p.reload(); assert.equal(await p.evaluate(() => NE.Save.data.profile.crystals),777); await p.click('[data-action="records"]'); await p.click('[data-tab="campaign"]'); assert.ok((await p.locator('#dialog-content').textContent()).includes('Сердце Архонта · архив')); await c.close();
    });
    await check('Story unlocks, notes and purchased genes restore after reload and still permit retry after death', async () => {
      await page.evaluate(() => { fresh(); const g=fixture(0); g.mission.remember('cradle-awake'); g.mission.remember('cradle-exit'); g.time=150; g.end(true); NE.Progress.buyPermanent('speed'); });
      await page.reload(); await helpers();
      assert.deepEqual(await page.evaluate(() => ({ stars:NE.Save.data.expedition.stars, notes:NE.Save.data.expedition.entries, samples:NE.Save.data.expedition.samples, rank:NE.Save.data.expedition.upgrades.speed, open:NE.Progress.isSectorUnlocked(1) })), {stars:[2,0,0,0,0],notes:['cradle-awake','cradle-exit'],samples:1,rank:1,open:true});
      await page.click('[data-action="campaign"]'); await page.click('[data-sector="1"]'); await page.click('[data-launch="1"]');
      await page.evaluate(() => { NE.game.player.invulnerable=0; NE.game.hurt(10000); }); await page.click('[data-ui="restart"]'); assert.equal(await page.evaluate(() => NE.game.sector.id),1);
      await page.evaluate(() => { NE.game.player.invulnerable=0; NE.game.hurt(10000); }); await page.reload(); await helpers();
      assert.equal(await page.evaluate(() => NE.Save.data.expedition.upgrades.speed===1 && NE.Save.data.expedition.samples===1 && NE.Progress.isSectorUnlocked(1) && NE.Save.data.expedition.entries.length===2),true);
    });
    await check('Malformed story ranks, resource budgets, memory IDs, locks and selected sector recover safely', async () => {
      assert.equal(await page.evaluate(() => { const d=NE.Save.validate({version:4,expedition:{stars:[0,3,3,3,3],selected:999,entries:['cradle-awake','forged','cradle-awake'],samples:999,earned:3,upgrades:{speed:1,attack:3,defense:-1,harvest:'3'}}}).expedition; return d.selected===0 && d.stars.every(n=>n===0) && d.samples===0 && d.upgrades.speed===1 && d.upgrades.attack===0 && d.upgrades.defense===0 && d.entries.length===1; }),true);
    });
    await check('Profile focus stays inside dialog; all new panels fit mobile portrait and landscape', async () => {
      await page.click('[data-action="profile"]'); await page.locator('[data-hub-action="import"]').focus(); await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.id), 'dialog-close'); await page.click('#dialog-close');
      for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
        const mobile = await browser.newContext({ viewport, isMobile: true, hasTouch: true }), p = await mobile.newPage(); p.on('pageerror', e => errors.push(e.message)); await p.goto(URL);
        for (const action of ['profile', 'campaign', 'laboratory', 'journal', 'skins', 'prizes', 'contracts']) { if (['laboratory', 'journal'].includes(action)) { await p.tap('[data-action="campaign"]'); await p.tap(`[data-hub="${action}"]`); } else await p.tap(`[data-action="${action}"]`); assert.equal(await p.evaluate(() => document.getElementById('dialog').scrollWidth <= document.getElementById('dialog').clientWidth + 1), true); await p.tap('#dialog-close'); }
        await p.tap('[data-action="campaign"]'); await p.tap('[data-sector="0"]'); await p.tap('[data-launch="0"]'); assert.equal(await p.evaluate(() => NE.game.mode), 'campaign'); await mobile.close();
      }
    });
    await check('No uncaught JS errors across progression, purchases, import and mobile panels', async () => assert.deepEqual(errors, []));
    console.log(`\n${count} progression checks passed.`);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
