import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { detectPlan } from '../dist/detector.js';
function fixture() {
  const width = 300, height = 200, data = new Uint8ClampedArray(width * height * 4).fill(255);
  const rect = (x, y, w, h) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) { const p = (j * width + i) * 4; data[p] = data[p + 1] = data[p + 2] = 0; } };
  return { width, height, data, rect };
}
test('blank image does not invent walls', () => assert.equal(detectPlan(fixture()).walls.length, 0));
test('finds horizontal and vertical walls and excludes isolated dimension lines', () => {
  const f = fixture(); f.rect(30, 30, 200, 7); f.rect(30, 30, 7, 130); f.rect(20, 10, 250, 1);
  const r = detectPlan(f);
  assert.ok(r.walls.some(w => w.axis === 'h' && Math.abs(w.c - 33) < 3 && w.to - w.from > 190));
  assert.ok(r.walls.some(w => w.axis === 'v' && Math.abs(w.c - 33) < 3 && w.to - w.from > 120));
  assert.ok(!r.walls.some(w => w.axis === 'h' && w.c < 15));
});
test('keeps a gap open and reports it as unclassified', () => {
  const f = fixture(); f.rect(30, 40, 90, 7); f.rect(140, 40, 100, 7);
  const r = detectPlan(f);
  assert.ok(r.openings.some(o => o.axis === 'h' && o.from >= 118 && o.to <= 141 && o.type === 'unclassified'));
});
test('transparent pixels are treated as white', () => {
  const f = fixture(); f.data.fill(0); assert.equal(detectPlan(f).walls.length, 0);
});
test('real plan preserves facade openings and returns bounded geometry', () => {
  const data = gunzipSync(readFileSync(new URL('./fixtures/plano.rgba.gz', import.meta.url)));
  const result = detectPlan({ data, width: 724, height: 424 });
  // Manually checked landmarks, not a frozen copy of the detector output.
  assert.ok(result.openings.some(o => o.axis === 'h' && Math.abs(o.c - 35) < 5 && o.from < 80 && o.to > 80));
  assert.ok(result.walls.some(w => w.axis === 'v' && Math.abs(w.c - 673) < 5 && w.from < 80 && w.to > 80));
  assert.ok(result.walls.some(w => w.axis === 'v' && Math.abs(w.c - 444) < 5 && w.from < 380 && w.to > 380));
  for (const wall of result.walls) {
    const along = wall.axis === 'h' ? result.width : result.height;
    const across = wall.axis === 'h' ? result.height : result.width;
    assert.ok(wall.from >= 0 && wall.to < along && wall.to > wall.from);
    assert.ok(wall.c >= 0 && wall.c < across && wall.thickness > 0);
  }
});
