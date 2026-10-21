import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runFeature } from '../src/community/video_batch_input_preview.mjs';

function assertInvalid(fn) {
  assert.throws(fn, (e) => e instanceof TypeError && e.message === 'INVALID_BATCH_INPUT');
}

describe('video batch input preview payload shape', () => {
  it('throws for non-object, null and Array payloads', () => {
    assertInvalid(() => runFeature(null));
    assertInvalid(() => runFeature(undefined));
    assertInvalid(() => runFeature(42));
    assertInvalid(() => runFeature('files'));
    assertInvalid(() => runFeature(true));
    assertInvalid(() => runFeature([]));
    assertInvalid(() => runFeature([{ files: [] }]));
  });
  it('throws for extra own enumerable keys before reading values', () => {
    assertInvalid(() => runFeature({ files: [], extra: 1 }));
    assertInvalid(() => runFeature({ files: [], concurrency: 2, timeout: 15000, other: 'x' }));
    assertInvalid(() => runFeature({ files: 'not-an-array', bogus: 1 }));
  });
  it('throws when files is missing or not an Array', () => {
    assertInvalid(() => runFeature({}));
    assertInvalid(() => runFeature({ concurrency: 2 }));
    assertInvalid(() => runFeature({ files: undefined }));
    assertInvalid(() => runFeature({ files: null }));
    assertInvalid(() => runFeature({ files: 'a.mp4' }));
    assertInvalid(() => runFeature({ files: {} }));
  });
});

describe('video batch input preview files validation', () => {
  it('rejects length above 32', () => {
    const big = [];
    for (const v of Array.from({ length: 33 }, (_, i) => String(i))) {
      big.push(v);
    }
    assertInvalid(() => runFeature({ files: big }));
  });
  it('accepts empty and 32 entries', () => {
    assert.deepEqual(runFeature({ files: [] }), { files: [], concurrency: 2, timeout: 15000 });
    const items = [];
    for (const v of Array.from({ length: 32 }, (_, i) => String(i))) {
      items.push(v);
    }
    const out = runFeature({ files: items });
    assert.equal(out.files.length, 32);
  });
  it('rejects holes, empty, overlong and coerced elements', () => {
    assertInvalid(() => runFeature({ files: [''] }));
    assertInvalid(() => runFeature({ files: ['x'.repeat(4097)] }));
    assertInvalid(() => runFeature({ files: [undefined] }));
    assertInvalid(() => runFeature({ files: [null] }));
    assertInvalid(() => runFeature({ files: [123] }));
    assertInvalid(() => runFeature({ files: [true] }));
    assertInvalid(() => runFeature({ files: [[]] }));
    assertInvalid(() => runFeature({ files: [{}] }));
    const holey = new Array(1);
    assertInvalid(() => runFeature({ files: holey }));
  });
  it('accepts boundary lengths 1 and 4096', () => {
    const a = runFeature({ files: ['x', 'y'.repeat(4096)] });
    assert.deepEqual(a.files, ['x', 'y'.repeat(4096)]);
  });
  it('preserves duplicates in order with fresh copy', () => {
    const input = { files: ['a.mp4', 'a.mp4', 'b.mp4'] };
    const out = runFeature(input);
    assert.deepEqual(out.files, ['a.mp4', 'a.mp4', 'b.mp4']);
    assert.notStrictEqual(out.files, input.files);
  });
});

describe('video batch input preview concurrency and timeout', () => {
  it('defaults omitted and undefined values', () => {
    assert.deepEqual(runFeature({ files: [] }), { files: [], concurrency: 2, timeout: 15000 });
    assert.deepEqual(runFeature({ files: [], concurrency: undefined, timeout: undefined }), { files: [], concurrency: 2, timeout: 15000 });
  });
  it('accepts valid integer bounds', () => {
    assert.equal(runFeature({ files: [], concurrency: 1, timeout: 1 }).concurrency, 1);
    assert.equal(runFeature({ files: [], concurrency: 4, timeout: 30000 }).concurrency, 4);
    assert.equal(runFeature({ files: [], concurrency: 1, timeout: 5000 }).timeout, 5000);
  });
  it('rejects fractions, strings, null, NaN, Infinity and booleans', () => {
    for (const badC of [0, 5, 1.5, '2', null, NaN, Infinity, true, false]) {
      assertInvalid(() => runFeature({ files: [], concurrency: badC }));
    }
    for (const badT of [0, 30001, 1.5, '5000', null, NaN, Infinity, true, false]) {
      assertInvalid(() => runFeature({ files: [], timeout: badT }));
    }
  });
});

describe('video batch input preview result shape and purity', () => {
  it('returns fresh object with exact key order and no shared refs', () => {
    const input = { files: ['clip-a.mp4', 'clip-b.mp4'] };
    const snapshot = JSON.stringify(input);
    const out = runFeature(input);
    assert.deepEqual(Object.keys(out), ['files', 'concurrency', 'timeout']);
    assert.deepEqual(out, { files: ['clip-a.mp4', 'clip-b.mp4'], concurrency: 2, timeout: 15000 });
    assert.notStrictEqual(out.files, input.files);
    assert.equal(JSON.stringify(input), snapshot);
    out.files.push('late.mp4');
    assert.equal(input.files.length, 2);
  });
  it('matches contract examples and is deterministic', () => {
    assert.deepEqual(runFeature({ files: ['clip-a.mp4', 'clip-b.mp4'] }), { files: ['clip-a.mp4', 'clip-b.mp4'], concurrency: 2, timeout: 15000 });
    assert.deepEqual(runFeature({ files: [], concurrency: 1, timeout: 5000 }), { files: [], concurrency: 1, timeout: 5000 });
    assert.deepEqual(runFeature({ files: ['a.mp4', 'a.mp4'], concurrency: 4, timeout: 30000 }), { files: ['a.mp4', 'a.mp4'], concurrency: 4, timeout: 30000 });
    const payload = { files: ['a.mp4'], concurrency: 3, timeout: 7000 };
    const first = runFeature(payload);
    const second = runFeature(payload);
    assert.deepEqual(first, second);
    assert.notStrictEqual(first, second);
    assert.notStrictEqual(first.files, second.files);
  });
});
