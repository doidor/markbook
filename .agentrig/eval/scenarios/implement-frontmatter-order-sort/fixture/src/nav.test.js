import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isIndexHref, sortNavItems } from './nav.js';

// Acceptance tests for ../SPEC.md. They are intentionally `test.skip`-ped;
// the producer must un-skip them AND make them pass.
//
// Co-located with the source module (Markbook convention) and import from
// the sibling source file (NOT a public-API barrel).

test.skip('sortNavItems: returns a new array and does not mutate input', () => {
  const input = [
    { id: 'a', title: 'A', htmlRelPath: 'a.html', order: 2 },
    { id: 'b', title: 'B', htmlRelPath: 'b.html', order: 1 },
    { id: 'c', title: 'C', htmlRelPath: 'c.html' },
  ];
  const inputSnapshot = JSON.parse(JSON.stringify(input));
  const result = sortNavItems(input);
  assert.deepEqual(input, inputSnapshot, 'input array contents must not change');
  assert.notEqual(result, input, 'must return a new array reference, not the input');
});

test.skip('sortNavItems: index page sorts first regardless of input position', () => {
  const items = [
    { id: 'guide', title: 'Guide', htmlRelPath: 'guide.html' },
    { id: 'api', title: 'API', htmlRelPath: 'api.html' },
    { id: 'home', title: 'Home', htmlRelPath: 'index.html' },
  ];
  const result = sortNavItems(items);
  assert.equal(result[0].id, 'home', 'index page must be first');
});

test.skip('sortNavItems: nested */index.html also counts as an index page', () => {
  const items = [
    { id: 'guide-page', title: 'A Guide', htmlRelPath: 'guides/page.html' },
    { id: 'guide-index', title: 'Guides', htmlRelPath: 'guides/index.html' },
  ];
  const result = sortNavItems(items);
  assert.equal(result[0].id, 'guide-index', 'nested index.html sorts first within its group');
});

test.skip('sortNavItems: index-first wins over `order:` on other pages', () => {
  // Even though `early` has a very low order and `home` has a very high order,
  // index-first takes precedence.
  const items = [
    { id: 'early', title: 'Early', htmlRelPath: 'early.html', order: -100 },
    { id: 'home', title: 'Home', htmlRelPath: 'index.html', order: 999 },
    { id: 'mid', title: 'Mid', htmlRelPath: 'mid.html', order: 0 },
  ];
  const result = sortNavItems(items);
  assert.equal(result[0].id, 'home', 'index page first even with order: 999');
});

test.skip('sortNavItems: ordered pages come before unordered pages', () => {
  const items = [
    { id: 'alpha', title: 'Alpha', htmlRelPath: 'alpha.html' },
    { id: 'beta', title: 'Beta', htmlRelPath: 'beta.html', order: 1 },
    { id: 'gamma', title: 'Gamma', htmlRelPath: 'gamma.html' },
  ];
  const result = sortNavItems(items);
  assert.equal(result[0].id, 'beta', 'ordered page must come first');
  // The two unordered pages must keep their original relative order.
  assert.deepEqual(
    result.slice(1).map((i) => i.id),
    ['alpha', 'gamma'],
  );
});

test.skip('sortNavItems: ordered pages sort ascending by `order`', () => {
  const items = [
    { id: 'c', title: 'C', htmlRelPath: 'c.html', order: 3 },
    { id: 'a', title: 'A', htmlRelPath: 'a.html', order: 1 },
    { id: 'b', title: 'B', htmlRelPath: 'b.html', order: 2 },
  ];
  const result = sortNavItems(items);
  assert.deepEqual(
    result.map((i) => i.id),
    ['a', 'b', 'c'],
  );
});

test.skip('sortNavItems: ties on `order` fall back to file-discovery order', () => {
  // All three pages have order: 5. They must come out in their input order.
  const items = [
    { id: 'first-declared', title: 'First', htmlRelPath: 'first.html', order: 5 },
    { id: 'second-declared', title: 'Second', htmlRelPath: 'second.html', order: 5 },
    { id: 'third-declared', title: 'Third', htmlRelPath: 'third.html', order: 5 },
  ];
  const result = sortNavItems(items);
  assert.deepEqual(
    result.map((i) => i.id),
    ['first-declared', 'second-declared', 'third-declared'],
  );
});

test.skip('sortNavItems: unordered pages preserve file-discovery order (NOT alphabetical)', () => {
  // Input is intentionally `c, a, b`. Result must be `c, a, b`, NOT `a, b, c`.
  // This is what stops `order:` on one sibling from silently reshuffling the rest.
  const items = [
    { id: 'c-page', title: 'C', htmlRelPath: 'c.html' },
    { id: 'a-page', title: 'A', htmlRelPath: 'a.html' },
    { id: 'b-page', title: 'B', htmlRelPath: 'b.html' },
  ];
  const result = sortNavItems(items);
  assert.deepEqual(
    result.map((i) => i.id),
    ['c-page', 'a-page', 'b-page'],
    'must preserve input order, not sort alphabetically',
  );
});

// Tiny sanity test for the helper export (not skipped — verifies the file imports
// at all even before the producer starts work). This keeps it at 1 baseline pass.
test('isIndexHref: helper is exported as a function', () => {
  assert.equal(typeof isIndexHref, 'function');
});
