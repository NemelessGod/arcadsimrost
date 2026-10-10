'use strict';
window.NE = {};
NE.C = { width: 3600, height: 2600, foodCap: 420, enemyCap: 84, particleCap: 360, projectileCap: 72, step: 1 / 60, bossTime: 240 };
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
