import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { muscleDiagramHTML, MUSCLE_META } from '../hybrd-app/js/muscleDiagram.js';
import { EXERCISES, MUSCLES } from '../hybrd-app/js/exercises.js';

const ICONS_DIR = fileURLToPath(new URL('../hybrd-app/icons/muscles/', import.meta.url));

test('every image referenced by any muscleDiagramHTML output actually exists on disk', () => {
  const referenced = new Set();
  for (const muscles of [[], ...MUSCLES.map((m) => [m]), MUSCLES]) {
    for (const match of muscleDiagramHTML(muscles).matchAll(/muscles\/([\w-]+\.png)/g)) {
      referenced.add(match[1]);
    }
  }
  assert.ok(referenced.size > 0);
  for (const file of referenced) {
    assert.ok(existsSync(ICONS_DIR + file), `missing icons/muscles/${file}`);
  }
});

test('a front-only muscle (mid-chest) renders a single body view', () => {
  const html = muscleDiagramHTML(['mid-chest']);
  assert.equal((html.match(/muscle-base/g) || []).length, 1);
  assert.match(html, /body-front\.png/);
  assert.match(html, /chest-front\.png/);
});

test('a back-only muscle (calves) renders a single body view', () => {
  const html = muscleDiagramHTML(['calves']);
  assert.equal((html.match(/muscle-base/g) || []).length, 1);
  assert.match(html, /body-back\.png/);
  assert.match(html, /calves-back\.png/);
});

test('a mix of front and back muscles renders both views', () => {
  const html = muscleDiagramHTML(['mid-chest', 'lats']);
  assert.equal((html.match(/muscle-base/g) || []).length, 2);
  assert.match(html, /body-front\.png/);
  assert.match(html, /body-back\.png/);
});

test('front-delts and rear-delts share the shoulders asset but on opposite views', () => {
  const html = muscleDiagramHTML(['front-delts', 'rear-delts']);
  assert.equal((html.match(/muscle-base/g) || []).length, 2);
  assert.match(html, /shoulders-front\.png/);
  assert.match(html, /shoulders-back\.png/);
});

test('several granular ids sharing one asset+view render only a single overlay image', () => {
  const html = muscleDiagramHTML(['upper-chest', 'mid-chest', 'lower-chest']);
  assert.equal((html.match(/chest-front\.png/g) || []).length, 1);
});

test('an empty muscle list still renders a body outline (front, no overlay)', () => {
  const html = muscleDiagramHTML([]);
  assert.equal((html.match(/muscle-base/g) || []).length, 1);
  assert.doesNotMatch(html, /muscle-overlay/);
});

test('every muscle group has a diagram asset mapping', () => {
  for (const m of MUSCLES) {
    assert.ok(MUSCLE_META[m], `muscle "${m}" has no MUSCLE_META entry`);
  }
});

test('every muscle group used by an exercise has an overlay image reference', () => {
  for (const m of MUSCLES) {
    const html = muscleDiagramHTML([m]);
    const { asset } = MUSCLE_META[m];
    assert.match(html, new RegExp(`${asset}-(front|back)\\.png`), `muscle "${m}" produced no overlay`);
  }
});

test('every exercise in the library produces a renderable diagram', () => {
  for (const e of EXERCISES) {
    const html = muscleDiagramHTML(e.muscles);
    assert.match(html, /muscle-base/, `${e.id} produced no diagram`);
  }
});
