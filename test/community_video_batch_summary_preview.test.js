import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runFeature } from '../src/community/video_batch_summary_preview.mjs';

function assertInvalid(input) {
  assert.throws(() => runFeature(input), (err) => {
    assert.ok(err instanceof TypeError);
    assert.equal(err.message, 'INVALID_BATCH_SUMMARY_PREVIEW');
    return true;
  });
}

describe('payload shape', () => {
  it('rejects Array, null and non-object payloads', () => {
    assertInvalid(null);
    assertInvalid(undefined);
    assertInvalid([]);
    assertInvalid([{ status: 'ok' }]);
    assertInvalid('entries');
    assertInvalid(42);
    assertInvalid(true);
  });
  it('rejects payloads without exactly one entries key', () => {
    assertInvalid({});
    assertInvalid({ entries: [], extra: 1 });
    assertInvalid({ foo: [] });
    assertInvalid({ status: 'ok' });
  });
});

describe('entries validation', () => {
  it('rejects missing, undefined, null and non-Array entries', () => {
    assertInvalid({ entries: undefined });
    assertInvalid({ entries: null });
    assertInvalid({ entries: 'ok' });
    assertInvalid({ entries: 0 });
    assertInvalid({ entries: true });
    assertInvalid({ entries: {} });
  });
  it('rejects sparse and overlong arrays and non-object elements', () => {
    const sparse = new Array(2);
    assertInvalid({ entries: sparse });
    const overlong = [];
    for (let i = 0; i < 33; i += 1) {
      overlong.push({ status: 'ok' });
    }
    assertInvalid({ entries: overlong });
    assertInvalid({ entries: [null] });
    assertInvalid({ entries: [undefined] });
    assertInvalid({ entries: ['ok'] });
    assertInvalid({ entries: [42] });
    assertInvalid({ entries: [true] });
    assertInvalid({ entries: [[{ status: 'ok' }]] });
  });
});

describe('status validation', () => {
  it('rejects missing or non ok/error status', () => {
    assertInvalid({ entries: [{}] });
    assertInvalid({ entries: [{ status: undefined }] });
    assertInvalid({ entries: [{ status: null }] });
    assertInvalid({ entries: [{ status: '' }] });
    assertInvalid({ entries: [{ status: 'OK' }] });
    assertInvalid({ entries: [{ status: 'warn' }] });
    assertInvalid({ entries: [{ status: 0 }] });
    assertInvalid({ entries: [{ status: true }] });
    assertInvalid({ entries: [{ status: ['ok'] }] });
    assertInvalid({ entries: [{ status: { v: 'ok' } }] });
  });
  it('rejects batch when any entry is invalid', () => {
    assertInvalid({ entries: [{ status: 'ok' }, {}] });
    assertInvalid({ entries: [{ status: 'ok' }, { status: 'bad' }] });
  });
});

describe('valid summaries', () => {
  it('summarizes empty batch', () => {
    const out = runFeature({ entries: [] });
    assert.deepEqual(out, { total: 0, ok: 0, errors: 0 });
    assert.deepEqual(Object.keys(out), ['total', 'ok', 'errors']);
  });
  it('summarizes all-ok and all-error batches', () => {
    assert.deepEqual(runFeature({ entries: [{ status: 'ok' }, { status: 'ok' }] }), { total: 2, ok: 2, errors: 0 });
    assert.deepEqual(runFeature({ entries: [{ status: 'error' }, { status: 'error' }] }), { total: 2, ok: 0, errors: 2 });
  });
  it('summarizes mixed batch and ignores extra keys', () => {
    const out = runFeature({ entries: [{ status: 'ok' }, { status: 'error' }, { status: 'ok' }] });
    assert.deepEqual(out, { total: 3, ok: 2, errors: 1 });
    const withExtra = runFeature({ entries: [{ index: 0, status: 'ok', video: 'a.mp4' }, { index: 1, status: 'error', code: 'E1' }] });
    assert.deepEqual(withExtra, { total: 2, ok: 1, errors: 1 });
    assert.deepEqual(Object.keys(withExtra), ['total', 'ok', 'errors']);
  });
  it('preserves input, returns fresh refs and stays deterministic', () => {
    const input = { entries: [{ status: 'ok', index: 0 }, { status: 'error', index: 1 }] };
    const before = JSON.stringify(input);
    const first = runFeature(input);
    const second = runFeature(input);
    assert.equal(JSON.stringify(input), before);
    assert.deepEqual(first, { total: 2, ok: 1, errors: 1 });
    assert.deepEqual(second, first);
    assert.notEqual(first, second);
  });
});
