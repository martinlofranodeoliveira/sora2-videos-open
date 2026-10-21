import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runFeature } from '../src/community/video_job_spec_preview.mjs';

function rejects(payload) {
  let failed = false;
  try {
    runFeature(payload);
  } catch (err) {
    failed = true;
    assert.equal(err instanceof TypeError, true);
    assert.equal(err.message, 'INVALID_JOB_SPEC');
  }
  assert.equal(failed, true);
}

describe('video job spec preview', () => {
  it('applies defaults for minimal valid spec', () => {
    const out = runFeature({ provider: 'my-provider', prompt: 'A quiet forest' });
    assert.deepEqual(out, { provider: 'my-provider', prompt: 'A quiet forest', seconds: 8, size: '1280x720' });
    assert.deepEqual(Object.keys(out), ['provider', 'prompt', 'seconds', 'size']);
  });
  it('trims prompt and keeps explicit values', () => {
    const out = runFeature({ provider: 'renderer-1', prompt: '  hello world  ', seconds: 10, size: '640x480' });
    assert.deepEqual(out, { provider: 'renderer-1', prompt: 'hello world', seconds: 10, size: '640x480' });
  });
  it('accepts boundary values', () => {
    const low = runFeature({ provider: 'a', prompt: 'x', seconds: 1, size: '64x64' });
    assert.deepEqual(low, { provider: 'a', prompt: 'x', seconds: 1, size: '64x64' });
    const high = runFeature({ provider: 'a0-9-zzzz', prompt: 'y', seconds: 120, size: '4096x4096' });
    assert.deepEqual(high, { provider: 'a0-9-zzzz', prompt: 'y', seconds: 120, size: '4096x4096' });
    const forty = 'a123456789012345678901234567890123456789';
    assert.equal(forty.length, 40);
    const out = runFeature({ provider: forty, prompt: 'ok', seconds: 8, size: '1280x720' });
    assert.equal(out.provider, forty);
  });
  it('rejects array null and non-object payloads', () => {
    rejects(null);
    rejects(undefined);
    rejects([]);
    rejects([{ provider: 'a', prompt: 'x' }]);
    rejects('nope');
    rejects(42);
    rejects(true);
  });
  it('rejects extra keys before normalization', () => {
    rejects({ provider: 'a', prompt: 'x', extra: 1 });
    rejects({ provider: 'a', prompt: 'x', seconds: 8, size: '64x64', other: 'y' });
  });
  it('validates provider pattern without coercion', () => {
    rejects({ prompt: 'x' });
    rejects({ provider: undefined, prompt: 'x' });
    rejects({ provider: '', prompt: 'x' });
    rejects({ provider: 'ABC', prompt: 'x' });
    rejects({ provider: ' has-space', prompt: 'x' });
    rejects({ provider: 123, prompt: 'x' });
    rejects({ provider: 'A1234567890123456789012345678901234567890', prompt: 'x' });
    rejects({ provider: '0lead', prompt: 'x' });
    rejects({ provider: '-lead', prompt: 'x' });
  });
  it('validates prompt length and trim without coercion', () => {
    rejects({ provider: 'a' });
    rejects({ provider: 'a', prompt: undefined });
    rejects({ provider: 'a', prompt: '' });
    rejects({ provider: 'a', prompt: '   ' });
    rejects({ provider: 'a', prompt: 42 });
    rejects({ provider: 'a', prompt: 'x'.repeat(10001) });
    const longOk = 'x'.repeat(10000);
    const out = runFeature({ provider: 'a', prompt: longOk });
    assert.equal(out.prompt, longOk);
  });
  it('defaults and validates seconds without coercion', () => {
    assert.equal(runFeature({ provider: 'a', prompt: 'x' }).seconds, 8);
    assert.equal(runFeature({ provider: 'a', prompt: 'x', seconds: undefined }).seconds, 8);
    rejects({ provider: 'a', prompt: 'x', seconds: 0 });
    rejects({ provider: 'a', prompt: 'x', seconds: 121 });
    rejects({ provider: 'a', prompt: 'x', seconds: 1.5 });
    rejects({ provider: 'a', prompt: 'x', seconds: '8' });
    rejects({ provider: 'a', prompt: 'x', seconds: null });
    rejects({ provider: 'a', prompt: 'x', seconds: NaN });
    rejects({ provider: 'a', prompt: 'x', seconds: Infinity });
    rejects({ provider: 'a', prompt: 'x', seconds: true });
  });
  it('defaults and validates size strictly', () => {
    assert.equal(runFeature({ provider: 'a', prompt: 'x' }).size, '1280x720');
    assert.equal(runFeature({ provider: 'a', prompt: 'x', size: undefined }).size, '1280x720');
    rejects({ provider: 'a', prompt: 'x', size: ' 640x480' });
    rejects({ provider: 'a', prompt: 'x', size: '640x480\n' });
    rejects({ provider: 'a', prompt: 'x', size: '640' });
    rejects({ provider: 'a', prompt: 'x', size: '640x480x10' });
    rejects({ provider: 'a', prompt: 'x', size: 'axb480' });
    rejects({ provider: 'a', prompt: 'x', size: '63x64' });
    rejects({ provider: 'a', prompt: 'x', size: '5000x64' });
    rejects({ provider: 'a', prompt: 'x', size: '6x64' });
    rejects({ provider: 'a', prompt: 'x', size: '12345x64' });
    rejects({ provider: 'a', prompt: 'x', size: 42 });
  });
  it('returns fresh ordered object without input mutation', () => {
    const input = { provider: 'renderer-1', prompt: '  hello  ', seconds: 10, size: '640x480' };
    const before = JSON.stringify(input);
    const first = runFeature(input);
    const second = runFeature(input);
    assert.equal(JSON.stringify(input), before);
    assert.deepEqual(Object.keys(first), ['provider', 'prompt', 'seconds', 'size']);
    assert.deepEqual(first, second);
    assert.equal(first === second, false);
    assert.equal(first.prompt, 'hello');
  });
  it('is deterministic pure transform', () => {
    const payload = { provider: 'my-provider', prompt: 'A quiet forest' };
    const a = runFeature(payload);
    const b = runFeature({ provider: 'my-provider', prompt: 'A quiet forest' });
    assert.deepEqual(a, b);
    assert.deepEqual(a, { provider: 'my-provider', prompt: 'A quiet forest', seconds: 8, size: '1280x720' });
  });
});
