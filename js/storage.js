'use strict';
NE.Save = (() => {
  const KEY = 'neon-evolution.save', VERSION = 3;
  const defaults = () => ({
    version: VERSION,
    settings: { volume: .45, sound: true, quality: 'high', shake: true, touch: false, theme: 'lagoon', glow: .7, contrast: false, motion: !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) },
    forms: [0], selectedForm: 0, achievements: [], records: { survival: [], endless: [], campaign: [] }, runs: 0,
    profile: { xp: 0, crystals: 0, rating: 0, wins: 0, food: 0, kills: 0, bosses: 0, events: 0, bestMass: 18, bestLevel: 1 },
    cosmetics: { owned: ['mint'], selected: 'mint' },
    campaign: { stars: [0, 0, 0, 0, 0, 0], bestScores: [0, 0, 0, 0, 0, 0], selected: 0 },
    claims: { path: [], leagues: [] },
    contracts: { day: '', food: 0, kills: 0, abilities: 0, events: 0, bosses: 0, time: 0, claimed: [] }
  });
  let warning = '';
  const integer = (value, fallback = 0, max = 1e8) => Number.isFinite(value) && value >= 0 ? Math.floor(NE.clamp(value, 0, max)) : fallback;
  const unique = (array, allowed) => Array.isArray(array) ? [...new Set(array.filter(value => allowed.includes(value)))] : [];

  function validate(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || ![1, 2, VERSION].includes(raw.version)) throw new Error('Неподдерживаемая версия сохранения');
    const result = defaults(), s = raw.settings;
    if (s && typeof s === 'object') {
      if (Number.isFinite(s.volume)) result.settings.volume = NE.clamp(s.volume, 0, 1);
      for (const name of ['sound', 'shake', 'touch', 'contrast', 'motion']) if (typeof s[name] === 'boolean') result.settings[name] = s[name];
      if (['lagoon', 'ultraviolet', 'solar'].includes(s.theme)) result.settings.theme = s.theme;
      if (Number.isFinite(s.glow)) result.settings.glow = NE.clamp(s.glow, 0, 1);
      if (['low', 'medium', 'high'].includes(s.quality)) result.settings.quality = s.quality;
    }
    result.forms = [...new Set([0, ...unique(raw.forms, [0, 1, 2, 3, 4])])];
    if (result.forms.includes(raw.selectedForm)) result.selectedForm = raw.selectedForm;
    result.achievements = unique(raw.achievements, NE.achievements.map(a => a.id));
    for (const mode of ['survival', 'endless', 'campaign']) {
      if (Array.isArray(raw.records?.[mode])) result.records[mode] = raw.records[mode].filter(r => r && Number.isFinite(r.score) && r.score >= 0 && Number.isFinite(r.time) && r.time >= 0 && Number.isInteger(r.stage) && r.stage >= 0 && r.stage < 5).map(r => ({
        score: integer(r.score, 0, 1e9), time: NE.clamp(r.time, 0, 1e7), stage: r.stage, win: r.win === true,
        date: typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : '',
        sector: mode === 'campaign' ? integer(r.sector, 0, 5) : null
      })).sort((a, b) => b.score - a.score).slice(0, 10);
    }
    result.runs = integer(raw.runs, 0, 1e9);
    if (raw.version < VERSION) {
      // A one-time legacy gift; saved version 3 prevents repeated migration rewards.
      result.profile.crystals = Math.min(800, result.runs * 20);
      result.profile.xp = Math.min(2400, [...result.records.survival, ...result.records.endless].reduce((sum, r) => sum + Math.min(240, Math.floor(r.score / 30)), 0));
      return result;
    }
    for (const key of Object.keys(result.profile)) result.profile[key] = integer(raw.profile?.[key], result.profile[key]);
    result.profile.bestLevel = NE.clamp(result.profile.bestLevel, 1, 50);
    result.profile.bestMass = NE.clamp(result.profile.bestMass, 18, 5000);
    result.cosmetics.owned = [...new Set(['mint', ...unique(raw.cosmetics?.owned, NE.paints.map(p => p.id))])];
    if (result.cosmetics.owned.includes(raw.cosmetics?.selected)) result.cosmetics.selected = raw.cosmetics.selected;
    for (let i = 0; i < NE.sectors.length; i++) {
      result.campaign.stars[i] = integer(raw.campaign?.stars?.[i], 0, 3);
      result.campaign.bestScores[i] = integer(raw.campaign?.bestScores?.[i], 0, 1e9);
    }
    let contiguous = true;
    for (let i = 0; i < result.campaign.stars.length; i++) { if (!contiguous) result.campaign.stars[i] = 0; if (!result.campaign.stars[i]) contiguous = false; }
    const firstLocked = result.campaign.stars.findIndex(n => n === 0);
    result.campaign.selected = integer(raw.campaign?.selected, 0, firstLocked === -1 ? 5 : firstLocked);
    result.claims.path = unique(raw.claims?.path, NE.pathRewards.filter(r => r.xp <= result.profile.xp).map(r => r.step));
    result.claims.leagues = unique(raw.claims?.leagues, NE.leagues.filter(l => l.points <= result.profile.rating).map(l => l.id));
    if (typeof raw.contracts?.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.contracts.day)) result.contracts.day = raw.contracts.day;
    for (const key of ['food', 'kills', 'abilities', 'events', 'bosses', 'time']) result.contracts[key] = integer(raw.contracts?.[key]);
    result.contracts.claimed = unique(raw.contracts?.claimed, NE.contractPool.map(c => c.id));
    return result;
  }

  let data, migrated = false;
  try {
    const saved = localStorage.getItem(KEY), raw = saved ? JSON.parse(saved) : null;
    data = raw ? validate(raw) : defaults(); migrated = !!raw && raw.version !== VERSION;
  } catch { data = defaults(); warning = 'Сохранение недоступно или повреждено. Восстановлены безопасные настройки.'; }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); return true; }
    catch { warning = 'Браузер запретил сохранение. Прогресс доступен до закрытия страницы.'; NE.UI?.toast(warning, true); return false; }
  }
  if (migrated) persist();

  return {
    get data() { return data; }, get warning() { return warning; }, validate, persist,
    exportText() { return JSON.stringify(data, null, 2); },
    importText(text) {
      if (typeof text !== 'string' || text.length > 200000) throw new Error('Слишком большой файл сохранения');
      const next = validate(JSON.parse(text));
      data = next; const saved = persist(); return { saved };
    },
    setting(name, value) { if (Object.hasOwn(data.settings, name)) { data.settings[name] = value; persist(); } },
    unlockForm(stage) { if (!data.forms.includes(stage)) { data.forms.push(stage); persist(); NE.UI?.toast(`Открыта стартовая форма: ${NE.forms[stage].name}`); } },
    achievement(id) { if (!data.achievements.includes(id) && NE.achievements.some(a => a.id === id)) { data.achievements.push(id); persist(); NE.UI?.toast(`Достижение · ${NE.achievements.find(a => a.id === id).name}`); } },
    record(game, win) {
      if (game.recorded) return game.saved !== false;
      game.recorded = true; data.runs = Math.min(1e9, data.runs + 1);
      const mode = Object.hasOwn(data.records, game.mode) ? game.mode : 'survival';
      data.records[mode].push({ score: Math.floor(game.score), time: game.time, stage: game.player.stage, win, date: new Date().toISOString().slice(0, 10), sector: game.sector?.id ?? null });
      data.records[mode].sort((a, b) => b.score - a.score); data.records[mode] = data.records[mode].slice(0, 10);
      NE.Progress.settle(game, win);
      return persist();
    },
    best() { return Math.max(0, ...Object.values(data.records).flat().map(r => r.score)); }
  };
})();
