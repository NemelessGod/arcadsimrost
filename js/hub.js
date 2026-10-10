'use strict';
NE.Hub = (() => {
  const $ = id => document.getElementById(id);
  let prizeTab = 'leagues';
  const number = n => Math.floor(n).toLocaleString('ru-RU');
  const stars = n => `<span class="sector-stars" aria-label="${n} из 3 звёзд">${[1, 2, 3].map(i => `<i class="${i <= n ? 'earned' : ''}">★</i>`).join('')}</span>`;
  function updateMenu() {
    const data = NE.Save.data, level = NE.Progress.profile(), league = NE.Progress.league();
    $('menu-profile-level').textContent = 'LV ' + level.level;
    $('menu-league').textContent = league.name; $('menu-league').style.color = league.color;
    $('menu-crystals').textContent = number(data.profile.crystals) + ' ◇';
    $('menu-campaign').textContent = `${data.campaign.stars.filter(n => n > 0).length} / 6 секторов`;
    const prizes = NE.leagues.filter(l => l.points <= data.profile.rating && !data.claims.leagues.includes(l.id)).length + NE.pathRewards.filter(r => r.xp <= data.profile.xp && !data.claims.path.includes(r.step)).length;
    $('menu-prizes').textContent = prizes ? `${prizes} наград ждут` : league.name;
    const daily = NE.Progress.ensureDaily();
    const done = NE.Progress.dailyList().filter(c => daily.claimed.includes(c.id)).length;
    $('menu-contracts').textContent = `${done} / 3 получено`;
  }
  function profile() {
    const data = NE.Save.data, p = data.profile, level = NE.Progress.profile(), league = NE.Progress.league();
    NE.UI.open('profile', `<span class="eyebrow">ТВОЙ СЛЕД В НЕОНЕ</span><h2 id="dialog-title">Жизнь между забегами.</h2><div class="profile-hero"><span class="profile-emblem" style="color:${league.color}">${league.icon}</span><div><span class="eyebrow">УРОВЕНЬ ПРОФИЛЯ</span><strong>${level.level}</strong><div class="bar"><i style="width:${level.progress * 100}%"></i></div><small>${level.level === 50 ? 'Высший уровень' : `${number(level.xp)} / ${number(level.next)} XP`}</small></div><div class="profile-wallet"><b>${number(p.crystals)} ◇</b><small>КРИСТАЛЛЫ</small></div></div><div class="profile-stat-grid"><div><small>ЛОКАЛЬНАЯ ЛИГА</small><b style="color:${league.color}">${league.name}</b><span>${number(p.rating)} очков мастерства</span></div><div><small>ЭКСПЕДИЦИЯ</small><b>${data.campaign.stars.filter(n => n > 0).length} / 6</b><span>${data.campaign.stars.reduce((a, b) => a + b, 0)} / 18 звёзд</span></div><div><small>КОЛЛЕКЦИЯ</small><b>${data.cosmetics.owned.length} / ${NE.paints.length}</b><span>Процедурных скинов</span></div><div><small>ЗАБЕГИ / ПОБЕДЫ</small><b>${number(data.runs)} / ${number(p.wins)}</b><span>${number(p.kills)} поглощений</span></div></div><p class="hub-note">Опыт профиля, кристаллы и мастерство начисляются после смерти или победы. Мгновенный перезапуск и выход в меню не дают наград. Все скины косметические; гены формы выбираются отдельно.</p><div class="hub-links"><button class="secondary-button" data-hub="campaign">Карта экспедиции</button><button class="secondary-button" data-hub="skins">Коллекция скинов</button><button class="secondary-button" data-hub="prizes">Лиги и призы</button></div><div class="backup-box"><b>Сохранение можно взять с собой.</b><p>Экспортируйте профиль перед переносом или импортом. Импорт заменяет текущее сохранение. При игре с другого адреса или устройства загрузите этот файл.</p><div class="hub-links"><button class="secondary-button" data-hub-action="export">Скачать сохранение</button><button class="secondary-button" data-hub-action="import">Загрузить сохранение</button></div><input id="save-import" type="file" accept="application/json,.json" hidden></div>`, true);
    $('save-import').addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return;
      try {
        if (file.size > 200000) throw new Error('Файл слишком большой');
        const result = NE.Save.importText(await file.text());
        document.body.classList.toggle('touch', NE.Save.data.settings.touch);
        NE.Input.reset(); NE.Audio.volume(); NE.Visuals.apply(); NE.renderer.resize();
        updateMenu(); NE.UI.menuStats(); profile();
        NE.UI.toast(result.saved ? 'Профиль восстановлен из файла.' : 'Профиль загружен в память. Запись браузером запрещена.', !result.saved);
      } catch { NE.UI.toast('Не удалось прочитать сохранение. Текущий профиль сохранён.', true); }
    });
  }
  function campaign() {
    const data = NE.Save.data;
    NE.UI.open('campaign', `<span class="eyebrow">АТЛАС / ЭКСПЕДИЦИЯ 01</span><h2 id="dialog-title">Шесть миров. Одна эволюция.</h2><p>Проходите сектора по порядку. Каждая победа открывает следующий мир. Первая звезда — за победу, вторая — за минимум 50% жизни в момент победы, третья — за указанный порог очков.</p><div class="campaign-summary"><span>${data.campaign.stars.reduce((a, b) => a + b, 0)} / 18 звёзд</span><span>${number(data.profile.crystals)} ◇</span></div><div class="sector-grid">${NE.sectors.map(s => {
      const unlocked = NE.Progress.isSectorUnlocked(s.id), completed = data.campaign.stars[s.id] > 0;
      return `<article class="sector-card ${unlocked ? '' : 'sector-locked'} ${completed ? 'sector-completed' : ''}" style="--sector-color:${s.color}"><div class="sector-card-top"><span>0${s.id + 1}</span>${stars(data.campaign.stars[s.id])}</div><div class="sector-planet planet-${s.biome}" aria-hidden="true"></div><h3>${s.name}</h3><p>${s.description}</p><small>${s.rule}</small><div class="sector-prize">${completed ? 'ЛУЧШИЙ СЧЁТ · ' + number(data.campaign.bestScores[s.id]) : 'ПЕРВАЯ ПОБЕДА · ' + s.prize + ' ◇'}<span>3-я звезда: ${number(s.starScore)} очков</span></div><button class="secondary-button" data-sector="${s.id}" ${unlocked ? '' : 'disabled'}>${unlocked ? completed ? 'Повторить сектор ↗' : 'Войти в сектор ↗' : 'Завершите сектор ' + s.id}</button></article>`;
    }).join('')}</div><p class="hub-note">Награда первого прохождения выдаётся один раз. За новые звёзды — по 25 кристаллов; повторные забеги продолжают приносить обычные награды профиля.</p>`, true);
  }
  function skins() {
    const data = NE.Save.data;
    NE.UI.open('skins', `<span class="eyebrow">ЛАБОРАТОРИЯ ОБЛИКОВ</span><div class="hub-title-row"><h2 id="dialog-title">Твой собственный свет.</h2><span class="wallet-badge">${number(data.profile.crystals)} ◇</span></div><p>12 процедурных скинов с уникальными узорами. Покупайте за заработанные кристаллы или получайте за прогресс. Облик меняется, боевые характеристики сохраняются.</p><div class="skin-grid">${NE.paints.map(s => {
      const owned = data.cosmetics.owned.includes(s.id), selected = data.cosmetics.selected === s.id, afford = data.profile.crystals >= s.price;
      const action = owned ? `<button class="secondary-button" data-equip="${s.id}" ${selected ? 'disabled' : ''}>${selected ? 'Выбран ✓' : 'Надеть'}</button>` : s.price ? `<button class="secondary-button" data-buy="${s.id}" ${afford ? '' : 'disabled'}>${number(s.price)} ◇ · Купить</button>` : `<button class="secondary-button" data-prize-tab="${s.path ? 'path' : 'leagues'}">${s.path ? 'Путь · этап ' + s.path : 'Лига · Золото'} ↗</button>`;
      return `<article class="skin-card ${selected ? 'skin-selected' : ''}" style="--skin-color:${s.color || '#a6ffce'}"><span class="skin-rarity">${s.rarity}</span><canvas data-skin-preview="${s.id}" width="130" height="105" aria-label="${s.name}"></canvas><h3>${s.name}</h3><small>${owned ? 'В коллекции' : s.price ? 'За кристаллы' : 'Приз за мастерство'}</small>${action}</article>`;
    }).join('')}</div>`, true);
    requestAnimationFrame(() => document.querySelectorAll('[data-skin-preview]').forEach(canvas => NE.renderer.skinPreview(canvas, NE.Progress.paint(canvas.dataset.skinPreview))));
  }
  function prizes(tab = prizeTab) {
    prizeTab = tab; const data = NE.Save.data, league = NE.Progress.league();
    const tabs = `<div class="record-tabs"><button data-prize-tab="leagues" class="${tab === 'leagues' ? 'active' : ''}">Лиги мастерства</button><button data-prize-tab="path" class="${tab === 'path' ? 'active' : ''}">Путь экспедиции</button></div>`;
    let body;
    if (tab === 'leagues') {
      body = `<div class="league-status"><span class="league-symbol" style="color:${league.color}">${league.icon}</span><div><b>${league.name}</b><span>${number(data.profile.rating)} ${league.next ? '/ ' + number(league.next.points) : ''} очков мастерства</span><div class="bar"><i style="width:${league.progress * 100}%"></i></div></div></div><p class="hub-note">Лиги отражают ваше личное мастерство в этом браузере. Очки дают за длительность, рост, охоту, события и победы. Поражения сохраняют заработанные очки. Призы каждой лиги можно получить один раз.</p><div class="league-grid">${NE.leagues.map(l => {
        const claimed = data.claims.leagues.includes(l.id), ready = data.profile.rating >= l.points;
        return `<article class="league-card ${ready ? 'league-open' : ''}"><span style="color:${l.color}">${l.icon}</span><h3>${l.name}</h3><small>${number(l.points)} очков</small><b>${l.prize} ◇</b><p>${l.skin ? 'Скин «' + NE.Progress.paint(l.skin).name + '»' : 'Кристаллы для коллекции'}</p><button class="secondary-button" data-claim-league="${l.id}" ${!ready || claimed ? 'disabled' : ''}>${claimed ? 'Получено ✓' : ready ? 'Забрать приз' : 'Лига закрыта'}</button></article>`;
      }).join('')}</div>`;
    } else {
      body = `<p>15 этапов открываются за суммарный опыт профиля. Получайте кристаллы и три эксклюзивных скина. Прогресс не сбрасывается.</p><div class="path-summary"><span>${number(data.profile.xp)} XP профиля</span><span>${data.claims.path.length} / 15 наград</span></div><div class="path-grid">${NE.pathRewards.map(r => {
        const claimed = data.claims.path.includes(r.step), ready = data.profile.xp >= r.xp;
        return `<article class="path-card ${ready ? 'path-open' : ''}"><span class="path-number">${String(r.step).padStart(2, '0')}</span><small>${r.xp} XP</small><b>${r.crystals} ◇</b><p>${r.skin ? 'Скин «' + NE.Progress.paint(r.skin).name + '»' : 'Кристаллы'}</p><button class="secondary-button" data-claim-path="${r.step}" ${!ready || claimed ? 'disabled' : ''}>${claimed ? 'Получено ✓' : ready ? 'Получить' : 'Наберите XP'}</button></article>`;
      }).join('')}</div>`;
    }
    NE.UI.open('prizes', `<span class="eyebrow">КАЖДЫЙ ЗАБЕГ ИМЕЕТ ЗНАЧЕНИЕ</span><h2 id="dialog-title">Рост за пределами арены.</h2>${tabs}${body}`, true);
  }
  function contracts() {
    const day = NE.Progress.ensureDaily();
    NE.UI.open('contracts', `<span class="eyebrow">ЕЖЕДНЕВНЫЕ КОНТРАКТЫ</span><h2 id="dialog-title">Три причины вернуться.</h2><p>Задачи дня: ${day.day}. Прогресс суммируется в завершённых забегах любого режима. Обновление — в полночь по времени вашего браузера.</p><div class="contract-grid">${NE.Progress.dailyList().map(c => {
      const progress = Math.min(c.target, day[c.key]), claimed = day.claimed.includes(c.id), ready = progress >= c.target;
      return `<article class="contract-card"><span class="eyebrow">КОНТРАКТ / ${c.prize} ◇</span><h3>${c.name}</h3><p>${c.description}</p><div class="bar"><i style="width:${progress / c.target * 100}%"></i></div><small>${c.key === 'time' ? NE.time(progress) + ' / ' + NE.time(c.target) : number(progress) + ' / ' + c.target}</small><button class="secondary-button" data-claim-contract="${c.id}" ${!ready || claimed ? 'disabled' : ''}>${claimed ? 'Награда получена ✓' : ready ? 'Забрать ' + c.prize + ' ◇' : 'В процессе'}</button></article>`;
    }).join('')}</div><button class="primary-button" data-ui="close">ВЕРНУТЬСЯ К ЭВОЛЮЦИИ <span>↗</span></button>`, true);
  }
  function resultPanel(game) {
    const r = game.settlement, p = NE.Progress.profile();
    if (!r) return '';
    return `<div class="run-rewards"><span class="eyebrow">ПРОГРЕСС ПРОФИЛЯ · LV ${p.level}</span><div><b>+${r.xp}<small>ОПЫТ</small></b><b>+${r.crystals} ◇<small>КРИСТАЛЛЫ</small></b><b>+${r.rating}<small>МАСТЕРСТВО</small></b></div>${game.sector && game.win ? stars(r.stars) + `<p>${r.firstClear ? game.sector.id < 5 ? 'Первое прохождение! Открыт следующий сектор.' : 'Экспедиция завершена. Все шесть миров покорены!' : 'Звёзды и лучший счёт обновлены.'}</p>` : ''}${r.promoted ? `<p class="promotion">Новая лига: ${r.league}!</p>` : ''}${!r.eligible ? '<p>Награды начнут начисляться после 20 секунд, 12 частиц, 2 поглощений или победы над боссом.</p>' : ''}</div>`;
  }
  function exportSave() {
    const blob = new Blob([NE.Save.exportText()], { type: 'application/json' }), url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `neon-evolution-save-${NE.Progress.dayKey()}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  $('dialog-content').addEventListener('click', e => {
    const button = e.target.closest('button'); if (!button || button.disabled) return;
    if (button.dataset.hub) { ({ profile, campaign, skins, prizes, contracts }[button.dataset.hub])(); return; }
    if (button.dataset.sector !== undefined) { const id = Number(button.dataset.sector); if (NE.Progress.isSectorUnlocked(id)) { NE.Save.data.campaign.selected = id; NE.Save.persist(); NE.UI.start(false, { mode: 'campaign', sectorId: id }); } return; }
    if (button.dataset.equip) { if (NE.Progress.equip(button.dataset.equip)) { skins(); NE.UI.menuStats(); } return; }
    if (button.dataset.buy) { if (NE.Progress.buy(button.dataset.buy)) { skins(); NE.UI.menuStats(); NE.UI.toast('Новый скин в коллекции!'); } return; }
    if (button.dataset.prizeTab) { prizes(button.dataset.prizeTab); return; }
    if (button.dataset.claimLeague) { if (NE.Progress.claimLeague(button.dataset.claimLeague)) { prizes('leagues'); updateMenu(); NE.UI.toast('Приз лиги получен.'); } return; }
    if (button.dataset.claimPath) { if (NE.Progress.claimPath(Number(button.dataset.claimPath))) { prizes('path'); updateMenu(); NE.UI.toast('Награда экспедиции получена.'); } return; }
    if (button.dataset.claimContract) { if (NE.Progress.claimContract(button.dataset.claimContract)) { contracts(); updateMenu(); NE.UI.toast('Контракт выполнен. Кристаллы получены!'); } return; }
    if (button.dataset.hubAction === 'export') exportSave();
    if (button.dataset.hubAction === 'import') $('save-import').click();
  });
  updateMenu();
  return { updateMenu, profile, campaign, skins, prizes, contracts, resultPanel };
})();
