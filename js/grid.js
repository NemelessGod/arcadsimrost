'use strict';
NE.Grid = class {
  constructor(size = 140) { this.size = size; this.cells = new Map(); }
  clear() { this.cells.clear(); }
  key(x, y) { return Math.floor(x / this.size) + ',' + Math.floor(y / this.size); }
  add(entity) { const key = this.key(entity.x, entity.y); let cell = this.cells.get(key); if (!cell) this.cells.set(key, cell = []); cell.push(entity); }
  rebuild(...groups) { this.clear(); for (const group of groups) for (const entity of group) if (!entity.dead) this.add(entity); }
  query(x, y, radius, kind) {
    const result = [], minX = Math.floor((x - radius) / this.size), maxX = Math.floor((x + radius) / this.size), minY = Math.floor((y - radius) / this.size), maxY = Math.floor((y + radius) / this.size), r2 = radius * radius;
    for (let gx = minX; gx <= maxX; gx++) for (let gy = minY; gy <= maxY; gy++) { const cell = this.cells.get(gx + ',' + gy); if (cell) for (const e of cell) if (!e.dead && (!kind || e.kind === kind) && (e.x - x) ** 2 + (e.y - y) ** 2 <= r2) result.push(e); }
    return result;
  }
};
