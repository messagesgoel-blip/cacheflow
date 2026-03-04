/**
 * Streaming pipeline with backpressure strategy.
 *
 * Gate: TRANSFER-1, ZERODISK-1
 * Task: 0.5@TRANSFER-1
 */

import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/ErrorCode';

export interface BackpressureConfig {
  highWatermark: number;
  lowWatermark: number;
}

export interface PipelineOptions {
  backpressure?: BackpressureConfig;
  onFlush?: () => void | Promise<void>;
}

export interface PipelineMetrics {
  buffered: number;
  processed: number;
  dropped: number;
  paused: boolean;
}

type DataHandler<T> = (data: T) => void | Promise<void>;
type ErrorHandler = (error: Error) => void | Promise<void>;
type EndHandler = () => void | Promise<void>;

export class StreamPipeline<T> {
  private buffer: T[] = [];
  private ended = false;
  private error: Error | null = null;
  private readonly config: Required<BackpressureConfig>;
  private readonly onFlush?: () => void | Promise<void>;

  private readonly onData: DataHandler<T>;
  private readonly onError: ErrorHandler;
  private readonly onEnd: EndHandler;

  private _paused = false;
  private metrics: PipelineMetrics = {
    buffered: 0,
    processed: 0,
    dropped: 0,
    paused: false,
  };

  constructor(
    handlers: {
      onData: DataHandler<T>;
      onError: ErrorHandler;
      onEnd: EndHandler;
    },
    options: PipelineOptions = {}
  ) {
    this.onData = handlers.onData;
    this.onError = handlers.onError;
    this.onEnd = handlers.onEnd;

    this.config = {
      highWatermark: options.backpressure?.highWatermark ?? 1000,
      lowWatermark: options.backpressure?.lowWatermark ?? 10,
    };

    this.onFlush = options.onFlush;
  }

  get paused(): boolean {
    return this._paused;
  }

  getMetrics(): PipelineMetrics {
    return { ...this.metrics };
  }

  async write(data: T): Promise<void> {
    if (this.ended) {
      return;
    }

    if (this._paused) {
      this.metrics.dropped++;
      return;
    }

    this.buffer.push(data);
    this.metrics.buffered = this.buffer.length;

    if (this.buffer.length >= this.config.highWatermark) {
      this._paused = true;
      this.metrics.paused = true;
      await this.drain();
    }
  }

  async flush(): Promise<void> {
    await this.drain();
  }

  private async drain(): Promise<void> {
    while (this.buffer.length > 0) {
      if (this._paused && this.buffer.length <= this.config.lowWatermark) {
        this._paused = false;
        this.metrics.paused = false;
        if (this.onFlush) {
          await this.onFlush();
        }
      }

      if (this._paused) {
        break;
      }

      const item = this.buffer.shift();
      if (item !== undefined) {
        try {
          await this.onData(item);
          this.metrics.processed++;
        } catch (err) {
          this.error = err instanceof Error ? err : new Error(String(err));
          await this.onError(this.error);
        }
      }
      this.metrics.buffered = this.buffer.length;
    }

    if (this.ended && this.buffer.length === 0) {
      await this.onEnd();
    }
  }

  async end(): Promise<void> {
    this.ended = true;
    await this.drain();

    if (this.buffer.length === 0) {
      await this.onEnd();
    }
  }

  async abort(err: Error): Promise<void> {
    this.error = err;
    this.ended = true;
    this.buffer = [];
    this.metrics.buffered = 0;
    await this.onError(err);
  }
}

export interface StreamPipelineFactoryOptions<T> extends PipelineOptions {
  onData: DataHandler<T>;
  onError?: ErrorHandler;
  onEnd?: EndHandler;
}

export function pipeline<T>(
  source: AsyncIterable<T>,
  options: StreamPipelineFactoryOptions<T>
): StreamPipeline<T> {
  const pipeline = new StreamPipeline<T>(
    {
      onData: options.onData,
      onError: options.onError ?? (() => {}),
      onEnd: options.onEnd ?? (() => {}),
    },
    options
  );

  (async () => {
    try {
      for await (const chunk of source) {
        await pipeline.write(chunk);
      }
      await pipeline.end();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      await pipeline.abort(error);
    }
  })();

  return pipeline;
}

export function createBackpressureConfig(
  highWatermark: number,
  ratio = 0.1
): BackpressureConfig {
  if (highWatermark <= 0) {
    throw new AppError({
      code: ErrorCode.VALIDATION_FAILED,
      message: 'highWatermark must be positive',
    });
  }

  const lowWatermark = Math.max(1, Math.floor(highWatermark * ratio));

  return { highWatermark, lowWatermark };
}
