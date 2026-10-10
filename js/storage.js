'use strict';
NE.Save = (() => {
  const KEY = 'neon-evolution.save', VERSION = 2;
  const defaults = () => ({ version: VERSION, settings: { volume: .45, sound: true, quality: 'high', shake: true, touch: false }, forms: [0], selectedForm: 0, achievements: [], records: { survival: [], endless: [] }, runs: 0 });
  let warning = '';
  function validate(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || ![1, VERSION].includes(raw.version)) throw new Error('Unknown save');
    const result = defaults(), s = raw.settings;
    if (s && typeof s === 'object') {
      if (Number.isFinite(s.volume)) result.settings.volume = NE.clamp(s.volume, 0, 1);
      for (const name of ['sound', 'shake', 'touch']) if (typeof s[name] === 'boolean') result.settings[name] = s[name];
      if (['low', 'medium', 'high'].includes(s.quality)) result.settings.quality = s.quality;
    }
    if (Array.isArray(raw.forms)) result.forms = [...new Set([0, ...raw.forms.filter(n => Number.isInteger(n) && n >= 0 && n < 5)])];
    if (result.forms.includes(raw.selectedForm)) result.selectedForm = raw.selectedForm;
    if (Array.isArray(raw.achievements)) result.achievements = [...new Set(raw.achievements.filter(id => NE.achievements.some(a => a.id === id)))];
    for (const mode of ['survival', 'endless']) {
      if (Array.isArray(raw.records?.[mode])) result.records[mode] = raw.records[mode].filter(r => r && Number.isFinite(r.score) && r.score >= 0 && Number.isFinite(r.time) && r.time >= 0 && Number.isInteger(r.stage) && r.stage >= 0 && r.stage < 5).map(r => ({ score: Math.floor(NE.clamp(r.score, 0, 1e9)), time: NE.clamp(r.time, 0, 1e7), stage: r.stage, win: r.win === true, date: typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : '' })).sort((a, b) => b.score - a.score).slice(0, 10);
    }
    if (Number.isInteger(raw.runs)) result.runs = NE.clamp(raw.runs, 0, 1e9);
    return result;
  }
  let data;
  try { const saved = localStorage.getItem(KEY); data = saved ? validate(JSON.parse(saved)) : defaults(); }
  catch { data = defaults(); warning = 'Сохранение недоступно или повреждено. Восстановлены безопасные настройки.'; }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); return true; }
    catch { warning = 'Браузер запретил сохранение. Прогресс доступен до закрытия страницы.'; if (NE.UI) NE.UI.toast(warning, true); return false; }
  }
  return {
    get data() { return data; }, get warning() { return warning; }, validate, persist,
    setting(name, value) { if (name in data.settings) { data.settings[name] = value; persist(); } },
    unlockForm(stage) { if (!data.forms.includes(stage)) { data.forms.push(stage); persist(); NE.UI?.toast(`Открыта стартовая форма: ${NE.forms[stage].name}`); } },
    achievement(id) { if (!data.achievements.includes(id) && NE.achievements.some(a => a.id === id)) { data.achievements.push(id); persist(); NE.UI?.toast(`Достижение · ${NE.achievements.find(a => a.id === id).name}`); } },
    record(game, win) { data.runs++; data.records[game.mode].push({ score: Math.floor(game.score), time: game.time, stage: game.player.stage, win, date: new Date().toISOString().slice(0, 10) }); data.records[game.mode].sort((a, b) => b.score - a.score); data.records[game.mode] = data.records[game.mode].slice(0, 10); return persist(); },
    best() { return Math.max(0, ...data.records.survival.map(r => r.score), ...data.records.endless.map(r => r.score)); }
  };
})();
