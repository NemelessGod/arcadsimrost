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
      NE.Save.importText('{"version":4,"settings":{"sound":false}}');
      window.bot = { x: 0, y: 0, boost: false, route: [], goal: '', routeAge: -10 };
      // Coarse A* only plans movement inputs through the same solid terrain a human sees.
      window.routeTo = (g, target) => {
        const p = g.player, cell = 100, cols = 36, rows = 26, goal = `${target.id || target.kind}:${Math.floor(target.x / cell)},${Math.floor(target.y / cell)}`;
        const gx = NE.clamp(Math.floor(target.x / cell), 0, cols - 1), gy = NE.clamp(Math.floor(target.y / cell), 0, rows - 1);
        if (bot.goal !== goal || g.time - bot.routeAge > 3) {
          bot.goal = goal; bot.routeAge = g.time;
          const sx = NE.clamp(Math.floor(p.x / cell), 0, cols - 1), sy = NE.clamp(Math.floor(p.y / cell), 0, rows - 1), start = sy * cols + sx, end = gy * cols + gx;
          const open = [{ id: start, cost: 0, estimate: Math.hypot(gx-sx,gy-sy) }], seen = new Map([[start,0]]), parent = new Map(); let found = false;
          const pass = (x,y) => x>=0 && y>=0 && x<cols && y<rows && !g.mission.obstacles.some(o=>Math.hypot(o.x-(x+.5)*cell,o.y-(y+.5)*cell)<o.r+p.r+25);
          while (open.length) {
            open.sort((a,b)=>a.estimate-b.estimate); const cur = open.shift(); if (cur.cost > seen.get(cur.id)) continue;
            if (cur.id===end) { found = true; break; }
            const x=cur.id%cols,y=Math.floor(cur.id/cols);
            for(let dx=-1;dx<=1;dx++) for(let dy=-1;dy<=1;dy++) {
              if (!dx&&!dy || !pass(x+dx,y+dy) || dx&&dy&&(!pass(x+dx,y)||!pass(x,y+dy))) continue;
              const id=(y+dy)*cols+x+dx,cost=cur.cost+Math.hypot(dx,dy);
              if(cost >= (seen.get(id) ?? Infinity)) continue;
              seen.set(id,cost);parent.set(id,cur.id);open.push({id,cost,estimate:cost+Math.hypot(gx-x-dx,gy-y-dy)});
            }
          }
          bot.route = []; if (found) { let id=end; while(id!==start) { bot.route.unshift({x:(id%cols+.5)*cell,y:(Math.floor(id/cols)+.5)*cell}); id=parent.get(id); } }
        }
        while(bot.route.length && NE.distance(p,bot.route[0])<65) bot.route.shift(); return bot.route[0] || target;
      };
      NE.Input.direction = () => ({ x: bot.x, y: bot.y }); NE.Input.boosting = () => bot.boost;
      window.advanceBot = () => {
        const g = NE.game, p = g.player;
        const priorities = ['heal', 'armor', 'damage', 'speed', 'magnet', 'growth', 'xp', 'cooldown', 'pulse', 'speed', 'vortex', 'phase', 'vitality', 'regen', 'boost', 'capacity'];
        if (g.state === 'upgrade') { g.applyUpgrade([...g.offered].sort((a, b) => priorities.indexOf(a) - priorities.indexOf(b))[0]); return; }
        if (g.state !== 'running') return;
        const before = g.mission?.phase;
        const zones = [...(g.mission?.hazards.filter(z => !z.nest && (g.mission.hazardActive(z) || g.mission.hazardWarning(z))) || []), ...g.terrain, ...(g.event?.type === 'storm' ? g.event.zones : [])];
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
        const missionTarget = g.mission?.nearest();
        let approachTarget = missionTarget;
        if (missionTarget?.kind === 'target' && [2,4].includes(g.mission.id)) { const z=g.mission.hazards[missionTarget.seed], d=NE.distance(missionTarget,z)||1, radius=p.r+missionTarget.r+25; approachTarget={...missionTarget,id:missionTarget.id+'safe',x:missionTarget.x+(missionTarget.x-z.x)/d*radius,y:missionTarget.y+(missionTarget.y-z.y)/d*radius}; }
        if (missionTarget && missionTarget.kind !== 'boss') { cost = NE.distance(p, approachTarget); target = cost > 80 ? routeTo(g, approachTarget) : approachTarget; }
        let dx = target ? target.x - p.x : NE.C.width / 2 - p.x, dy = target ? target.y - p.y : NE.C.height / 2 - p.y;
        const boss = g.boss && !g.boss.dead ? g.boss : null;
        if (boss) {
          const bx = boss.x - p.x, by = boss.y - p.y, d = Math.hypot(bx, by) || 1;
          const desired = p.r + boss.r + 85, approach = NE.clamp((d - desired) * 2, -200, 200);
          dx = bx / d * approach - by / d * 95; dy = by / d * approach + bx / d * 95;
        }
        if (missionTarget && missionTarget.kind !== 'boss' && (approachTarget !== missionTarget ? NE.distance(p, approachTarget)<24 : NE.distance(p, missionTarget) < p.r + missionTarget.r + (missionTarget.hp > 0 && missionTarget.kind === 'target' ? 25 : missionTarget.kind === 'defense' ? -40 : missionTarget.kind === 'exit' ? -25 : 42))) { dx = 0; dy = 0; }
        if (g.mission && !missionTarget && Math.hypot(dx, dy) > 0) { const steered = g.mission.steer(p, dx, dy); dx = steered.x; dy = steered.y; }
        const hazardNear = zones.some(z => NE.distance(p,z)<z.r+25);
        if (hazardNear) {
          let escape=null, best=Infinity;
          for (let radius=160;radius<=800;radius+=80) for(let i=0;i<24;i++) {
            const a=i*Math.PI/12, candidate={x:NE.clamp(p.x+Math.cos(a)*radius,p.r+5,NE.C.width-p.r-5),y:NE.clamp(p.y+Math.sin(a)*radius,p.r+5,NE.C.height-p.r-5),r:p.r,id:'escape'};
            if(zones.some(z=>NE.distance(candidate,z)<z.r+55) || g.mission && !g.mission.passable(candidate)) continue;
            const cost=NE.distance(p,candidate); if(cost<best) {escape=candidate;best=cost;}
          }
          if(escape) { const next=g.mission ? routeTo(g,escape) : escape; dx=next.x-p.x;dy=next.y-p.y; }
        }
        let norm = Math.hypot(dx, dy) || 1; dx /= norm; dy /= norm;
        let danger = false;
        for (const e of g.enemies) if (!e.dead && e.mass > p.mass * 1.18) {
          const d = NE.distance(p, e), reach = p.r + e.r + 125;
          if (d < reach) { danger = true; const repel = (reach - d) / reach * 4; dx += (p.x - e.x) / (d || 1) * repel; dy += (p.y - e.y) / (d || 1) * repel; }
        }
        for (const z of zones) {
          const d = NE.distance(p, z), reach = z.r + 35;
          if (d < reach) { const repel = (reach - d) / reach * 6; dx += (p.x - z.x) / (d || 1) * repel; dy += (p.y - z.y) / (d || 1) * repel; }
        }
        norm = Math.hypot(dx, dy) || 1; bot.x = dx / norm; bot.y = dy / norm;
        bot.boost = hazardNear && p.energy > 35 || p.energy > 65 && (danger || !boss && cost > 170);
        const nearObjective = g.mission?.objects.some(o => !o.dead && !o.disabled && NE.distance(p, o) < (140 + p.r) * (1 + p.upgrades.pulse * .22) + o.r);
        const nearEnemy = g.enemies.some(e => !e.dead && NE.distance(p, e) < (140 + p.r) * (1 + p.upgrades.pulse * .22) + e.r);
        const bossDist = boss ? NE.distance(p, boss) : Infinity;
        if (p.energy > 35 && !p.cooldowns.pulse && (nearEnemy || nearObjective || bossDist < (140 + p.r) * (1 + p.upgrades.pulse * .22) + (boss?.r || 0))) g.useAbility('pulse');
        if (p.level >= 4 && p.energy > 55 && !p.cooldowns.phase && (danger || hazardNear || boss?.state === 'telegraph' || boss?.state === 'charge')) g.useAbility('phase');
        if (p.level >= 7 && p.energy > 60 && !p.cooldowns.vortex && (nearObjective || bossDist < 210 * (1 + p.upgrades.vortex * .22) + (boss?.r || 0) || g.food.filter(f => !f.dead && NE.distance(p, f) < 210).length > 9)) g.useAbility('vortex');
        g.update(1 / 60); if (g.mission?.phase !== before) g.phaseTimes.push({phase:g.mission.phase,time:Math.round(g.time)});
      };
    });
    for (let id = 0; id < (process.env.NE_FIRST_ONLY ? 1 : 5); id++) {
      if (process.env.NE_TEST_START && id < Number(process.env.NE_TEST_START)) { await page.evaluate(id => NE.Save.data.expedition.stars[id] = 1, id); continue; }
      assert.equal(await page.evaluate(id => NE.UI.start(false, { mode: 'campaign', sectorId: id }), id), true);
      await page.evaluate(() => { bot.goal = ''; bot.route = []; NE.game.phaseTimes = []; });
      let status, captured = false;
      for (let chunk = 0; chunk < 40; chunk++) {
        status = await page.evaluate(() => {
          for (let i = 0; i < 1500 && NE.game.state !== 'result'; i++) advanceBot();
          const g = NE.game; return { phases: g.phaseTimes, sector: g.sector.name, state: g.state, win: !!g.win, seconds: Math.round(g.time), level: g.player.level, mass: Math.round(g.player.mass), hp: Math.round(g.player.hp), score: Math.floor(g.score), ...g.stats, stars: g.settlement?.stars || 0, phase: g.mission?.phase, objectives: g.mission?.objects.map(o=>({done:o.dead,hp:Math.ceil(o.hp),charge:Math.round(o.charge)})), x:Math.round(g.player.x), y:Math.round(g.player.y), bossHp:Math.round(g.boss?.hp || 0), lastHit:g.lastHit, genes:g.player.upgrades, bossPhase: g.boss?.phase || 0 };
        });
        if (process.env.NE_TEST_CAPTURE && ((id === 1 && chunk === 0) || (id === 4 && status.bossHp > 0 && !captured))) {
          captured = true;
          await page.setViewportSize({ width: 1440, height: 960 });
          await page.waitForTimeout(150);
          await page.evaluate(() => { while (NE.game.state === 'upgrade') advanceBot(); NE.renderer.resize(); NE.UI.updateHUD(NE.game); for (let i = 0; i < 18; i++) NE.renderer.world(NE.game, .1); });
          await page.waitForTimeout(4000);
          await page.screenshot({ path: path.join(process.env.NE_TEST_CAPTURE, id === 1 ? 'garden.png' : 'source.png') });
        }
        if (chunk % 5 === 0) console.log('PROGRESS', JSON.stringify({id,seconds:status.seconds,phase:status.phase,hp:status.hp,x:status.x,y:status.y}));
        if (status.state === 'result') break;
      }
      console.log(JSON.stringify(status)); report.push(status);
      assert.equal(status.win, true, `Campaign sector ${id} must be beatable by normal gameplay`);
    }
    const saved = await page.evaluate(() => ({ stars: NE.Save.data.expedition.stars, profile: NE.Progress.profile().level, league: NE.Progress.league().name, samples: NE.Save.data.expedition.samples, notes: NE.Save.data.expedition.entries.length, crystals: NE.Save.data.profile.crystals, achievements: NE.Save.data.achievements }));
    assert.equal(saved.stars.filter(Boolean).length, process.env.NE_FIRST_ONLY ? 1 : 5); if (!process.env.NE_FIRST_ONLY) assert.ok(saved.achievements.includes('expedition')); assert.deepEqual(errors, []);
    console.log(`PASS · ${process.env.NE_TEST_START || process.env.NE_FIRST_ONLY ? 'Mission slice' : 'Complete campaign'} through ordinary gameplay: ${JSON.stringify(saved)}`);
    if (process.env.NE_TEST_REPORT) await fs.writeFile(process.env.NE_TEST_REPORT, JSON.stringify(report, null, 2));
    await page.reload(); assert.equal(await page.evaluate(() => NE.Save.data.expedition.stars.filter(Boolean).length), process.env.NE_FIRST_ONLY ? 1 : 5);
    console.log('PASS · Campaign progress survives reload.');
    if (!process.env.NE_FIRST_ONLY && !process.env.NE_TEST_START) {
      assert.equal(saved.notes,10); assert.equal(saved.samples,31);
      await page.click('[data-action="campaign"]'); await page.click('[data-hub="laboratory"]'); await page.click('[data-permanent="speed"]');
      assert.equal(await page.evaluate(()=>NE.Save.data.expedition.upgrades.speed),1);
      await page.reload(); assert.equal(await page.evaluate(()=>NE.Save.data.expedition.upgrades.speed===1 && NE.Save.data.expedition.samples===28 && NE.Save.data.expedition.entries.length===10),true);
      console.log('PASS · Ten notes, 31 earned samples, laboratory purchase and permanent rank survive reload.');
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
