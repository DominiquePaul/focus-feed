const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const source = readFileSync(require('node:path').join(__dirname, '../shared.js'), 'utf8');

function setup(initial = {}) {
  let now = new Date(2026, 9, 1, 12).getTime();
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const data = structuredClone(initial);
  const context = vm.createContext({ Date: Clock, chrome: { storage: { local: {
    get(keys, callback) { callback(structuredClone(data)); },
    set(items) { Object.assign(data, structuredClone(items)); },
  } } } });
  vm.runInContext(source, context);
  return { FF: context.FF, data, advance(ms) { now += ms; } };
}
const plain = (value) => JSON.parse(JSON.stringify(value));

test('Instagram uses the existing session gap without changing X and LinkedIn history', async () => {
  const prior = { '2026-09-30': { li: { b: 2, u: 1 }, x: { b: 3, u: 1 } } };
  const { FF, data, advance } = setup({ stats: prior });
  assert.equal(await FF.countBlockedVisit('ig'), true);
  assert.deepEqual(data.stats['2026-09-30'], prior['2026-09-30']);
  assert.deepEqual(data.stats[FF.dayKey()].ig, { b: 1, u: 0 });
  advance(5 * 60 * 1000);
  assert.equal(await FF.countBlockedVisit('ig'), false);
  advance(FF.SESSION_GAP_MS);
  assert.equal(await FF.countBlockedVisit('ig'), false);
  advance(FF.SESSION_GAP_MS + 1);
  assert.equal(await FF.countBlockedVisit('ig'), true);
  assert.deepEqual(data.stats[FF.dayKey()].ig, { b: 2, u: 0 });
  assert.equal(await FF.countBlockedVisit('li'), true);
  assert.equal(await FF.countBlockedVisit('x'), true);
  assert.equal(data.stats[FF.dayKey()].li.b, 1);
  assert.equal(data.stats[FF.dayKey()].x.b, 1);
});

test('all-time, weekly and daily totals include all three sites with the existing estimate', () => {
  const { FF } = setup();
  const stats = {
    '2026-09-11': { li: { b: 4, u: 1 }, x: { b: 3, u: 2 } },
    '2026-09-30': { li: { b: 2, u: 0 }, x: { b: 1, u: 0 }, ig: { b: 3, u: 0 } },
    '2026-10-01': { li: { b: 1, u: 0 }, x: { b: 2, u: 1 }, ig: { b: 4, u: 0 } },
  };
  assert.deepEqual(plain(FF.summarize(stats)), { blocked: 20, unlocked: 4, minutes: 112 });
  assert.deepEqual(plain(FF.summarize(stats, 7)), { blocked: 13, unlocked: 1, minutes: 84 });
  assert.deepEqual(plain(FF.summarize(stats, 1)), { blocked: 7, unlocked: 1, minutes: 42 });
  assert.equal(FF.formatMinutes(112), '1h 52m');
});

test('existing statistics need no migration and empty history stays empty', () => {
  const { FF } = setup();
  assert.deepEqual(plain(FF.summarize({ '2026-10-01': { li: { b: 3, u: 1 }, x: { b: 2, u: 0 } } })),
    { blocked: 5, unlocked: 1, minutes: 28 });
  assert.deepEqual(plain(FF.summarize()), { blocked: 0, unlocked: 0, minutes: 0 });
});

test('new Instagram sessions go into the next local calendar day', async () => {
  const { FF, data, advance } = setup();
  await FF.countBlockedVisit('ig');
  advance(24 * 60 * 60 * 1000);
  await FF.countBlockedVisit('ig');
  assert.equal(data.stats['2026-10-01'].ig.b, 1);
  assert.equal(data.stats['2026-10-02'].ig.b, 1);
  assert.equal(FF.summarize(data.stats, 1).blocked, 1);
});

test('site configuration preserves X and LinkedIn unlocks and prevents Instagram unlock controls', () => {
  const { FF } = setup();
  assert.equal(FF.SITES.li.canUnlock, true);
  assert.equal(FF.SITES.x.canUnlock, true);
  assert.equal(FF.SITES.ig.canUnlock, false);
  assert.equal(FF.SITES.ig.messagesURL, '/direct/inbox/');
  assert.equal(FF.isUnlockValid(FF.lastReset()), true);
  assert.equal(FF.isUnlockValid(FF.lastReset() - 1), false);
});
