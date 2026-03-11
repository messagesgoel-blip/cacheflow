import { once } from 'events';
import { createThrottleStream } from '../../lib/transfers/streamTransfer';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function collectStream(stream: NodeJS.ReadWriteStream): Promise<Buffer[]> {
  const chunks: Buffer[] = [];
  stream.on('data', (chunk: Buffer) => {
    chunks.push(Buffer.from(chunk));
  });
  await once(stream, 'end');
  return chunks;
}

async function runTests(): Promise<void> {
  const unlimitedCases = [null, undefined, 0, -1];
  for (const value of unlimitedCases) {
    assert(createThrottleStream(value) === null, `expected ${String(value)} to disable throttle`);
  }

  {
    const throttle = createThrottleStream(1024);
    assert(throttle !== null, 'expected throttle stream for positive rate');
    throttle.destroy();
  }

  {
    const throttle = createThrottleStream(1024);
    if (!throttle) {
      throw new Error('expected throttle stream');
    }

    const received: Buffer[] = [];
    throttle.on('data', (chunk: Buffer) => {
      received.push(Buffer.from(chunk));
    });

    throttle.write(Buffer.alloc(3 * 1024));
    await wait(100);
    throttle.end();

    await wait(250);
    const receivedSoonAfterEnd = received.reduce((sum, chunk) => sum + chunk.length, 0);
    assert(
      receivedSoonAfterEnd < 3 * 1024,
      `expected queued bytes to remain throttled after end(), got ${receivedSoonAfterEnd}`,
    );

    const completed = once(throttle, 'end');
    await completed;
    const total = received.reduce((sum, chunk) => sum + chunk.length, 0);
    assert(total === 3 * 1024, `expected exact byte count after drain, got ${total}`);
  }

  {
    const throttle = createThrottleStream(1024);
    if (!throttle) {
      throw new Error('expected throttle stream');
    }

    const received: Buffer[] = [];
    throttle.on('data', (chunk: Buffer) => {
      received.push(Buffer.from(chunk));
    });

    const completed = once(throttle, 'end');
    throttle.end(Buffer.alloc(4 * 1024));

    await wait(1400);
    const partial = received.reduce((sum, chunk) => sum + chunk.length, 0);
    assert(partial < 4 * 1024, `stream should not finish early for oversized chunk, got ${partial}`);

    await completed;
    const allChunks = received;
    const total = allChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    assert(total === 4 * 1024, `expected full 4KB output, got ${total}`);
    assert(allChunks.length > 1, `expected oversized chunk to be split, got ${allChunks.length} chunk(s)`);
  }

  {
    const throttle = createThrottleStream(2048);
    if (!throttle) {
      throw new Error('expected throttle stream');
    }

    const input = Buffer.alloc(5 * 1024, 7);
    const chunksPromise = collectStream(throttle);
    throttle.end(input);
    const chunks = await chunksPromise;
    const output = Buffer.concat(chunks);
    assert(output.equals(input), 'expected output bytes to match input exactly');
  }

  console.log('throttleStream tests passed');
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
