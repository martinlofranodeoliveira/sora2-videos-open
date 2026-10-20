import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VideoJobs } from '../src/index.js';

function createJobs() {
  let calls = 0;
  const jobs = new VideoJobs();
  jobs.register('synthetic', async () => {
    calls += 1;
    return { outputId: 'synthetic-output' };
  }, { startsPerMinute: 10, maxConcurrent: 2 });
  return { jobs, getCalls: () => calls };
}

function assertMalformed(size) {
  const { jobs, getCalls } = createJobs();
  assert.throws(() => {
    jobs.submit({ provider: 'synthetic', prompt: 'A quiet forest', seconds: 8, size });
  }, TypeError);
  assert.equal(jobs.list().length, 0, `list must stay empty for ${String(size)}`);
  assert.equal(getCalls(), 0, 'adapter must not be called for malformed size');
}

describe('strict size input', () => {
  it('accepts valid ASCII sizes within 64-4096', async () => {
    for (const size of ['64x64', '1280x720', '1920x1080', '64x4096', '4096x4096', '0064x0064']) {
      const { jobs, getCalls } = createJobs();
      const operation = jobs.submit({ provider: 'synthetic', prompt: 'A quiet forest', seconds: 8, size });
      const completed = await operation.done;
      assert.equal(completed.status, 'completed');
      assert.equal(completed.spec.size, size);
      assert.equal(jobs.list().length, 1);
      assert.equal(getCalls(), 1);
    }
  });

  it('rejects whitespace and line terminators', () => {
    for (const size of [
      ' 1280x720',
      '1280x720 ',
      ' 1280x720 ',
      '\t1280x720',
      '1280x720\t',
      '1280 x720',
      '1280x 720',
      '1280\nx720',
      '1280x720\n',
      '1280x720\r',
      '1280x720\r\n',
      '1280x720\u2028',
      '1280x720\u2029',
      '\n1280x720',
      '1280x720\u000B',
    ]) {
      assertMalformed(size);
    }
  });

  it('rejects coercion without creating a record', () => {
    const coerced = [
      { toString: () => '1280x720' },
      { valueOf: () => '1280x720' },
      ['1280x720'],
      17280,
      null,
      {},
      true,
    ];
    for (const size of coerced) {
      assertMalformed(size);
    }
    // Boxed String object must also be rejected as non-primitive.
    assertMalformed(new String('1280x720'));
    // Full-width Unicode digits are not ASCII WIDTHxHEIGHT.
    assertMalformed('\uFF11\uFF12\uFF18\uFF10x720');
    // Malformed shapes.
    for (const size of ['', 'x', '1280', '1280x', 'x720', '1280xx720', '1280x720x10', '1x1', '12345x10', 'axb xc']) {
      assertMalformed(size);
    }
  });

  it('preserves 64-4096 bounds with TypeError and empty list', () => {
    for (const size of ['63x64', '64x63', '4097x64', '64x4097', '00x00', '01x01']) {
      const { jobs, getCalls } = createJobs();
      assert.throws(() => {
        jobs.submit({ provider: 'synthetic', prompt: 'A quiet forest', seconds: 8, size });
      }, TypeError);
      assert.equal(jobs.list().length, 0);
      assert.equal(getCalls(), 0);
    }
  });

  it('keeps queue limits and shutdown behavior', async () => {
    const { jobs } = createJobs();
    assertMalformed.call(null, '1280x720\n');
    const operation = jobs.submit({ provider: 'synthetic', prompt: 'A quiet forest', seconds: 8, size: '1280x720' });
    const completed = await operation.done;
    assert.equal(completed.status, 'completed');
    assert.equal(jobs.shutdown('synthetic'), true);
    assert.equal(jobs.shutdown('synthetic'), false);
    assert.throws(() => {
      jobs.submit({ provider: 'synthetic', prompt: 'late', seconds: 8, size: '640x480' });
    }, (error) => error.code === 'QUEUE_SHUTDOWN');
  });
});
