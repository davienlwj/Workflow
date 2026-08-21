import test from 'node:test';
import assert from 'node:assert/strict';
import { muscleDiagramSVG } from '../vo2max/js/muscleDiagram.js';
import { EXERCISES, MUSCLES } from '../vo2max/js/exercises.js';

test('a front-only muscle (chest) renders a single body view', () => {
  const svg = muscleDiagramSVG(['chest']);
  assert.equal((svg.match(/<svg/g) || []).length, 1);
});

test('a back-only muscle (calves) renders a single body view', () => {
  const svg = muscleDiagramSVG(['calves']);
  assert.equal((svg.match(/<svg/g) || []).length, 1);
});

test('a mix of front and back muscles renders both views', () => {
  const svg = muscleDiagramSVG(['chest', 'back']);
  assert.equal((svg.match(/<svg/g) || []).length, 2);
});

test('an empty muscle list still renders a body outline (front, no highlights)', () => {
  const svg = muscleDiagramSVG([]);
  assert.equal((svg.match(/<svg/g) || []).length, 1);
  assert.match(svg, /class="muscle-active"><\/g>/);
});

test('every muscle group used by an exercise produces some highlighted shape', () => {
  for (const m of MUSCLES) {
    const svg = muscleDiagramSVG([m]);
    // muscle-active group should contain at least one shape, not be empty
    assert.doesNotMatch(svg, /class="muscle-active"><\/g>/, `muscle "${m}" produced no highlight`);
  }
});

test('every exercise in the library produces a renderable diagram', () => {
  for (const e of EXERCISES) {
    const svg = muscleDiagramSVG(e.muscles);
    assert.match(svg, /<svg/, `${e.id} produced no diagram`);
  }
});
