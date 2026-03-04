/**
 * POST /api/connections/vps
 *
 * Gate: SEC-1
 * Task: 4.5
 *
 * Accepts VPS (SFTP) or WebDAV credentials, encrypts them with AES-256-GCM
 * via CredentialVault, and persists them in `user_remotes.access_token_enc`.
 *
 * SEC-1 constraints:
 *   - Plaintext credentials are never logged, never included in responses.
 *   - Encryption fails loudly if TOKEN_ENCRYPTION_KEY is absent.
 *   - Response shape contains no credential fields — only opaque identifiers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import dbPool from '../../../../../api/src/db/client'; // Using existing DB client
import {
  getCredentialVault,
  type VPSCredentialPayload,
  type WebDAVCredentialPayload,
  type CredentialPayload,
} from '../../../../lib/vault/credentialVault';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JWTPayload {
  id: string;
  email?: string;
}

interface VPSConnectionRequest {
  kind: 'vps';
  host: string;
  port?: number;
  username: string;
  authType: 'password' | 'key';
  password?: string;
  privateKey?: string;
  passphrase?: string;
  rootPath?: string;
  accountLabel?: string;
}

interface WebDAVConnectionRequest {
  kind: 'webdav';
  url: string;
  username: string;
  password: string;
  basePath?: string;
  accountLabel?: string;
}

type ConnectionRequest = VPSConnectionRequest | WebDAVConnectionRequest;

interface ConnectionSuccessResponse {
  success: true;
  remoteId: string;
  provider: string;
  accountKey: string;
  displayName: string;
}

interface ConnectionErrorResponse {
  success: false;
  error: string;
  code: string;
}

type ConnectionResponse = ConnectionSuccessResponse | ConnectionErrorResponse;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------



function errorResponse(
  error: string,
  code: string,
  status: number
): NextResponse<ConnectionErrorResponse> {
  return NextResponse.json({ success: false, error, code }, { status });
}

async function resolveUserId(request: NextRequest): Promise<string | null> {
  const cookieStore = await cookies();
  const token =
    cookieStore.get('accessToken')?.value ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  if (!token) return null;

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;
    const payload = jwt.verify(token, secret) as JWTPayload;
    return payload.id ?? null;
  } catch {
    return null;
  }
}

function buildAccountKey(payload: CredentialPayload): string {
  if (payload.kind === 'vps') {
    return `${payload.host}:${payload.port}:${payload.username}`;
  }
  return `${payload.url}:${payload.username}`;
}

function buildDisplayName(payload: CredentialPayload): string {
  if (payload.kind === 'vps') {
    return `${payload.username}@${payload.host}:${payload.port}`;
  }
  return `${payload.username}@${payload.url}`;
}

function parseVPSPayload(body: VPSConnectionRequest): VPSCredentialPayload {
  return {
    kind: 'vps',
    host: body.host,
    port: body.port ?? 22,
    username: body.username,
    authType: body.authType,
    password: body.authType === 'password' ? body.password : undefined,
    privateKey: body.authType === 'key' ? body.privateKey : undefined,
    passphrase: body.passphrase,
    rootPath: body.rootPath ?? '/',
  };
}

function parseWebDAVPayload(body: WebDAVConnectionRequest): WebDAVCredentialPayload {
  return {
    kind: 'webdav',
    url: body.url,
    username: body.username,
    password: body.password,
    basePath: body.basePath,
  };
}

function validateVPS(body: VPSConnectionRequest): string | null {
  if (!body.host?.trim()) return 'host is required';
  if (!body.username?.trim()) return 'username is required';
  if (body.authType !== 'password' && body.authType !== 'key') {
    return "authType must be 'password' or 'key'";
  }
  if (body.authType === 'password' && !body.password) {
    return 'password is required when authType is password';
  }
  if (body.authType === 'key' && !body.privateKey) {
    return 'privateKey is required when authType is key';
  }
  if (body.port !== undefined && (body.port < 1 || body.port > 65535)) {
    return 'port must be between 1 and 65535';
  }
  return null;
}

function validateWebDAV(body: WebDAVConnectionRequest): string | null {
  if (!body.url?.trim()) return 'url is required';
  if (!body.username?.trim()) return 'username is required';
  if (!body.password) return 'password is required';
  try {
    new URL(body.url);
  } catch {
    return 'url must be a valid URL';
  }
  return null;
}

// ---------------------------------------------------------------------------
// POST /api/connections/vps
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest
): Promise<NextResponse<ConnectionResponse>> {
  const userId = await resolveUserId(request);
  if (!userId) {
    return errorResponse('Authentication required', 'UNAUTHORIZED', 401);
  }

  let body: ConnectionRequest;
  try {
    body = (await request.json()) as ConnectionRequest;
  } catch {
    return errorResponse('Invalid JSON body', 'VALIDATION_FAILED', 400);
  }

  if (!body.kind || (body.kind !== 'vps' && body.kind !== 'webdav')) {
    return errorResponse(
      "kind must be 'vps' or 'webdav'",
      'VALIDATION_FAILED',
      400
    );
  }

  // Validate shape
  let validationError: string | null;
  if (body.kind === 'vps') {
    validationError = validateVPS(body as VPSConnectionRequest);
  } else {
    validationError = validateWebDAV(body as WebDAVConnectionRequest);
  }
  if (validationError) {
    return errorResponse(validationError, 'VALIDATION_FAILED', 400);
  }

  // Build credential payload (no plaintext leaves this block)
  const payload: CredentialPayload =
    body.kind === 'vps'
      ? parseVPSPayload(body as VPSConnectionRequest)
      : parseWebDAVPayload(body as WebDAVConnectionRequest);

  // Encrypt — throws if TOKEN_ENCRYPTION_KEY is absent (SEC-1)
  let encryptedCredential: string;
  try {
    encryptedCredential = getCredentialVault().encrypt(payload);
  } catch (err) {
    console.error('[connections/vps] Encryption failed:', (err as Error).message);
    return errorResponse(
      'Credential encryption failed. Check server configuration.',
      'INTERNAL_ERROR',
      500
    );
  }

  const provider = body.kind;
  const accountKey = buildAccountKey(payload);
  const displayName = buildDisplayName(payload);
  const accountLabel =
    (body as VPSConnectionRequest | WebDAVConnectionRequest).accountLabel?.trim() ||
    'Primary';

  // Upsert into user_remotes using raw SQL
  try {
    // First check if record exists
    const existingResult = await dbPool.query(
      'SELECT id FROM user_remotes WHERE user_id = $1 AND provider = $2 AND account_key = $3',
      [userId, provider, accountKey]
    );

    let record;
    if (existingResult.rows.length > 0) {
      // Update existing record
      const updateResult = await dbPool.query(
        `UPDATE user_remotes 
         SET access_token_enc = $1, display_name = $2, key_version = $3, disabled = $4, updated_at = NOW()
         WHERE user_id = $5 AND provider = $6 AND account_key = $7
         RETURNING id, provider, account_key, display_name`,
        [encryptedCredential, displayName, String(1), false, userId, provider, accountKey]
      );
      record = updateResult.rows[0];
    } else {
      // Insert new record
      const insertResult = await dbPool.query(
        `INSERT INTO user_remotes (user_id, provider, account_key, account_id, account_email, display_name, access_token_enc, refresh_token_enc, expires_at, disabled, key_version, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
         RETURNING id, provider, account_key, display_name`,
        [
          userId,
          provider,
          accountKey,
          null, // account_id
          null, // account_email
          displayName,
          encryptedCredential,
          null, // refresh_token_enc
          null, // expires_at
          false, // disabled
          String(1) // key_version
        ]
      );
      record = insertResult.rows[0];
    }

    return NextResponse.json<ConnectionSuccessResponse>(
      {
        success: true,
        remoteId: record.id,
        provider: record.provider,
        accountKey: record.account_key,
        displayName: record.display_name ?? displayName,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('[connections/vps] DB upsert failed:', (err as Error).message);
    return errorResponse(
      'Failed to persist connection. Please try again.',
      'INTERNAL_ERROR',
      500
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/connections/vps
// ---------------------------------------------------------------------------

export async function DELETE(
  request: NextRequest
): Promise<NextResponse<{ success: boolean; error?: string; code?: string }>> {
  const userId = await resolveUserId(request);
  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'Authentication required', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  const remoteId = request.nextUrl.searchParams.get('remoteId');
  if (!remoteId) {
    return NextResponse.json(
      { success: false, error: 'remoteId query parameter is required', code: 'VALIDATION_FAILED' },
      { status: 400 }
    );
  }

  try {
    // Check if the remote exists and belongs to the user
    const existingResult = await dbPool.query(
      'SELECT id FROM user_remotes WHERE id = $1 AND user_id = $2 AND provider IN ($3, $4)',
      [remoteId, userId, 'vps', 'webdav']
    );

    if (existingResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Connection not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    await dbPool.query('DELETE FROM user_remotes WHERE id = $1', [remoteId]);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('[connections/vps] DELETE failed:', (err as Error).message);
    return NextResponse.json(
      { success: false, error: 'Failed to remove connection', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
