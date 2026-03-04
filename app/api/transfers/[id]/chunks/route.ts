/**
 * Chunk State Endpoint
 *
 * Manages per-transfer chunk progress for auto-resume of interrupted uploads.
 *
 * GET  /api/transfers/[id]/chunks
 *   → Returns the resume state (committed chunks, nextChunkIndex, complete flag).
 *
 * POST /api/transfers/[id]/chunks
 *   → Registers the transfer on first call, or marks a specific chunk as done.
 *     When `chunkIndex` is omitted the call is treated as a registration-only
 *     request (client must supply fileSize, fileName, chunkSize).
 *
 * Gate: TRANSFER-1
 * Task: 3.6@TRANSFER-1
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { chunkStateManager, ChunkResumeState, ChunkStateRecord } from '../../../../lib/transfers/chunkStateManager';
import { AppError } from '../../../../lib/errors/AppError';
import { ErrorCode } from '../../../../lib/errors/ErrorCode';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JwtPayload {
  id: string;
  email?: string;
}

/** Successful GET response body. */
interface GetChunksResponse {
  success: true;
  transferId: string;
  fileName: string;
  fileSize: number;
  chunkSize: number;
  totalChunks: number;
  committedChunks: number[];
  nextChunkIndex: number;
  complete: boolean;
}

/** Request body for POST (register + optional chunk commit). */
interface PostChunksRequest {
  /** File name (required when registering a new transfer). */
  fileName?: string;
  /** Total file size in bytes (required when registering). */
  fileSize?: number;
  /** Chunk size in bytes (required when registering). */
  chunkSize?: number;
  /**
   * Index of the chunk that was just successfully committed.
   * Omit (or set to -1) for a registration-only call.
   */
  chunkIndex?: number;
}

/** Successful POST response body. */
interface PostChunksResponse {
  success: true;
  transferId: string;
  fileName: string;
  fileSize: number;
  chunkSize: number;
  totalChunks: number;
  committedChunks: number[];
  nextChunkIndex: number;
  complete: boolean;
}

/** Error response body (shared between GET and POST). */
interface ErrorResponse {
  success: false;
  error: string;
  code: string;
}

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

function extractUserId(accessToken: string): string | null {
  try {
    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET!) as JwtPayload;
    return decoded.id ?? null;
  } catch {
    return null;
  }
}

function unauthorized(): NextResponse<ErrorResponse> {
  return NextResponse.json(
    { success: false, error: 'Authentication required', code: ErrorCode.UNAUTHORIZED },
    { status: 401 },
  );
}

function badRequest(message: string): NextResponse<ErrorResponse> {
  return NextResponse.json(
    { success: false, error: message, code: ErrorCode.VALIDATION_FAILED },
    { status: 400 },
  );
}

function notFound(message: string): NextResponse<ErrorResponse> {
  return NextResponse.json(
    { success: false, error: message, code: ErrorCode.NOT_FOUND },
    { status: 404 },
  );
}

function forbidden(): NextResponse<ErrorResponse> {
  return NextResponse.json(
    { success: false, error: 'Access denied', code: ErrorCode.FORBIDDEN },
    { status: 403 },
  );
}

function internalError(message: string): NextResponse<ErrorResponse> {
  return NextResponse.json(
    { success: false, error: message, code: ErrorCode.INTERNAL_ERROR },
    { status: 500 },
  );
}

// ---------------------------------------------------------------------------
// Shared state-to-response mapper
// ---------------------------------------------------------------------------

function buildSuccessBody(
  state: ChunkResumeState,
): GetChunksResponse | PostChunksResponse {
  const { record, committedChunks, nextChunkIndex, complete } = state;
  return {
    success: true,
    transferId: record.transferId,
    fileName: record.fileName,
    fileSize: record.fileSize,
    chunkSize: record.chunkSize,
    totalChunks: record.totalChunks,
    committedChunks,
    nextChunkIndex,
    complete,
  };
}

// ---------------------------------------------------------------------------
// AppError → HTTP response
// ---------------------------------------------------------------------------

function appErrorResponse(err: AppError): NextResponse<ErrorResponse> {
  if (err.code === ErrorCode.NOT_FOUND) return notFound(err.message);
  if (err.code === ErrorCode.FORBIDDEN) return forbidden();
  if (err.code === ErrorCode.VALIDATION_FAILED) return badRequest(err.message);
  return internalError(err.message);
}

// ---------------------------------------------------------------------------
// GET /api/transfers/[id]/chunks
// ---------------------------------------------------------------------------

