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

NE.sectors = [
  { id: 0, name: 'Колыбель', biome: 'nursery', color: '#a6ffce', accent: '#295640', difficulty: .8, population: 44, food: 350, bossTime: null, goals: [{ key: 'food', target: 40, label: 'Энергия' }, { key: 'level', target: 4, label: 'Уровень' }], description: 'Соберите 40 частиц и достигните уровня 4.', rule: 'Мягкая экосистема. Здесь начинается ваша экспедиция.', prize: 100, starScore: 1200 },
  { id: 1, name: 'Стеклянный риф', biome: 'reef', color: '#4ce6e0', accent: '#225765', difficulty: .95, population: 56, food: 360, bossTime: null, goals: [{ key: 'kills', target: 8, label: 'Поглощения' }, { key: 'level', target: 7, label: 'Уровень' }], description: 'Поглотите 8 существ и достигните уровня 7.', rule: 'Густой риф с быстрыми стаями и богатой пищевой цепью.', prize: 140, starScore: 3500 },
  { id: 2, name: 'Живые течения', biome: 'current', color: '#7cbaff', accent: '#234563', difficulty: 1.05, population: 58, food: 340, bossTime: null, goals: [{ key: 'time', target: 110, label: 'Выживание' }, { key: 'kills', target: 8, label: 'Поглощения' }], description: 'Проживите 1:50 и поглотите 8 существ.', rule: 'Течения сносят организмы. Ускорение помогает удерживать курс.', prize: 180, starScore: 6500 },
  { id: 3, name: 'Ионные пустоши', biome: 'storm', color: '#e599ff', accent: '#49315c', difficulty: 1.15, population: 62, food: 340, bossTime: null, goals: [{ key: 'events', target: 2, label: 'События' }, { key: 'mass', target: 300, label: 'Масса' }], description: 'Завершите 2 события и наберите 300 массы.', rule: 'Поля разряжаются по циклу. Ищите безопасные проходы и следите за предупреждением.', prize: 230, starScore: 8500 },
  { id: 4, name: 'Бездна', biome: 'abyss', color: '#9c92ff', accent: '#27213e', difficulty: 1.35, population: 66, food: 300, bossTime: null, goals: [{ key: 'level', target: 13, label: 'Уровень' }, { key: 'kills', target: 18, label: 'Поглощения' }], description: 'Достигните уровня 13 и поглотите 18 существ.', rule: 'Света меньше, хищников больше. Мини-карта и фазовый сдвиг помогут выжить.', prize: 300, starScore: 11500 },
  { id: 5, name: 'Сердце Архонта', biome: 'core', color: '#ff84ba', accent: '#542638', difficulty: 1.4, population: 70, food: 350, bossTime: 100, goals: [{ key: 'bosses', target: 1, label: 'Архонт' }], description: 'Победите усиленного Архонта.', rule: 'Ионные поля и усиленный босс. Он пробуждается через 1:40 или на пятой стадии.', prize: 450, starScore: 15000 }
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
  { id: 'expedition', name: 'Атлас покорён', desc: 'Завершить все 6 секторов экспедиции' },
  { id: 'collector', name: 'Хранитель света', desc: 'Собрать 6 разных скинов' },
  { id: 'goldLeague', name: 'Золотой ген', desc: 'Достичь Золотой лиги' }
);
