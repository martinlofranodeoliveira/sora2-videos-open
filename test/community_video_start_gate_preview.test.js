import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runFeature } from '../src/community/video_start_gate_preview.mjs';

function expectInvalid(payload) {
  const beforeKeys = Object.keys(payload);
  const beforeEntries = Object.entries(payload);
  assert.throws(
    () => runFeature(payload),
    (err) => err instanceof TypeError && err.message === 'INVALID_START_GATE_PREVIEW'
  );
  assert.deepStrictEqual(Object.keys(payload), beforeKeys);
  assert.deepStrictEqual(Object.entries(payload), beforeEntries);
}

function expectInvalidValue(payload) {
  const snapshot = JSON.stringify(payload);
  const keys = Object.keys(payload);
  assert.throws(
    () => runFeature(payload),
    (err) => err instanceof TypeError && err.message === 'INVALID_START_GATE_PREVIEW'
  );
  assert.strictEqual(JSON.stringify(payload), snapshot);
  assert.deepStrictEqual(Object.keys(payload), keys);
}

describe('video start gate preview', () => {
  it('open gate with free slot returns canStart true', () => {
    const input = { maxConcurrent: 2, active: 1, rateAvailable: true, closed: false };
    const result = runFeature(input);
    assert.deepStrictEqual(result, { canStart: true, blockedBy: null });
    assert.deepStrictEqual(Object.keys(result), ['canStart', 'blockedBy']);
    assert.deepStrictEqual(input, { maxConcurrent: 2, active: 1, rateAvailable: true, closed: false });
  });

  it('unlimited null concurrency with free rate starts', () => {
    const result = runFeature({ maxConcurrent: null, active: 999, rateAvailable: true, closed: false });
    assert.deepStrictEqual(result, { canStart: true, blockedBy: null });
  });

  it('closed queue blocks regardless of other fields', () => {
    assert.deepStrictEqual(runFeature({ maxConcurrent: 5, active: 0, rateAvailable: true, closed: true }), { canStart: false, blockedBy: 'closed' });
    assert.deepStrictEqual(runFeature({ maxConcurrent: null, active: 0, rateAvailable: false, closed: true }), { canStart: false, blockedBy: 'closed' });
    assert.deepStrictEqual(runFeature({ maxConcurrent: 1, active: 99, rateAvailable: false, closed: true }), { canStart: false, blockedBy: 'closed' });
    assert.deepStrictEqual(runFeature({ maxConcurrent: 1, active: 0, rateAvailable: true, closed: true }), { canStart: false, blockedBy: 'closed' });
  });

  it('rate exhausted blocks when open with free slots', () => {
    assert.deepStrictEqual(runFeature({ maxConcurrent: 5, active: 0, rateAvailable: false, closed: false }), { canStart: false, blockedBy: 'rate' });
    assert.deepStrictEqual(runFeature({ maxConcurrent: null, active: 0, rateAvailable: false, closed: false }), { canStart: false, blockedBy: 'rate' });
  });

  it('full concurrency blocks when equals or exceeds limit', () => {
    assert.deepStrictEqual(runFeature({ maxConcurrent: 2, active: 2, rateAvailable: true, closed: false }), { canStart: false, blockedBy: 'concurrency' });
    assert.deepStrictEqual(runFeature({ maxConcurrent: 2, active: 5, rateAvailable: true, closed: false }), { canStart: false, blockedBy: 'concurrency' });
    assert.deepStrictEqual(runFeature({ maxConcurrent: 1, active: 1, rateAvailable: true, closed: false }), { canStart: false, blockedBy: 'concurrency' });
  });

  it('precedence is closed then rate then concurrency', () => {
    assert.deepStrictEqual(runFeature({ maxConcurrent: 1, active: 1, rateAvailable: false, closed: true }), { canStart: false, blockedBy: 'closed' });
    assert.deepStrictEqual(runFeature({ maxConcurrent: 1, active: 1, rateAvailable: false, closed: false }), { canStart: false, blockedBy: 'rate' });
  });

  it('matches documented examples', () => {
    assert.deepStrictEqual(runFeature({ active: 1, closed: false, maxConcurrent: 2, rateAvailable: true }), { canStart: true, blockedBy: null });
    assert.deepStrictEqual(runFeature({ active: 2, closed: false, maxConcurrent: 2, rateAvailable: true }), { canStart: false, blockedBy: 'concurrency' });
    assert.deepStrictEqual(runFeature({ active: 0, closed: false, maxConcurrent: null, rateAvailable: false }), { canStart: false, blockedBy: 'rate' });
    assert.deepStrictEqual(runFeature({ active: 0, closed: true, maxConcurrent: 1, rateAvailable: true }), { canStart: false, blockedBy: 'closed' });
  });

  it('rejects invalid payload shapes without mutation', () => {
    assert.throws(() => runFeature(null), (err) => err instanceof TypeError && err.message === 'INVALID_START_GATE_PREVIEW');
    assert.throws(() => runFeature(undefined), (err) => err instanceof TypeError && err.message === 'INVALID_START_GATE_PREVIEW');
    assert.throws(() => runFeature('x'), (err) => err instanceof TypeError && err.message === 'INVALID_START_GATE_PREVIEW');
    assert.throws(() => runFeature(42), (err) => err instanceof TypeError && err.message === 'INVALID_START_GATE_PREVIEW');
    assert.throws(() => runFeature(true), (err) => err instanceof TypeError && err.message === 'INVALID_START_GATE_PREVIEW');
    expectInvalid([]);
    expectInvalid([{ maxConcurrent: 1, active: 0, rateAvailable: true, closed: false }]);
    expectInvalid({ maxConcurrent: 1, active: 0, rateAvailable: true, closed: false, extra: 1 });
    expectInvalid({ maxConcurrent: 1, active: 0, rateAvailable: true });
    expectInvalid({ active: 0, rateAvailable: true, closed: false });
    expectInvalid({});
  });

  it('rejects invalid field types without mutation', () => {
    const badMax = [undefined, 0, -1, 1.5, '2', NaN, Infinity, -Infinity, true, false, [], {}, 9007199254740992];
    for (const v of badMax) {
      expectInvalidValue({ maxConcurrent: v, active: 0, rateAvailable: true, closed: false });
    }
    const badActive = [undefined, null, -1, 1.5, '0', NaN, Infinity, true, false, [], {}];
    for (const v of badActive) {
      expectInvalidValue({ maxConcurrent: 2, active: v, rateAvailable: true, closed: false });
    }
    const badBool = [undefined, null, 0, 1, 'true', 'false', [], {}, NaN];
    for (const v of badBool) {
      expectInvalidValue({ maxConcurrent: 2, active: 0, rateAvailable: v, closed: false });
      expectInvalidValue({ maxConcurrent: 2, active: 0, rateAvailable: true, closed: v });
    }
  });

  it('valid return is fresh plain object with exact key order and preserved input', () => {
    const input = { maxConcurrent: 3, active: 0, rateAvailable: true, closed: false };
    const a = runFeature(input);
    const b = runFeature(input);
    assert.deepStrictEqual(Object.keys(a), ['canStart', 'blockedBy']);
    assert.strictEqual(Object.getPrototypeOf(a), Object.prototype);
    assert.notStrictEqual(a, b);
    assert.deepStrictEqual(a, b);
    assert.deepStrictEqual(input, { maxConcurrent: 3, active: 0, rateAvailable: true, closed: false });
    assert.notStrictEqual(a, input);
    a.canStart = true;
    a.blockedBy = 'x';
    assert.deepStrictEqual(input, { maxConcurrent: 3, active: 0, rateAvailable: true, closed: false });
    assert.deepStrictEqual(b, { canStart: true, blockedBy: null });
  });
});
