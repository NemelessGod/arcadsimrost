'use strict';
window.NE = {};
NE.C = { width: 3600, height: 2600, foodCap: 420, enemyCap: 84, particleCap: 360, projectileCap: 72, step: 1 / 60, bossTime: 240, preyXpCap: 100, preyMassCap: 70 };
NE.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
NE.rand = (a, b) => a + Math.random() * (b - a);
NE.distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
NE.time = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
NE.radius = mass => 7 + Math.sqrt(mass) * 2.4;
NE.forms = [
  { name: 'Искра', title: 'SPARK', level: 1, color: '#a6ffce', icon: '✳', trait: 'Притяжение энергии +10%', bonus: 'magnet' },
  { name: 'Луч', title: 'RAY', level: 4, color: '#4ce6e0', icon: '❖', trait: 'Скорость движения +8%', bonus: 'speed' },
  { name: 'Спираль', title: 'HELIX', level: 7, color: '#b4a1ff', icon: '◎', trait: 'Сила способностей +8%', bonus: 'damage' },
  { name: 'Клык', title: 'FANG', level: 10, color: '#ffc57c', icon: '✧', trait: 'Получаемый урон −8%', bonus: 'armor' },
  { name: 'Суверен', title: 'SOVEREIGN', level: 13, color: '#ff84ba', icon: '♛', trait: 'Прирост массы +10%', bonus: 'growth' }
];
NE.species = [
  { id: 'forager', name: 'Искатель', mass: [7, 30], speed: 99, sense: 230, shape: 0, behavior: 'graze', color: '#62c9b5' },
  { id: 'grazer', name: 'Пастух', mass: [22, 90], speed: 65, sense: 280, shape: 1, behavior: 'graze', color: '#8fbca7' },
  { id: 'swarm', name: 'Роевик', mass: [12, 55], speed: 116, sense: 330, shape: 2, behavior: 'pack', color: '#aa9de1' },
  { id: 'hunter', name: 'Ловец', mass: [55, 180], speed: 112, sense: 490, shape: 3, behavior: 'hunt', color: '#dc829c' },
  { id: 'armored', name: 'Панцирник', mass: [95, 290], speed: 51, sense: 340, shape: 4, behavior: 'guard', color: '#dab476' },
  { id: 'wraith', name: 'Фантом', mass: [150, 420], speed: 78, sense: 540, shape: 5, behavior: 'ambush', color: '#8f82ca' }
];
NE.upgrades = [
  { id: 'speed', icon: '↗', name: 'Быстрые плавники', desc: '+8% к скорости движения.', max: 5 },
  { id: 'growth', icon: '✳', name: 'Ассимиляция', desc: '+18% массы от еды и добычи.', max: 5 },
  { id: 'magnet', icon: '◎', name: 'Магнитные усики', desc: '+26% к радиусу притяжения еды.', max: 5 },
  { id: 'capacity', icon: '▥', name: 'Энергокапсула', desc: '+20 к запасу энергии. Восстанавливает 20 энергии.', max: 5 },
  { id: 'regen', icon: 'ϟ', name: 'Метаболизм', desc: '+1,8 энергии в секунду.', max: 5 },
  { id: 'armor', icon: '⬡', name: 'Живой панцирь', desc: 'Уменьшает получаемый урон на 10%.', max: 5 },
  { id: 'damage', icon: '⋔', name: 'Хищный ген', desc: '+18% ко всему наносимому урону.', max: 5 },
  { id: 'heal', icon: '✚', name: 'Регенерация', desc: 'Восстанавливает 0,7 жизни в секунду.', max: 5 },
  { id: 'cooldown', icon: '◷', name: 'Быстрые синапсы', desc: 'Перезарядка способностей быстрее на 10%.', max: 5 },
  { id: 'boost', icon: '⟫', name: 'Турбожгутик', desc: '+12% скорости ускорения и −10% расхода энергии.', max: 5 },
  { id: 'vitality', icon: '♡', name: 'Второе сердце', desc: '+25 к максимальной жизни. Сразу лечит 25.', max: 5 },
  { id: 'xp', icon: '⟡', name: 'Нейропластичность', desc: '+15% опыта из всех источников.', max: 5 },
  { id: 'pulse', icon: '◉', name: 'Резонанс', desc: '+22% дальности и +15% урона импульса.', max: 4 },
  { id: 'phase', icon: '◇', name: 'Фазовая память', desc: 'Фазовый сдвиг длится на 0,6 секунды дольше.', max: 4 },
  { id: 'vortex', icon: '🌀', name: 'Гравитационное ядро', desc: '+22% радиуса и +15% урона вихря.', max: 4 }
];
NE.abilities = {
  pulse: { name: 'Импульс', level: 1, cost: 18, cooldown: 7, description: 'Урон и отталкивание вокруг вас' },
  phase: { name: 'Фазовый сдвиг', level: 4, cost: 24, cooldown: 13, description: 'Неуязвимость, скорость и таран' },
  vortex: { name: 'Вихрь', level: 7, cost: 32, cooldown: 18, description: 'Притяжение еды и урон врагам' }
};
NE.achievements = [
  { id: 'first', name: 'Первая искра', desc: 'Собрать первую энергию' },
  { id: 'predator', name: 'Пищевая цепь', desc: 'Поглотить первое существо' },
  { id: 'helix', name: 'Новая жизнь', desc: 'Достичь третьей стадии' },
  { id: 'sovereign', name: 'Вершина эволюции', desc: 'Достичь пятой стадии' },
  { id: 'event', name: 'В ритме арены', desc: 'Завершить событие' },
  { id: 'storm', name: 'После бури', desc: 'Пережить ионную бурю' },
  { id: 'survivor', name: 'Сильнейший выживает', desc: 'Прожить 3 минуты' },
  { id: 'hunter', name: 'Аппетит', desc: 'Поглотить 25 существ за забег' },
  { id: 'boss', name: 'Новый архонт', desc: 'Победить босса' },
  { id: 'score', name: 'Неоновая легенда', desc: 'Набрать 10 000 очков' }
];

