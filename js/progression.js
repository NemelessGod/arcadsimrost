'use strict';
NE.Progress = (() => {
  function dayKey(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  function ensureDaily(day = dayKey(), save = true) {
    const data = NE.Save.data;
    if (data.contracts.day !== day) {
      data.contracts = { day, food: 0, kills: 0, abilities: 0, events: 0, bosses: 0, time: 0, claimed: [] };
      if (save) NE.Save.persist();
    }
    return data.contracts;
  }
  function dailyList(day = dayKey()) {
    const hash = [...day].reduce((value, ch) => (value * 31 + ch.charCodeAt(0)) >>> 0, 7);
    const pool = [...NE.contractPool]; let seed = hash;
    for (let i = pool.length - 1; i > 0; i--) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const j = seed % (i + 1); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    return pool.slice(0, 3);
  }
  function profile(xp = NE.Save.data.profile.xp) {
    let level = 1, remaining = xp;
    while (level < 50 && remaining >= 150 + (level - 1) * 60) { remaining -= 150 + (level - 1) * 60; level++; }
    return { level, xp: remaining, next: 150 + (level - 1) * 60, progress: level === 50 ? 1 : remaining / (150 + (level - 1) * 60) };
  }
  function league(rating = NE.Save.data.profile.rating) {
    const index = NE.leagues.reduce((current, l, i) => rating >= l.points ? i : current, 0);
    const current = NE.leagues[index], next = NE.leagues[index + 1];
    return { ...current, index, next, progress: next ? NE.clamp((rating - current.points) / (next.points - current.points), 0, 1) : 1 };
  }
  function isSectorUnlocked(id) {
    if (!Number.isInteger(id) || id < 0 || id >= NE.sectors.length) return false;
    return id === 0 || NE.Save.data.campaign.stars.slice(0, id).every(n => n > 0);
  }
  function paint(id = NE.Save.data.cosmetics.selected) { return NE.paints.find(p => p.id === id) || NE.paints[0]; }
  function color(player) { return paint(player.paint).color || NE.forms[player.stage].color; }
  function equip(id) {
    if (!NE.Save.data.cosmetics.owned.includes(id)) return false;
    NE.Save.data.cosmetics.selected = id; NE.Save.persist(); return true;
  }
  function buy(id) {
    const item = NE.paints.find(p => p.id === id), data = NE.Save.data;
    if (!item || item.price <= 0 || data.cosmetics.owned.includes(id) || data.profile.crystals < item.price) return false;
    data.profile.crystals -= item.price; data.cosmetics.owned.push(id); data.cosmetics.selected = id;
    milestones(); NE.Save.persist(); NE.Audio?.play('achievement'); return true;
  }
  function unlockPaint(id) { if (id && !NE.Save.data.cosmetics.owned.includes(id)) NE.Save.data.cosmetics.owned.push(id); }
  function milestones() {
    const data = NE.Save.data;
    const rules = [['expedition', data.campaign.stars.every(n => n > 0)], ['collector', data.cosmetics.owned.length >= 6], ['goldLeague', data.profile.rating >= 1400]];
    for (const [id, earned] of rules) if (earned && !data.achievements.includes(id)) { data.achievements.push(id); NE.UI?.toast(`Достижение · ${NE.achievements.find(a => a.id === id).name}`); }
  }
  function claimPath(step) {
    const reward = NE.pathRewards.find(r => r.step === step), data = NE.Save.data;
    if (!reward || data.profile.xp < reward.xp || data.claims.path.includes(step)) return false;
    data.claims.path.push(step); data.profile.crystals = Math.min(1e8, data.profile.crystals + reward.crystals); unlockPaint(reward.skin);
    milestones(); NE.Save.persist(); NE.Audio?.play('achievement'); return true;
  }
  function claimLeague(id) {
    const reward = NE.leagues.find(l => l.id === id), data = NE.Save.data;
    if (!reward || data.profile.rating < reward.points || data.claims.leagues.includes(id)) return false;
    data.claims.leagues.push(id); data.profile.crystals = Math.min(1e8, data.profile.crystals + reward.prize); unlockPaint(reward.skin);
    milestones(); NE.Save.persist(); NE.Audio?.play('achievement'); return true;
  }
  function claimContract(id) {
    const today = ensureDaily(), reward = dailyList().find(c => c.id === id);
    if (!reward || today[reward.key] < reward.target || today.claimed.includes(id)) return false;
    today.claimed.push(id); NE.Save.data.profile.crystals = Math.min(1e8, NE.Save.data.profile.crystals + reward.prize);
    NE.Save.persist(); NE.Audio?.play('achievement'); return true;
  }
  function campaignProgress(game) {
    if (!game.sector) return { complete: false, fraction: 0, label: '' };
    const goals = game.sector.goals.map(goal => {
      const value = ['level', 'mass'].includes(goal.key) ? game.player[goal.key] : goal.key === 'time' ? game.time : game.stats[goal.key];
      return { ...goal, value: Math.min(goal.target, value) };
    });
    return {
      complete: goals.every(g => g.value >= g.target),
      fraction: goals.reduce((sum, g) => sum + g.value / g.target, 0) / goals.length,
      label: goals.map(g => `${g.label} ${g.key === 'time' ? NE.time(g.value) + '/' + NE.time(g.target) : Math.floor(g.value) + '/' + g.target}`).join(' · ')
    };
  }
  function settle(game, win) {
    if (game.settlement) return game.settlement;
    const data = NE.Save.data, stats = game.stats, p = game.player;
    const before = league(), eligible = game.time >= 20 || stats.food >= 12 || stats.kills >= 2 || stats.bosses > 0;
    let xp = eligible ? Math.round(Math.min(650, game.time * .5 + stats.food * .7 + stats.kills * 4 + stats.events * 30 + stats.bosses * 100 + (win ? 70 : 0))) : 0;
    let crystals = Math.floor(xp * .32), rating = eligible ? Math.min(180, Math.floor(game.time / 20) + p.level * 2 + stats.kills * 2 + stats.events * 10 + stats.bosses * 40 + (win ? 20 : 0)) : 0;
    let stars = 0, firstClear = false;
    if (game.sector && win) {
      const sector = game.sector, previous = data.campaign.stars[sector.id];
      stars = 1 + ((game.finishHealthRatio ?? p.hp / p.maxHp) >= .5 ? 1 : 0) + (game.score >= sector.starScore ? 1 : 0);
      firstClear = previous === 0;
      crystals += (firstClear ? sector.prize : 0) + Math.max(0, stars - previous) * 25;
      xp += firstClear ? 100 + sector.id * 25 : 0;
      data.campaign.stars[sector.id] = Math.max(previous, stars);
      data.campaign.bestScores[sector.id] = Math.max(data.campaign.bestScores[sector.id], Math.floor(game.score));
      data.campaign.selected = Math.min(5, sector.id + 1);
    }
    const today = ensureDaily(dayKey(), false);
    for (const key of ['food', 'kills', 'abilities', 'events', 'bosses']) today[key] = Math.min(1e8, today[key] + stats[key]);
    today.time = Math.min(1e8, today.time + Math.floor(game.time));
    data.profile.xp = Math.min(1e8, data.profile.xp + xp); data.profile.crystals = Math.min(1e8, data.profile.crystals + crystals); data.profile.rating = Math.min(1e8, data.profile.rating + rating);
    for (const key of ['food', 'kills', 'events', 'bosses']) data.profile[key] = Math.min(1e8, data.profile[key] + stats[key]);
    data.profile.wins = Math.min(1e8, data.profile.wins + (win ? 1 : 0)); data.profile.bestMass = Math.max(data.profile.bestMass, Math.floor(p.mass)); data.profile.bestLevel = Math.max(data.profile.bestLevel, p.level);
    game.settlement = { xp, crystals, rating, stars, firstClear, eligible, previousLeague: before.name, league: league().name, promoted: before.index < league().index };
    milestones();
    return game.settlement;
  }
  return { dayKey, ensureDaily, dailyList, profile, league, isSectorUnlocked, paint, color, equip, buy, claimPath, claimLeague, claimContract, campaignProgress, settle };
})();
