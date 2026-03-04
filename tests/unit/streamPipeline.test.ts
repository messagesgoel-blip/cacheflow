/**
 * Unit tests for streamPipeline.
 *
 * Gate: TRANSFER-1, ZERODISK-1
 * Task: 0.5@TRANSFER-1
 */

import {
  StreamPipeline,
  pipeline,
  createBackpressureConfig,
} from '../../lib/transfers/streamPipeline';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests(): Promise<void> {
  console.log('Running streamPipeline tests...\n');

  console.log('Test: createBackpressureConfig - creates config with correct ratio');
  {
    const config = createBackpressureConfig(1000, 0.1);
    assert(config.highWatermark === 1000, 'highWatermark should be 1000');
    assert(config.lowWatermark === 100, 'lowWatermark should be 100');
  }
  console.log('  PASSED');

  console.log('Test: createBackpressureConfig - ensures lowWatermark is at least 1');
  {
    const config = createBackpressureConfig(5, 0.01);
    assert(config.lowWatermark >= 1, 'lowWatermark should be >= 1');
  }
  console.log('  PASSED');

  console.log('Test: createBackpressureConfig - throws on invalid highWatermark');
  {
    let threw = false;
    try {
      createBackpressureConfig(0);
    } catch {
      threw = true;
    }
    assert(threw, 'should throw for 0');
  }
  console.log('  PASSED');

  console.log('Test: StreamPipeline - processes data through onData handler');
  {
    const received: number[] = [];
    const p = new StreamPipeline<number>({
      onData: (n) => { received.push(n); },
      onError: () => {},
      onEnd: () => {},
    });

    await p.write(1);
    await p.write(2);
    await p.write(3);
    await p.flush();

    assert(received.length === 3, 'should receive 3 items');
    assert(received[0] === 1, 'first item should be 1');
    assert(received[1] === 2, 'second item should be 2');
    assert(received[2] === 3, 'third item should be 3');
  }
  console.log('  PASSED');

  console.log('Test: StreamPipeline - applies backpressure when buffer exceeds highWatermark');
  {
    const config = createBackpressureConfig(3, 0.5);
    const p = new StreamPipeline<number>(
      {
        onData: () => {},
        onError: () => {},
        onEnd: () => {},
      },
      { backpressure: config }
    );

    await p.write(1);
    console.log('  After write(1), paused:', p.paused, 'buffer:', p.getMetrics().buffered);
    await p.write(2);
    console.log('  After write(2), paused:', p.paused, 'buffer:', p.getMetrics().buffered);
    await p.write(3);
    console.log('  After write(3), paused:', p.paused, 'buffer:', p.getMetrics().buffered);
    await p.write(4);
    console.log('  After write(4), paused:', p.paused, 'buffer:', p.getMetrics().buffered);

    assert(p.paused === true, 'should be paused');
  }
  console.log('  PASSED');

  console.log('Test: StreamPipeline - tracks metrics correctly');
  {
    const p = new StreamPipeline<number>({
      onData: () => { return; },
      onError: () => {},
      onEnd: () => {},
    });

    await p.write(1);
    await p.write(2);
    await p.flush();

    const metrics = p.getMetrics();
    assert(metrics.processed === 2, 'should process 2 items');
    assert(metrics.dropped === 0, 'should have 0 dropped');
  }
  console.log('  PASSED');

  console.log('Test: StreamPipeline - drops data when paused');
  {
    const config = createBackpressureConfig(2, 0.5);
    const p = new StreamPipeline<number>(
      {
        onData: () => {},
        onError: () => {},
        onEnd: () => {},
      },
      { backpressure: config }
    );

    await p.write(1);
    await p.write(2);
    await p.write(3);

    assert(p.getMetrics().dropped === 1, 'should drop 1 item');
  }
  console.log('  PASSED');

  console.log('Test: StreamPipeline - calls onEnd when ended with empty buffer');
  {
    let ended = false;
    const p = new StreamPipeline<number>({
      onData: () => {},
      onError: () => {},
      onEnd: () => { ended = true; },
    });

    await p.end();
    assert(ended, 'onEnd should be called');
  }
  console.log('  PASSED');

  console.log('Test: StreamPipeline - calls onError on abort');
  {
    let errorReceived: Error | null = null;
    const p = new StreamPipeline<number>({
      onData: () => {},
      onError: (err) => { errorReceived = err; },
      onEnd: () => {},
    });

    const err = new Error('test error');
    await p.abort(err);

    assert(errorReceived !== null, 'error should be received');
    assert(errorReceived!.message === 'test error', 'error message should match');
  }
  console.log('  PASSED');

  console.log('Test: pipeline factory - creates pipeline from async iterable');
  {
    const received: number[] = [];
    const source = async function* () {
      yield 1;
      yield 2;
      yield 3;
    };

    pipeline(source(), {
      onData: (n) => { received.push(n); },
    });

    await new Promise((r) => setTimeout(r, 10));

    assert(received.length === 3, 'should receive 3 items');
  }
  console.log('  PASSED');

  console.log('Test: pipeline factory - handles errors from source');
  {
    let errorReceived: Error | null = null;
    const source = async function* () {
      yield 1;
      throw new Error('source error');
    };

    pipeline(source(), {
      onData: () => {},
      onError: (err) => { errorReceived = err; },
    });

    await new Promise((r) => setTimeout(r, 10));

    assert(errorReceived !== null, 'error should be received');
  }
  console.log('  PASSED');

  console.log('\nAll tests passed!');
}

runTests().catch((err) => {
  console.error('Tests failed:', err);
  process.exit(1);
});