/**
 * Returns the current resume state for an interrupted upload.
 *
 * Response 200: GetChunksResponse
 * Response 400: transferId missing or malformed
 * Response 401: not authenticated
 * Response 403: transfer belongs to another user
 * Response 404: transfer not registered / state expired
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<GetChunksResponse | ErrorResponse>> {
  const { id: transferId } = await params;

  if (!transferId || typeof transferId !== 'string' || transferId.trim() === '') {
    return badRequest('Transfer ID is required');
  }

  const cookieStore = await cookies();
  const accessToken = cookieStore.get('accessToken')?.value;
  if (!accessToken) return unauthorized();

  const userId = extractUserId(accessToken);
  if (!userId) return unauthorized();

  try {
    const state = await chunkStateManager.getResumeState({ transferId, userId });
    return NextResponse.json(buildSuccessBody(state) as GetChunksResponse, { status: 200 });
  } catch (err) {
    if (AppError.isAppError(err)) return appErrorResponse(err);
    console.error('[chunks/GET] unexpected error', err);
    return internalError('Unexpected error querying chunk state');
  }
}

// ---------------------------------------------------------------------------
// POST /api/transfers/[id]/chunks
// ---------------------------------------------------------------------------

/**
 * Registers a new upload session and/or marks a chunk as committed.
 *
 * First call per transfer: supply fileName, fileSize, chunkSize.
 *   → Registers the transfer; chunkIndex may be omitted for a pure register.
 *
 * Subsequent calls: supply chunkIndex (>= 0) to mark that chunk as done.
 *   → fileName / fileSize / chunkSize are ignored if the session already exists.
 *
 * Response 200: PostChunksResponse (includes updated resume state)
 * Response 400: validation failure
 * Response 401: not authenticated
 * Response 403: transfer belongs to another user
 * Response 404: transfer not found (chunkIndex supplied but session not registered)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<PostChunksResponse | ErrorResponse>> {
  const { id: transferId } = await params;

  if (!transferId || typeof transferId !== 'string' || transferId.trim() === '') {
    return badRequest('Transfer ID is required');
  }

  const cookieStore = await cookies();
  const accessToken = cookieStore.get('accessToken')?.value;
  if (!accessToken) return unauthorized();

  const userId = extractUserId(accessToken);
  if (!userId) return unauthorized();

  let body: PostChunksRequest;
  try {
    body = (await request.json()) as PostChunksRequest;
  } catch {
    return badRequest('Request body must be valid JSON');
  }

  const { fileName, fileSize, chunkSize, chunkIndex } = body;

  // ---- Step 1: Register (or ensure registered) ----------------------------
  const isRegistrationRequest =
    fileName !== undefined && fileSize !== undefined && chunkSize !== undefined;

  if (isRegistrationRequest) {
    if (typeof fileName !== 'string' || fileName.trim() === '') {
      return badRequest('fileName must be a non-empty string');
    }
    if (typeof fileSize !== 'number' || fileSize <= 0 || !Number.isFinite(fileSize)) {
      return badRequest('fileSize must be a positive finite number');
    }
    if (typeof chunkSize !== 'number' || chunkSize <= 0 || !Number.isFinite(chunkSize)) {
      return badRequest('chunkSize must be a positive finite number');
    }

    try {
      await chunkStateManager.register({
        transferId,
        userId,
        fileName: fileName.trim(),
        fileSize,
        chunkSize,
      });
    } catch (err) {
      if (AppError.isAppError(err)) return appErrorResponse(err);
      console.error('[chunks/POST] register error', err);
      return internalError('Failed to register transfer');
    }
  }

  // ---- Step 2: Mark chunk done (if chunkIndex provided) -------------------
  const hasChunkIndex =
    chunkIndex !== undefined && chunkIndex !== null && chunkIndex !== -1;

  if (hasChunkIndex) {
    if (typeof chunkIndex !== 'number' || !Number.isInteger(chunkIndex) || chunkIndex < 0) {
      return badRequest('chunkIndex must be a non-negative integer');
    }

    try {
      const state = await chunkStateManager.markChunkDone({ transferId, userId, chunkIndex });
      return NextResponse.json(buildSuccessBody(state) as PostChunksResponse, { status: 200 });
    } catch (err) {
      if (AppError.isAppError(err)) return appErrorResponse(err);
      console.error('[chunks/POST] markChunkDone error', err);
      return internalError('Failed to record chunk completion');
    }
  }

  // ---- Registration-only path (no chunkIndex) -----------------------------
  if (isRegistrationRequest) {
    try {
      const state = await chunkStateManager.getResumeState({ transferId, userId });
      return NextResponse.json(buildSuccessBody(state) as PostChunksResponse, { status: 200 });
    } catch (err) {
      if (AppError.isAppError(err)) return appErrorResponse(err);
      console.error('[chunks/POST] getResumeState after register error', err);
      return internalError('Failed to read transfer state after registration');
    }
  }

  // Neither registration fields nor chunkIndex were supplied.
  return badRequest(
    'POST body must include either (fileName, fileSize, chunkSize) for registration, ' +
    'or chunkIndex to mark a chunk as complete, or both.',
  );
}
