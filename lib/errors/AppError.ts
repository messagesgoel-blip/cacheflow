/**
 * Structured application error wrapper used across API routes,
 * workers, and shared business logic.
 *
 * Gate: AUTH-1, TRANSFER-1
 * Task: 0.2@TRANSFER-1
 */

import {
  ErrorCode,
  ErrorCategory,
  getDefaultErrorMessage,
  getDefaultHttpStatus,
  getErrorCategory,
} from './ErrorCode';

export interface AppErrorOptions {
  code: ErrorCode;
  message?: string;
  statusCode?: number;
  retryable?: boolean;
  details?: Record<string, unknown>;
  cause?: unknown;
}

export interface SerializedAppError {
  code: ErrorCode;
  category: ErrorCategory;
  message: string;
  statusCode: number;
  retryable: boolean;
  details?: Record<string, unknown>;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly category: ErrorCategory;
  readonly statusCode: number;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;
  readonly cause?: unknown;

  constructor(options: AppErrorOptions) {
    const message = options.message ?? getDefaultErrorMessage(options.code);

    super(message);

    this.name = 'AppError';
    this.code = options.code;
    this.category = getErrorCategory(options.code);
    this.statusCode = options.statusCode ?? getDefaultHttpStatus(options.code);
    this.retryable = options.retryable ?? false;
    this.details = options.details;
    this.cause = options.cause;

    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): SerializedAppError {
    return {
      code: this.code,
      category: this.category,
      message: this.message,
      statusCode: this.statusCode,
      retryable: this.retryable,
      details: this.details,
    };
  }

  static isAppError(error: unknown): error is AppError {
    return error instanceof AppError;
  }

  static fromUnknown(error: unknown, fallbackCode = ErrorCode.UNKNOWN): AppError {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof Error) {
      return new AppError({
        code: fallbackCode,
        message: error.message,
        cause: error,
      });
    }

    return new AppError({
      code: fallbackCode,
      message: getDefaultErrorMessage(fallbackCode),
      details: { raw: error },
    });
  }
}