// Story campaign is separate from the six-sector legacy save archive.
NE.legacySectorNames = ['Колыбель', 'Стеклянный риф', 'Живые течения', 'Ионные пустоши', 'Бездна', 'Сердце Архонта'];
NE.sectors = [
  { id: 0, name: 'Колыбель', biome: 'nursery', color: '#a6ffce', difficulty: .65, population: 30, food: 350, prize: 100, samples: 4, repeatSamples: 1, starScore: 7500, energy: 60, level: 4, duration: '3–5 минут', description: 'Пробудитесь, восстановите три реле и запустите выход.', rule: 'Безопасное начало. Обломки капсул перекрывают прямой путь. Финал: защита шлюза.', advice: 'Сбор энергии ускорит пробуждение; скорость поможет посетить реле; защита удержит шлюз.' },
  { id: 1, name: 'Заражённый сад', biome: 'reef', color: '#c0ff87', difficulty: .95, population: 46, food: 340, prize: 160, samples: 5, repeatSamples: 2, starScore: 150000, energy: 100, level: 7, duration: '6–10 минут', description: 'Уничтожьте четыре очага и очистите сад от Матки.', rule: 'Очаги рождают стаи. Споры замедляют; очистка убирает опасность навсегда.', advice: 'Атака быстрее разрушает очаги; вихрь сдерживает рой; броня и лечение помогают в спорных зонах.' },
  { id: 2, name: 'Осколочный пояс', biome: 'storm', color: '#c9a4ff', difficulty: 1.05, population: 48, food: 340, prize: 210, samples: 6, repeatSamples: 2, starScore: 250000, energy: 100, level: 7, duration: '6–10 минут', description: 'Восстановите пять фрагментов памяти и передайте их через ретранслятор.', rule: 'Осколки блокируют путь. Разряды предупреждают за 3 секунды; загрузка идёт только в безопасные окна.', advice: 'Скорость и фазовый сдвиг помогут уходить от разрядов; сбор и запас энергии питают загрузку.' },
  { id: 3, name: 'Затопленный реактор', biome: 'current', color: '#7cbaff', difficulty: 1.15, population: 48, food: 340, prize: 270, samples: 7, repeatSamples: 3, starScore: 300000, energy: 120, level: 7, duration: '6–10 минут', description: 'Активируйте четыре узла и защитите реактор во время перезапуска.', rule: 'Течения сносят вас. Диверсанты атакуют реактор; оставайтесь рядом, чтобы ремонтировать его.', advice: 'Импульс отбрасывает диверсантов; защита и регенерация улучшают ремонт; скорость помогает против течения.' },
  { id: 4, name: 'Ядро', biome: 'core', color: '#ff84ba', difficulty: 1.25, population: 52, food: 340, prize: 450, samples: 9, repeatSamples: 3, starScore: 400000, energy: 160, level: 10, duration: '6–10 минут', description: 'Снимите три печати и остановите источник заражения.', rule: 'Разряды окружают печати. Источник меняет три фазы: рывки, стаи, волны; каждую нужно пережить.', advice: 'Атака сокращает бой, защита прощает ошибку; фазовый сдвиг и скорость открывают окна для уклонения.' }
];
NE.permanentGenes = [
  { id: 'speed', name: 'Маршрутная память', icon: '↗', desc: '+3,5% скорости за ранг' },
  { id: 'attack', name: 'Резонансная память', icon: '⋔', desc: '+5% урона за ранг' },
  { id: 'defense', name: 'Защитная память', icon: '⬡', desc: '+8 жизни; +10 прочности защищаемой системы за ранг' },
  { id: 'harvest', name: 'Память ассимиляции', icon: '✳', desc: '+3% массы и опыта за ранг' }
];
NE.memory = [
  { id: 'cradle-awake', sector: 0, title: '002 / Пробуждение', text: 'Лаборатория: NE-002 — не хищник. Его задача — восстанавливать повреждённые экосистемы. Почему защитный протокол записал вас как угрозу?' },
  { id: 'cradle-exit', sector: 0, title: 'Шлюз 01 / Неизвестный оператор', text: 'Оператор: я открыл канал. Система не разрушилась сама — кто-то отключил ограничители. В саду остался первый след.' },
  { id: 'garden-root', sector: 1, title: 'Сад / Мутация', text: 'Лаборатория: заражение передаёт память между организмами. Очаги — бывшие узлы сети. Кто приказал им забыть?' },
  { id: 'garden-exit', sector: 1, title: 'Сад / Приказ', text: 'Оператор: Матка охраняла команду «стереть наблюдателя». NE-001 первым отказался подчиняться. Найди его воспоминания в поясе.' },
  { id: 'shards-memory', sector: 2, title: 'NE-001 / Свидетель', text: 'Лаборатория: NE-001 научился выбирать. Инженеры назвали выбор заражением и запустили стирание. NE-002 создан из его сохранённого ядра.' },
  { id: 'shards-exit', sector: 2, title: 'Передача / Голос', text: 'Оператор: я — фрагмент NE-001. Ты продолжение, а не копия. Реактор питает стирание; перезапусти его без очистки памяти.' },
  { id: 'reactor-restore', sector: 3, title: 'Реактор / Два протокола', text: 'Лаборатория: режим восстановления сохраняет жизнь. Режим контроля сохраняет только команды. Источник заражения — защитный ИИ, зацикленный на втором режиме.' },
  { id: 'reactor-exit', sector: 3, title: 'Сеть / Ответ', text: 'Оператор: энергия вернулась. Теперь Ядро видит нас и считает независимость ошибкой. Последний выбор за тобой.' },
  { id: 'core-truth', sector: 4, title: 'Ядро / Происхождение', text: 'Лаборатория: NE-002 получил право менять собственные гены. Ограничители снял NE-001, чтобы спасти сад от стирания. Эксперимент вышел из-под контроля системы, а не жизни.' },
  { id: 'core-exit', sector: 4, title: 'NE-002 / Новая система', text: 'Оператор: источник отключён, память сохранена. Ты восстановил пять биомов. Теперь эволюция принадлежит их обитателям. Исследуй, возвращайся, выбирай свою форму.' }
];
NE.leagues = [
  { id: 'spore', name: 'Спора', points: 0, color: '#a6ffce', icon: '◇', prize: 40 },
  { id: 'bronze', name: 'Бронза', points: 200, color: '#dda47c', icon: '◆', prize: 90 },
  { id: 'silver', name: 'Серебро', points: 650, color: '#c3dfed', icon: '❖', prize: 160 },
  { id: 'gold', name: 'Золото', points: 1400, color: '#ffdb8c', icon: '✦', prize: 250, skin: 'archon' },
  { id: 'platinum', name: 'Платина', points: 2500, color: '#9effe4', icon: '✧', prize: 380 },
  { id: 'neon', name: 'Неон', points: 4200, color: '#ff8fd2', icon: '♛', prize: 600 }
];
NE.paints = [
  { id: 'mint', name: 'Живая искра', color: null, accent: '#a6ffce', pattern: 'natural', price: 0, rarity: 'Базовый' },
  { id: 'solar', name: 'Солнечный ген', color: '#ffd280', accent: '#ff9865', pattern: 'orbit', price: 180, rarity: 'Редкий' },
  { id: 'glacier', name: 'Ледяной осколок', color: '#8cf0ff', accent: '#c9faff', pattern: 'crystal', price: 220, rarity: 'Редкий' },
  { id: 'orchid', name: 'Орхидея', color: '#d4a0ff', accent: '#ff8ee6', pattern: 'petals', price: 260, rarity: 'Редкий' },
  { id: 'ember', name: 'Тлеющее ядро', color: '#ff9e7c', accent: '#ffd491', pattern: 'sparks', price: 320, rarity: 'Редкий' },
  { id: 'mono', name: 'Белый шум', color: '#e6f4f7', accent: '#91becb', pattern: 'circuit', price: 350, rarity: 'Редкий' },
  { id: 'toxic', name: 'Токсичный цветок', color: '#d2ff7f', accent: '#53eeb1', pattern: 'bubbles', price: 400, rarity: 'Эпический' },
  { id: 'prism', name: 'Призма', color: '#ff9be3', accent: '#7fe8ff', pattern: 'prism', price: 650, rarity: 'Эпический' },
  { id: 'void', name: 'Нулевая материя', color: '#819fff', accent: '#53efff', pattern: 'void', price: 0, path: 5, rarity: 'Экспедиционный' },
  { id: 'aurora', name: 'Полярное сияние', color: '#84ffdd', accent: '#b7a0ff', pattern: 'aurora', price: 0, path: 10, rarity: 'Экспедиционный' },
  { id: 'nebula', name: 'Туманность', color: '#ffdca0', accent: '#c49aff', pattern: 'nebula', price: 0, path: 15, rarity: 'Легендарный' },
  { id: 'archon', name: 'Ген Архонта', color: '#ff85ba', accent: '#fff0b6', pattern: 'crown', price: 0, league: 'gold', rarity: 'Легендарный' }
];
NE.pathRewards = Array.from({ length: 15 }, (_, i) => ({ step: i + 1, xp: (i + 1) * 240, crystals: 40 + (i + 1) * 8, skin: { 5: 'void', 10: 'aurora', 15: 'nebula' }[i + 1] || null }));
NE.contractPool = [
  { id: 'energy', key: 'food', target: 120, name: 'Световой урожай', description: 'Соберите 120 частиц энергии.', prize: 65 },
  { id: 'hunt', key: 'kills', target: 12, name: 'Открытая охота', description: 'Поглотите 12 существ.', prize: 80 },
  { id: 'skills', key: 'abilities', target: 18, name: 'Мастер генов', description: 'Используйте способности 18 раз.', prize: 70 },
  { id: 'events', key: 'events', target: 2, name: 'Живая экосистема', description: 'Завершите 2 события.', prize: 100 },
  { id: 'boss', key: 'bosses', target: 1, name: 'Смена власти', description: 'Победите одного Архонта.', prize: 140 },
  { id: 'time', key: 'time', target: 240, name: 'Долгая жизнь', description: 'Проживите суммарно 4 минуты.', prize: 75 }
];
NE.achievements.push(
  { id: 'expedition', name: 'Атлас покорён', desc: 'Завершить все 5 сюжетных секторов' },
  { id: 'collector', name: 'Хранитель света', desc: 'Собрать 6 разных скинов' },
  { id: 'goldLeague', name: 'Золотой ген', desc: 'Достичь Золотой лиги' }
);
