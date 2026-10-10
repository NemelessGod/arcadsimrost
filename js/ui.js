'use strict';
NE.UI = (() => {
  const $ = id => document.getElementById(id), menu = $('menu'), hud = $('hud'), overlay = $('overlay'), dialog = $('dialog'), content = $('dialog-content');
  let mode = 'survival', dialogKind = '', returnToPause = false, toastTimer = 0, recordTab = 'survival';
  function toast(message, warning = false) {
    const box = $('toasts'); if (box.childElementCount >= (innerHeight < 500 ? 2 : 3)) box.firstElementChild.remove();
    const node = document.createElement('div'); node.className = 'toast' + (warning ? ' warn' : ''); node.textContent = message; box.append(node); setTimeout(() => node.remove(), 3800);
  }
  function closeOverlay() { overlay.hidden = true; dialogKind = ''; }
  function open(kind, html, wide = false, closable = true) {
    document.querySelectorAll('#toasts .toast:not(.warn)').forEach(node => node.remove());
    dialogKind = kind; overlay.hidden = false; dialog.classList.toggle('wide', wide); $('dialog-close').hidden = !closable; content.innerHTML = html;
    dialog.scrollTop = 0;
    requestAnimationFrame(() => { if (overlay.hidden) return; const button = content.querySelector('[data-theme-choice][aria-pressed=true]') || content.querySelector('button:not(:disabled), input, select'); (button || $('dialog-close')).focus({ preventScroll: true }); });
  }
  function menuStats() {
    const s = NE.Save.data.selectedForm, form = NE.forms[s]; $('best-score').textContent = String(NE.Save.best()).padStart(6, '0'); $('specimen-name').textContent = form.name; $('specimen-trait').textContent = `${NE.Progress.paint().name} · ${form.trait}`; $('specimen-id').textContent = 'NE–002';
    document.querySelectorAll('.stage-dots i').forEach((n, i) => n.classList.toggle('on', i <= s)); document.querySelector('.stage-dots span').textContent = '0' + (s + 1) + ' / 05';
    NE.Hub?.updateMenu();
  }
  function mainMenu() { NE.Input.reset(); NE.game = null; closeOverlay(); menu.hidden = false; hud.hidden = true; $('game-tip').hidden = true; $('story-feed').hidden = true; returnToPause = false; menuStats(); $('play').focus({ preventScroll: true }); }
  function start(tutorial = false, options = {}) {
    if (options.mode === 'campaign' && !NE.Progress.isSectorUnlocked(options.sectorId)) { toast('Сначала завершите предыдущий сектор.'); return false; }
    NE.Audio.unlock(); NE.Audio.play('click'); NE.Input.reset(); closeOverlay(); menu.hidden = true; hud.hidden = false; NE.game = new NE.Game(options.mode || mode, tutorial, options); NE.renderer.camera = { x: NE.game.player.x, y: NE.game.player.y, zoom: innerWidth < 600 ? .85 : 1.05 }; returnToPause = false;
    $('game-tip').hidden = !tutorial; updateHUD(NE.game); if (tutorial) updateTutorial(NE.game); else toast(NE.game.sector ? `${NE.game.sector.name} · ${NE.game.sector.description}` : 'Кольца: бирюзовые — добыча · жёлтые — равные · розовые — опасность');
    document.activeElement?.blur();
    return true;
  }
  function restart() { const g = NE.game; start(false, g?.sector ? { mode: 'campaign', sectorId: g.sector.id } : { mode: g?.mode || mode }); }
  function resume() { const g = NE.game; if (!g || g.state !== 'paused') return; g.state = 'running'; closeOverlay(); NE.Input.reset(); document.activeElement?.blur(); }
  function pause(reason = '') {
    const g = NE.game; if (!g || !['running', 'paused'].includes(g.state)) return; g.state = 'paused'; NE.Input.reset(); returnToPause = true;
    open('pause', `<span class="eyebrow">ЭКОСИСТЕМА ЖДЁТ</span><h2 id="dialog-title">Небольшая пауза.</h2><p>${reason || 'Сделайте вдох. Ваша эволюция продолжится с того же места.'}</p><div class="result-grid"><div><small>ВРЕМЯ</small><strong>${NE.time(g.time)}</strong></div><div><small>УРОВЕНЬ</small><strong>${g.player.level}</strong></div><div><small>ОЧКИ</small><strong>${Math.floor(g.score)}</strong></div></div><p class="pause-note">Перезапуск и выход в меню завершают текущую попытку без наград профиля.</p><button class="primary-button" data-ui="resume">ПРОДОЛЖИТЬ <span>↗</span></button><div class="dialog-actions"><button class="secondary-button" data-ui="settings">Настройки</button><button class="secondary-button" data-ui="codex">Справочник</button><button class="secondary-button" data-ui="restart">Начать заново</button><button class="secondary-button" data-ui="menu">В меню</button></div>`);
  }
  function tutorial() {
    open('tutorial', `<span class="eyebrow">ОТ ИСКРЫ ДО ХИЩНИКА</span><h2 id="dialog-title">Расти. Охоться. Эволюционируй.</h2><p>Ты — маленький организм в большой живой экосистеме. Здесь у каждого есть свой аппетит.</p><div class="tutorial-steps"><div class="tutorial-step"><b>01 · Собирай энергию</b><p>Светящиеся частицы дают массу, опыт, жизнь и энергию. Они притягиваются к тебе. Рост плавный, но делает тебя медленнее.</p></div><div class="tutorial-step"><b>02 · Выбирай добычу</b><p><span style="color:var(--cyan)">Бирюзовое кольцо</span> — добыча: будь на 18% массивнее, чтобы поглотить. <span style="color:var(--yellow)">Жёлтое кольцо</span> — равный: используй способности. <span style="color:var(--pink)">Розовое кольцо</span> — опасность: избегай.</p></div><div class="tutorial-step"><b>03 · Меняй себя</b><p>Каждый уровень — выбор из трёх улучшений. На уровнях 4, 7, 10 и 13 открываются новые стадии. Достигнутые формы можно выбрать в меню для следующего забега.</p></div><div class="tutorial-step"><b>04 · Победи Архонта</b><p>Босс приходит через 4 минуты и даёт время освоиться. Розовый коридор предупреждает о рывке. В выживании победа завершает забег; в бесконечности начинается новая охота.</p></div></div><div class="tutorial-controls"><kbd>WASD</kbd> / стрелки — движение · <kbd>SPACE</kbd> — ускорение<br><kbd>Q</kbd> — импульс · <kbd>E</kbd> — неуязвимый сдвиг (ур. 4) · <kbd>R</kbd> — вихрь (ур. 7)<br><kbd>ESC</kbd> — пауза · На телефоне — джойстик и отдельные кнопки.<br>Завершай задания и события: они дают опыт, массу и лечение.</div><button class="primary-button" data-ui="train">ПРОЙТИ ОБУЧЕНИЕ <span>↗</span></button>`);
  }
  function forms() {
    const save = NE.Save.data;
    open('forms', `<span class="eyebrow">КОЛЛЕКЦИЯ ОРГАНИЗМОВ</span><h2 id="dialog-title">Выбери свой ген.</h2><p>Достигай стадий во время игры, чтобы открывать новые стартовые облики. Каждый забег начинается с первой стадии и 18 массы; выбранный облик даёт свой небольшой бонус.</p><div class="form-grid">${NE.forms.map((f, i) => `<button class="form-card ${save.selectedForm === i ? 'selected' : ''}" data-form="${i}" ${!save.forms.includes(i) ? 'disabled' : ''}><span class="form-icon" style="color:${f.color}">${f.icon}</span><b>${f.name}</b><small>${save.forms.includes(i) ? f.trait : 'Открой на ур. ' + f.level}</small></button>`).join('')}</div><button class="primary-button" data-ui="close">ГОТОВО <span>↗</span></button>`, true);
  }
  function codex() {
    if (NE.game?.state === 'running') { NE.game.state = 'paused'; NE.Input.reset(); }
    returnToPause = NE.game?.state === 'paused';
    open('codex', `<span class="eyebrow">ПОЛЕВОЙ АТЛАС / 06 ВИДОВ</span><h2 id="dialog-title">Знай свою экосистему.</h2><p>Цвет тела показывает вид, кольцо и значок — вашу разницу в силе. Рост может превратить хищника в добычу. В экспедиции сплошные обломки блокируют путь; фазовый сдвиг проходит сквозь них. Опасные поля всегда помечены.</p><div class="relation-guide">${Object.values(NE.Visuals.relations).map(r => `<div style="--relation-color:${r.color}"><b>${r.symbol} ${r.label}</b><small>${r.label === 'ДОБЫЧА' ? 'Вы массивнее на 18% — поглощайте' : r.label === 'РАВНЫЙ' ? 'Ослабляйте способностями' : 'Тяжелее на 18% — избегайте'}</small></div>`).join('')}</div><div class="codex-grid">${NE.species.map((species, i) => `<article class="codex-card" style="--species-color:${species.color}"><span class="eyebrow">ВИД / 0${i + 1}</span><canvas data-creature-preview="${i}" width="160" height="110" aria-label="${species.name}"></canvas><h3>${species.name}</h3><small>Стартовая масса ${species.mass[0]}–${species.mass[1]} μ</small><p>${NE.Visuals.habitats[i]}</p></article>`).join('')}</div><div class="codex-abilities">${Object.entries(NE.abilities).map(([id, a], i) => `<div><kbd>${['Q', 'E', 'R'][i]}</kbd><b>${a.name}</b><span>Ур. ${a.level} · ${a.cost} энергии · ${a.cooldown} с</span><p>${a.description}</p></div>`).join('')}</div><button class="primary-button" data-ui="close">ВЕРНУТЬСЯ <span>↗</span></button>`, true);
    requestAnimationFrame(() => document.querySelectorAll('[data-creature-preview]').forEach(canvas => NE.renderer.creaturePreview(canvas, Number(canvas.dataset.creaturePreview))));
  }
  function defeatPanel(game) {
    if (game.win) return '';
    const hit = game.lastHit || { kind: 'unknown' };
    const advice = {
      boss: ['Столкновение с Архонтом', 'Уходите в сторону из коридора рывка. Фазовый сдвиг позволяет пройти сквозь босса.'],
      shot: ['Снаряд Архонта', 'Следите за светящимся ядром и следом снаряда. Двигайтесь между лучами кольца.'],
      wave: ['Ударная волна Архонта', 'Пройдите через волну в фазовом сдвиге или отойдите за её радиус.'],
      field: ['Разряд ионного поля', 'Пунктир и кольцо заряда предупреждают о разряде. Выходите за границу или используйте E.'],
      storm: ['Ионная буря', 'До разряда есть две секунды. Держитесь за пределами розовых кругов.'],
      reactor: ['Защищаемая система разрушена', 'Вернитесь в кольцо системы: близость ремонтирует её. Импульс отбрасывает диверсантов, броня и регенерация усиливают ремонт.'],
      unknown: ['Последний удар', 'Начните с еды и маленькой добычи. Сохраняйте энергию, чтобы ускориться при появлении угрозы.']
    };
    const [name, tip] = hit.kind === 'enemy' && NE.species[hit.type] ? [NE.species[hit.type].name, NE.Visuals.habitats[hit.type]] : advice[hit.kind] || advice.unknown;
    return `<div class="defeat-recap"><span class="eyebrow">ПОСЛЕДНИЙ УДАР</span><b>${name}${hit.damage ? ' · ' + hit.damage + ' урона' : ''}</b><p>${tip}</p></div>`;
  }
  function settings() {
    if (NE.game?.state === 'running') { NE.game.state = 'paused'; NE.Input.reset(); }
    returnToPause = NE.game?.state === 'paused'; const s = NE.Save.data.settings;
    open('settings', `<span class="eyebrow">НАСТРОЙ СВОЮ ЭКОСИСТЕМУ</span><h2 id="dialog-title">Свет, который нравится тебе.</h2>
      <div class="theme-setting"><label>Цветовая атмосфера<small>Своя палитра для каждого мира</small></label><div class="theme-picker">${Object.entries(NE.Visuals.themes).map(([id, t]) => `<button data-theme-choice="${id}" aria-pressed="${s.theme === id}" style="--theme-color:${t.primary};--theme-secondary:${t.secondary}"><span class="theme-swatch"></span><b>${t.name}</b></button>`).join('')}</div></div>
      <div class="setting-row"><label for="glow-setting">Интенсивность свечения <span id="glow-number">${Math.round(s.glow * 100)}%</span><small>Мягкие ореолы вокруг света и существ</small></label><input id="glow-setting" type="range" min="0" max="100" value="${Math.round(s.glow * 100)}"></div>
      <div class="setting-row"><label for="contrast-setting">Чёткие индикаторы угроз<small>Более яркие и толстые кольца</small></label><input id="contrast-setting" type="checkbox" ${s.contrast ? 'checked' : ''}></div>
      <div class="setting-row"><label for="motion-setting">Фоновая анимация<small>Отключите для спокойного света и камеры без встряски</small></label><input id="motion-setting" type="checkbox" ${s.motion ? 'checked' : ''}></div>
      <div class="setting-row"><label for="sound-setting">Звуковые эффекты<small>Процедурный звук, без внешних файлов</small></label><input id="sound-setting" type="checkbox" ${s.sound ? 'checked' : ''}></div>
      <div class="setting-row"><label for="volume-setting">Громкость <span id="volume-number">${Math.round(s.volume * 100)}%</span></label><input id="volume-setting" type="range" min="0" max="100" value="${Math.round(s.volume * 100)}"></div>
      <div class="setting-row"><label for="quality-setting">Качество графики<small>Свечение, рельеф, разрешение и число частиц</small></label><select id="quality-setting">${[['high', 'Высокое'], ['medium', 'Среднее'], ['low', 'Низкое']].map(([id, name]) => `<option value="${id}" ${s.quality === id ? 'selected' : ''}>${name}</option>`).join('')}</select></div>
      <div class="setting-row"><label for="shake-setting">Встряска камеры</label><input id="shake-setting" type="checkbox" ${s.shake ? 'checked' : ''}></div>
      <div class="setting-row"><label for="touch-setting">Показывать сенсорное управление<small>На телефонах включается автоматически</small></label><input id="touch-setting" type="checkbox" ${s.touch ? 'checked' : ''}></div>
      <button class="primary-button" data-ui="close">СОХРАНИТЬ И ВЕРНУТЬСЯ <span>↗</span></button>`);
    document.querySelectorAll('[data-theme-choice]').forEach(button => button.addEventListener('click', () => {
      NE.Save.setting('theme', button.dataset.themeChoice); NE.Visuals.apply();
      document.querySelectorAll('[data-theme-choice]').forEach(b => b.setAttribute('aria-pressed', b === button));
    }));
    $('glow-setting').addEventListener('input', e => { NE.Save.setting('glow', Number(e.target.value) / 100); $('glow-number').textContent = e.target.value + '%'; });
    for (const id of ['motion', 'contrast']) $(id + '-setting').addEventListener('change', e => { NE.Save.setting(id, e.target.checked); NE.Visuals.apply(); });
    $('sound-setting').addEventListener('change', e => { NE.Save.setting('sound', e.target.checked); NE.Audio.volume(); NE.Audio.play('click'); });
    $('volume-setting').addEventListener('input', e => { const value = Number(e.target.value) / 100; NE.Save.setting('volume', value); $('volume-number').textContent = Math.round(value * 100) + '%'; NE.Audio.volume(); });
    $('quality-setting').addEventListener('change', e => { NE.Save.setting('quality', e.target.value); NE.renderer.resize(); });
    $('shake-setting').addEventListener('change', e => NE.Save.setting('shake', e.target.checked));
    $('touch-setting').addEventListener('change', e => { NE.Save.setting('touch', e.target.checked); document.body.classList.toggle('touch', e.target.checked); NE.Input.reset(); });
  }
  function records(tab = recordTab) {
    recordTab = tab; const save = NE.Save.data;
    const body = tab === 'achievements' ? `<div class="achievement-grid">${NE.achievements.map(a => `<div class="achievement ${save.achievements.includes(a.id) ? 'earned' : ''}"><b>${save.achievements.includes(a.id) ? '✦' : '◇'} ${a.name}</b><small>${a.desc}</small></div>`).join('')}</div>` : save.records[tab].length ? `<table class="records-table"><thead><tr><th>#</th><th>ОЧКИ</th><th>ВРЕМЯ</th><th>${tab === 'campaign' ? 'СЕКТОР' : 'ФОРМА'}</th><th>ИСХОД</th></tr></thead><tbody>${save.records[tab].map((r, i) => `<tr><td>${String(i + 1).padStart(2, '0')}</td><td>${r.score.toLocaleString('ru-RU')}</td><td>${NE.time(r.time)}</td><td>${tab === 'campaign' ? (r.story ? NE.sectors[r.sector ?? 0].name : NE.legacySectorNames[r.sector ?? 0] + ' · архив') : NE.forms[r.stage].name}</td><td>${r.win ? '✦ Победа' : 'Конец забега'}</td></tr>`).join('')}</tbody></table>` : '<div class="empty-message">Твоя история ещё впереди. Заверши первый забег!</div>';
    open('records', `<span class="eyebrow">ТВОЯ ИСТОРИЯ ЭВОЛЮЦИИ</span><h2 id="dialog-title">След в экосистеме.</h2><p>Лучшие 10 завершённых забегов в каждом режиме. Достижения: ${save.achievements.length} / ${NE.achievements.length}.</p><div class="record-tabs"><button data-tab="survival" class="${tab === 'survival' ? 'active' : ''}">Выживание</button><button data-tab="endless" class="${tab === 'endless' ? 'active' : ''}">Бесконечность</button><button data-tab="campaign" class="${tab === 'campaign' ? 'active' : ''}">Экспедиция</button><button data-tab="achievements" class="${tab === 'achievements' ? 'active' : ''}">Достижения</button></div>${body}`, true);
  }
  function showUpgrade(game) {
    game.state = 'upgrade'; NE.Input.reset();
    const pool = NE.upgrades.filter(u => game.player.upgrades[u.id] < u.max);
    // Fisher–Yates avoids a biased sort comparator and duplicate offers.
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    let offered = pool.slice(0, 3);
    if (game.mission) {
      const roles = [['speed', 'boost', 'phase'], ['damage', 'pulse', 'vortex', 'cooldown'], ['armor', 'heal', 'vitality'], ['magnet', 'growth', 'xp', 'regen', 'capacity']];
      const buckets = roles.map(ids => pool.find(u => ids.includes(u.id))).filter(Boolean);
      for (let i = buckets.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [buckets[i], buckets[j]] = [buckets[j], buckets[i]]; }
      offered = [...buckets, ...pool.filter(u => !buckets.includes(u))].slice(0, 3);
    } game.offered = offered.map(u => u.id);
    open('upgrade', `<span class="eyebrow">УРОВЕНЬ ${game.player.level} · ГЕНЕТИЧЕСКИЙ ВЫБОР</span><h2 id="dialog-title">Следующий шаг — твой.</h2><p>Выбери улучшение кнопкой или клавишей 1 / 2 / 3. Арена приостановлена.${game.sector ? ' ' + game.sector.advice : ''}${game.pendingUpgrades > 1 ? ' Осталось выборов: ' + game.pendingUpgrades + '.' : ''}</p><div class="upgrade-grid">${offered.map((u, i) => `<button class="upgrade-card" data-upgrade="${u.id}" aria-keyshortcuts="${i + 1}"><span class="upgrade-key">${i + 1}</span><span class="upgrade-icon">${u.icon}</span><b>${u.name}</b><p>${u.desc}</p><small>ГЕН ${game.player.upgrades[u.id] + 1} / ${u.max} &nbsp; ↗</small></button>`).join('')}</div>`, true, false);
  }
  function result(game, win) {
    $('game-tip').hidden = true;
    const choices = NE.upgrades.filter(u => game.player.upgrades[u.id]).map(u => `${u.name} ×${game.player.upgrades[u.id]}`).join(' · ');
    open('result', `<span class="eyebrow">${win ? game.sector ? `ЭКСПЕДИЦИЯ · СЕКТОР ${game.sector.id + 1} ЗАВЕРШЁН` : 'АРХОНТ ПОВЕРЖЕН · ЭКОСИСТЕМА ТВОЯ' : 'КАЖДЫЙ КОНЕЦ — НОВОЕ НАЧАЛО'}</span><h2 id="dialog-title">${win ? game.sector ? 'Сектор «' + game.sector.name + '» восстановлен.' : 'Вершина пищевой цепи.' : 'Твоя искра оставила след.'}</h2><div class="result-score">${Math.floor(game.score).toLocaleString('ru-RU')} <span style="font-size:12px;letter-spacing:1px">ОЧКОВ</span></div><div class="result-grid"><div><small>ВРЕМЯ</small><strong>${NE.time(game.time)}</strong></div><div><small>ПОГЛОЩЕНИЯ</small><strong>${game.stats.kills}</strong></div><div><small>УРОВЕНЬ</small><strong>${game.player.level}</strong></div></div>${NE.Hub.resultPanel(game)}${defeatPanel(game)}<p>Финальная форма: <span style="color:${NE.forms[game.player.stage].color}">${NE.forms[game.player.stage].name}</span> · Масса: ${Math.floor(game.player.mass)} μ · События: ${game.stats.events}<br>${game.saved ? 'Рекорд, награды и прогресс сохранены в этом браузере.' : 'Хранилище браузера недоступно: прогресс останется только в этой сессии.'}</p>${choices ? `<div class="result-upgrades">${choices}</div>` : ''}${game.sector && win && game.sector.id < 4 ? `<button class="primary-button" data-sector="${game.sector.id + 1}">СЛЕДУЮЩИЙ СЕКТОР <span>↗</span></button>` : ''}<button class="primary-button" data-ui="restart">${game.sector ? 'ПОВТОРИТЬ СЕКТОР' : 'ЕЩЁ ОДНА ЭВОЛЮЦИЯ'} <span>↗</span></button><div class="dialog-actions"><button class="secondary-button" data-ui="menu">В главное меню</button><button class="secondary-button" data-ui="result-records">Рекорды</button><button class="secondary-button" data-hub="prizes">Лиги и призы</button>${game.mission ? '<button class="secondary-button" data-hub="campaign">Карта и постоянные гены</button>' : ''}</div>`, false, false);
  }
  function updateHUD(g) {
    const p = g.player, stage = NE.forms[p.stage]; $('stage-label').textContent = `0${p.stage + 1} / 05 · ${stage.name.toUpperCase()}`; $('form-symbol').textContent = stage.icon; $('form-symbol').style.color = stage.color;
    const maxed = p.level >= (g.mission ? 25 : 50); $('level').textContent = p.level; $('mass').textContent = Math.floor(p.mass) + ' μ'; $('xp-fill').style.width = (maxed ? 100 : Math.min(100, p.xp / p.xpNext * 100)) + '%'; $('xp-label').textContent = maxed ? 'MAX · опыт → очки' : `${Math.floor(p.xp)} / ${p.xpNext} XP`;
    $('hp-fill').style.width = p.hp / p.maxHp * 100 + '%'; $('hp-label').textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`; $('energy-fill').style.width = p.energy / p.maxEnergy * 100 + '%'; $('energy-label').textContent = `${Math.floor(p.energy)} / ${p.maxEnergy}`;
    $('mode-label').textContent = g.sector ? g.sector.name.toUpperCase() : g.mode === 'survival' ? 'ВЫЖИВАНИЕ' : 'БЕСКОНЕЧНОСТЬ'; $('run-clock').textContent = NE.time(g.time); $('score').textContent = String(Math.floor(g.score)).padStart(6, '0'); $('enemy-count').textContent = g.enemies.length + ' ОСОБЕЙ';
    const q = g.quests[g.questIndex];
    if (q) { const progress = Math.min(q.goal, q.key === 'stage' ? p.stage : g.stats[q.key]); $('quest-title').textContent = q.text; $('quest-fill').style.width = progress / q.goal * 100 + '%'; $('quest-progress').textContent = `${progress} / ${q.goal} · +${q.xp} XP`; }
    else { $('quest-title').textContent = 'Все задачи выполнены'; $('quest-fill').style.width = '100%'; $('quest-progress').textContent = 'Продолжайте эволюцию!'; }
    $('quest-type').textContent = g.sector ? `ЭКСПЕДИЦИЯ ${g.sector.id + 1} / 5` : 'ТЕКУЩАЯ ЗАДАЧА';
    if (g.sector) { const mission = NE.Progress.campaignProgress(g); $('quest-title').textContent = mission.title; $('quest-fill').style.width = mission.fraction * 100 + '%'; $('quest-progress').textContent = mission.label; }
    $('next-evolution').textContent = p.stage === 4 ? 'Высшая форма достигнута' : `${NE.forms[p.stage + 1].name} · уровень ${NE.forms[p.stage + 1].level}`;
    document.querySelectorAll('[data-ability]').forEach(button => { const id = button.dataset.ability, ability = NE.abilities[id], cd = p.cooldowns[id], locked = p.level < ability.level; button.classList.toggle('locked', locked); button.classList.toggle('cooling', cd > 0); button.classList.toggle('ready', !locked && cd <= 0 && p.energy >= ability.cost); button.setAttribute('aria-label', `${ability.name}, ${locked ? 'открывается на уровне ' + ability.level : cd > 0 ? 'перезарядка ' + Math.ceil(cd) + ' секунд' : 'стоимость ' + ability.cost + ' энергии'}`); button.querySelector('small').textContent = locked ? 'Уровень ' + ability.level : cd > 0 ? Math.ceil(cd) + ' сек' : ability.cost + ' энергии'; button.querySelector('.cooldown').style.width = cd > 0 ? cd / (ability.cooldown * Math.max(.5, 1 - p.upgrades.cooldown * .1)) * 100 + '%' : '0%'; });
    const story = g.mission?.story; $('story-feed').hidden = !story || g.state !== 'running'; if (story) { $('story-speaker').textContent = story.speaker; $('story-text').textContent = story.text; }
    $('boost-button').style.opacity = p.boostExhausted ? '.4' : '1';
    const threats = g.grid.query(p.x, p.y, 410, 'enemy').filter(e => g.relation(e) === 'danger'); $('danger-label').textContent = threats.length ? `▲ ХИЩНИК РЯДОМ · ${threats.length}` : '';
    $('boss-hud').hidden = !g.boss || g.boss.dead; if (g.boss && !g.boss.dead) { $('boss-name').textContent = g.boss.name || (g.boss.empowered ? 'ВЕРХОВНЫЙ АРХОНТ' : 'АРХОНТ'); $('boss-fill').style.width = Math.max(0, g.boss.hp / g.boss.maxHp * 100) + '%'; $('boss-phase').textContent = 'ФАЗА ' + ['I', 'II', 'III'][g.boss.phase - 1] + (g.boss.shielded ? ' · ЩИТ ' + Math.ceil(10 - g.boss.phaseAge) + ' с' : ''); }
    $('event-card').hidden = !g.event;
    if (g.event) { const e = g.event; $('event-title').textContent = { bloom: 'Энергетический расцвет', migration: 'Великая миграция', storm: 'Ионная буря' }[e.type]; $('event-description').textContent = e.completed ? 'Награда получена. Продолжайте охоту.' : { bloom: 'Соберите 12 золотых частиц в отмеченной области.', migration: 'Поглотите 3 быстрых странников.', storm: 'Избегайте розовых полей до конца события.' }[e.type]; $('event-time').textContent = `${Math.ceil(Math.max(0, e.duration - e.age))} сек${e.type !== 'storm' ? ` · ${e.progress} / ${e.type === 'bloom' ? 12 : 3}` : ''}${e.completed ? ' · ✓' : ''}`; }
  }
  function updateTutorial(g) {
    const tips = ['Двигайтесь с WASD / стрелками или джойстиком. Исследуйте арену.', 'Соберите 5 светящихся частиц. Они дают массу и опыт.', 'Удерживайте SPACE или BOOST в движении. Ускорение расходует энергию.', 'Используйте Q / кнопку «Импульс». Подойдите к противнику для урона.', 'Найдите бирюзовое существо и коснитесь его: это ваша добыча.', 'Отлично! Выберите улучшения, развивайтесь и найдите Архонта.'];
    $('game-tip').textContent = tips[g.tutorialStep]; $('game-tip').hidden = false;
    if (g.tutorialStep >= 5) { g.tutorial = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('game-tip').hidden = true, 6000); }
  }
  function closeDialog() {
    if (dialogKind === 'upgrade' || dialogKind === 'result') return;
    if (dialogKind === 'pause') { resume(); return; }
    if (returnToPause && NE.game?.state === 'paused') pause();
    else if (NE.game?.state === 'result') result(NE.game, NE.game.win);
    else { closeOverlay(); menuStats(); }
  }
  function escape() { if (!overlay.hidden) closeDialog(); else if (NE.game?.state === 'running') pause(); }
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => { mode = button.dataset.mode; document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b === button)); NE.Audio.play('click'); }));
  document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => ({ settings, tutorial, forms, records, codex, profile: () => NE.Hub.profile(), campaign: () => NE.Hub.campaign(), prizes: () => NE.Hub.prizes(), skins: () => NE.Hub.skins(), contracts: () => NE.Hub.contracts() }[button.dataset.action])()));
  $('play').addEventListener('click', () => start()); $('pause-button').addEventListener('click', () => pause()); $('dialog-close').addEventListener('click', closeDialog);
  document.querySelector('.brand').addEventListener('click', e => { e.preventDefault(); mainMenu(); });
  document.querySelectorAll('[data-ability]').forEach(button => {
    let lastTouch = -Infinity;
    // A third simultaneous touch need not produce a synthesized click.
    button.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' || e.pointerType === 'pen') { e.preventDefault(); lastTouch = performance.now(); NE.game?.useAbility(button.dataset.ability); } });
    button.addEventListener('click', e => { if (e.pointerType === 'touch' || e.pointerType === 'pen' || (e.detail > 0 && performance.now() - lastTouch < 600)) return; NE.game?.useAbility(button.dataset.ability); });
  });
  content.addEventListener('click', e => {
    const target = e.target.closest('button'); if (!target) return;
    if (target.dataset.upgrade) { NE.game?.applyUpgrade(target.dataset.upgrade); return; }
    if (target.dataset.form !== undefined) { const form = Number(target.dataset.form); if (NE.Save.data.forms.includes(form)) { NE.Save.data.selectedForm = form; NE.Save.persist(); forms(); menuStats(); } return; }
    if (target.dataset.tab) { records(target.dataset.tab); return; }
    switch (target.dataset.ui) { case 'resume': resume(); break; case 'close': closeDialog(); break; case 'settings': settings(); break; case 'codex': codex(); break; case 'restart': restart(); break; case 'menu': mainMenu(); break; case 'train': start(true); break; case 'result-records': records(); break; }
  });
  overlay.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return; const focusable = [...dialog.querySelectorAll('button:not([hidden]):not(:disabled), input:not([hidden]), select')].filter(node => node.getClientRects().length); const first = focusable[0], last = focusable.at(-1);
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
  });
  NE.Visuals.apply(); document.body.classList.toggle('touch', NE.Save.data.settings.touch); menuStats();
  return { toast, start, mainMenu, pause, resume, settings, showUpgrade, result, updateHUD, updateTutorial, closeOverlay, escape, open, menuStats };
})();
