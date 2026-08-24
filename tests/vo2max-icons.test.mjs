import test from 'node:test';
import assert from 'node:assert/strict';
import { runIconSVG, dumbbellIconSVG } from '../vo2max/js/icons.js';

test('runIconSVG returns a valid, tagged svg', () => {
  const svg = runIconSVG();
  assert.match(svg, /<svg[^>]*class="glyph-icon glyph-run/);
  assert.match(svg, /<\/svg>$/);
});

test('dumbbellIconSVG returns a valid, tagged svg', () => {
  const svg = dumbbellIconSVG();
  assert.match(svg, /<svg[^>]*class="glyph-icon glyph-workout/);
  assert.match(svg, /<\/svg>$/);
});

test('an extra class is appended, not replacing the base classes', () => {
  assert.match(runIconSVG('foo'), /class="glyph-icon glyph-run foo"/);
  assert.match(dumbbellIconSVG('bar'), /class="glyph-icon glyph-workout bar"/);
});
