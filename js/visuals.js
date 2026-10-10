'use strict';
// All artwork stays procedural. Visual seeds never consume the simulation's random stream.
NE.Visuals = (() => {
  const themes = {
    lagoon: { name: 'Биолюминесценция', primary: '#88ffe1', secondary: '#819dff', bg: '#07121d', panel: '#0d1a29' },
    ultraviolet: { name: 'Ультрафиолет', primary: '#cba7ff', secondary: '#58e6e1', bg: '#0c0a1c', panel: '#19162c' },
    solar: { name: 'Солнечный шторм', primary: '#ffd29b', secondary: '#ff87bc', bg: '#160d18', panel: '#251827' }
  };
  const biomes = {
    wild: ['#55cfae', '#7994d8', '#0a1722'], nursery: ['#69e4af', '#6fc6d4', '#0a211e'],
    reef: ['#6ee2f6', '#c0a7ff', '#0d192a'], current: ['#73aaff', '#52d8bf', '#0a1b2c'],
    storm: ['#c198ff', '#ff86bd', '#191124'], abyss: ['#9486ff', '#487dba', '#090b1b'],
    core: ['#ff88b1', '#eac080', '#240f1b']
  };
  const relations = { edible: { color: '#58e9d5', symbol: '●', label: 'ДОБЫЧА' }, equal: { color: '#ffe19a', symbol: '◆', label: 'РАВНЫЙ' }, danger: { color: '#ff719f', symbol: '▲', label: 'ХИЩНИК' } };
  const habitats = ['Ищет еду и быстро убегает. Хорошая первая добыча.', 'Медленно пасётся и растёт. Удобная добыча после первого роста.', 'Вместе с союзниками охотится смелее. Разделяйте стаю импульсом.', 'Чует слабых издалека и ускоряется в погоне. Сохраняйте энергию для отхода.', 'Защищает территорию; панцирь снижает урон на 40%. Используйте вихрь и повторные удары.', 'Подкрадывается, затем бросается в атаку. Следите за мини-картой и фазовым сдвигом.'];
  const mix = (a, b, amount) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - amount) + parseInt(b.slice(i, i + 2), 16) * amount).toString(16).padStart(2, '0')).join('');
  function palette(biome = 'wild') {
    const theme = themes[NE.Save.data.settings.theme] || themes.lagoon, base = biomes[biome] || biomes.wild;
    return { primary: mix(base[0], theme.primary, .3), secondary: mix(base[1], theme.secondary, .35), bg: theme.bg, deep: base[2] };
  }
  function apply() {
    const s = NE.Save.data.settings, theme = themes[s.theme] || themes.lagoon, root = document.documentElement;
    root.dataset.theme = s.theme; root.dataset.motion = s.motion ? 'full' : 'reduced'; root.dataset.contrast = s.contrast ? 'high' : 'normal';
    root.style.setProperty('--mint', theme.primary); root.style.setProperty('--bg', theme.bg); root.style.setProperty('--panel', theme.panel + 'ed');
    root.style.setProperty('--ambient', theme.secondary); document.querySelector('meta[name="theme-color"]').content = theme.bg;
  }
  function seed(i) { const value = Math.sin(i * 127.1 + 311.7) * 43758.5453; return value - Math.floor(value); }
  const textureCache = new Map();
  function texture(biome) {
    const s = NE.Save.data.settings, key = `${s.theme}/${biome}/${s.quality}`;
    if (textureCache.has(key)) return textureCache.get(key);
    const canvas = document.createElement('canvas'), p = palette(biome);
    canvas.width = canvas.height = s.quality === 'low' ? 256 : 512;
    const c = canvas.getContext('2d'), size = canvas.width;
    c.fillStyle = p.bg; c.fillRect(0, 0, size, size);
    for (let i = 0; i < 8; i++) {
      const x = seed(i + 3) * size, y = seed(i + 19) * size, radius = size * (.35 + seed(i + 33) * .5);
      const gradient = c.createRadialGradient(x, y, 0, x, y, radius);
      const color = i % 2 ? p.secondary : p.primary; gradient.addColorStop(0, color + '18'); gradient.addColorStop(1, color + '00');
      c.fillStyle = gradient; c.fillRect(0, 0, size, size);
    }
    c.globalAlpha = .09;
    for (let i = 0; i < (s.quality === 'low' ? 90 : 400); i++) { c.fillStyle = i % 3 ? p.deep : p.primary; c.fillRect(seed(i + 200) * size, seed(i + 900) * size, 1, 1); }
    c.globalAlpha = 1;
    if (textureCache.size >= 3) textureCache.delete(textureCache.keys().next().value);
    textureCache.set(key, canvas); return canvas;
  }
  return { themes, relations, habitats, mix, palette, apply, seed, texture, get cacheSize() { return textureCache.size; } };
})();
