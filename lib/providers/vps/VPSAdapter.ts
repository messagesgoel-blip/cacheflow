import { Readable } from 'stream';
import { AppError } from '../../errors/AppError';
import { ErrorCode } from '../../errors/ErrorCode';
import type { ProviderAdapter } from '../ProviderAdapter.interface';
import type {
  AbortResumableUploadRequest,
  ConnectRequest,
  ConnectResponse,
  CopyFileRequest,
  CopyFileResponse,
  CreateFolderRequest,
  CreateFolderResponse,
  CreateResumableUploadRequest,
  CreateResumableUploadResponse,
  CreateShareLinkRequest,
  CreateShareLinkResponse,
  DeleteFileRequest,
  DisconnectRequest,
  DownloadStreamRequest,
  DownloadStreamResponse,
  FinalizeResumableUploadRequest,
  FinalizeResumableUploadResponse,
  GetFileRequest,
  GetFileResponse,
  GetQuotaRequest,
  GetQuotaResponse,
  GetResumableUploadStatusRequest,
  GetResumableUploadStatusResponse,
  ListFilesRequest,
  ListFilesResponse,
  MoveFileRequest,
  MoveFileResponse,
  ProviderDescriptor,
  ProviderFile,
  RefreshAuthRequest,
  RefreshAuthResponse,
  RenameFileRequest,
  RenameFileResponse,
  ResumableUploadSession,
  RevokeShareLinkRequest,
  SearchFilesRequest,
  SearchFilesResponse,
  UploadResumableChunkRequest,
  UploadResumableChunkResponse,
  UploadStreamRequest,
  UploadStreamResponse,
  ValidateAuthRequest,
  ValidateAuthResponse,
} from '../types';
import {
  type SSHAuthConfig,
  type ManagedSSHSession,
  sshConnectionManager,
} from './sshConnectionManager';

// ---------------------------------------------------------------------------
// Descriptor
// ---------------------------------------------------------------------------

export const vpsDescriptor: ProviderDescriptor = {
  id: 'vps',
  displayName: 'VPS / SFTP',
  authType: 'basic',
  capabilities: {
    supportsAuthRefresh: false,
    supportsSearch: true,
    supportsShareLinks: false,
    supportsResumableUpload: true,
    supportsChunkResume: true,
    supportsStreamingTransfer: true,
    supportsServerSideCopy: false,
  },
};

// ---------------------------------------------------------------------------
// Auth-state field names
// Stored in ProviderAuthState.accessToken as a base64-encoded JSON blob so
// that the existing auth pipeline does not need modification.
// ---------------------------------------------------------------------------

interface VPSCredentials {
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key';
  password?: string;
  privateKey?: string;
  passphrase?: string;
  rootPath: string;
}

function encodeCredentials(creds: VPSCredentials): string {
  return Buffer.from(JSON.stringify(creds)).toString('base64');
}

function decodeCredentials(token: string): VPSCredentials {
  try {
    return JSON.parse(Buffer.from(token, 'base64').toString('utf8')) as VPSCredentials;
  } catch {
    throw new AppError({
      code: ErrorCode.UNAUTHORIZED,
      message: 'VPS auth token is malformed.',
      retryable: false,
    });
  }
}

function credentialsToSSHAuthConfig(accountId: string, creds: VPSCredentials): SSHAuthConfig {
  return {
    id: accountId,
    host: creds.host,
    port: creds.port,
    username: creds.username,
    password: creds.authType === 'password' ? creds.password : undefined,
    privateKey: creds.authType === 'key' ? creds.privateKey : undefined,
    passphrase: creds.passphrase,
  };
}

// ---------------------------------------------------------------------------
// SFTP helpers
// These wrap ssh2's callback-based SFTP API into Promises.
// ---------------------------------------------------------------------------

type SFTPWrapper = import('ssh2').SFTPWrapper;
type FileEntry = import('ssh2').FileEntry;

function openSFTP(session: ManagedSSHSession): Promise<SFTPWrapper> {
  return new Promise<SFTPWrapper>((resolve, reject) => {
    session.client.sftp((err, sftp) => {
      if (err) {
        reject(new AppError({
          code: ErrorCode.PROVIDER_UNAVAILABLE,
          message: `Failed to open SFTP subsystem: ${err.message}`,
          retryable: true,
          cause: err,
        }));
      } else {
        resolve(sftp);
      }
    });
  });
}

function sftpReaddir(sftp: SFTPWrapper, remotePath: string): Promise<FileEntry[]> {
  return new Promise<FileEntry[]>((resolve, reject) => {
    sftp.readdir(remotePath, (err, list) => {
      if (err) {
        reject(mapSFTPError(err, remotePath));
      } else {
        resolve(list);
      }
    });
  });
}

function sftpStat(sftp: SFTPWrapper, remotePath: string): Promise<import('ssh2').Stats> {
  return new Promise((resolve, reject) => {
    sftp.stat(remotePath, (err, stats) => {
      if (err) {
        reject(mapSFTPError(err, remotePath));
      } else {
        resolve(stats);
      }
    });
  });
}

function sftpMkdir(sftp: SFTPWrapper, remotePath: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    sftp.mkdir(remotePath, (err) => {
      if (err) {
        reject(mapSFTPError(err, remotePath));
      } else {
        resolve();
      }
    });
  });
}

function sftpRename(sftp: SFTPWrapper, oldPath: string, newPath: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    sftp.rename(oldPath, newPath, (err) => {
      if (err) {
        reject(mapSFTPError(err, oldPath));
      } else {
        resolve();
      }
    });
  });
}

function sftpUnlink(sftp: SFTPWrapper, remotePath: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    sftp.unlink(remotePath, (err) => {
      if (err) {
        reject(mapSFTPError(err, remotePath));
      } else {
        resolve();
      }
    });
  });
}

function sftpRmdir(sftp: SFTPWrapper, remotePath: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    sftp.rmdir(remotePath, (err) => {
      if (err) {
        reject(mapSFTPError(err, remotePath));
      } else {
        resolve();
      }
    });
  });
}

function sftpCreateReadStream(sftp: SFTPWrapper, remotePath: string, start?: number, end?: number): Readable {
  const options: Record<string, unknown> = {};
  if (start !== undefined) options['start'] = start;
  if (end !== undefined) options['end'] = end;
  return sftp.createReadStream(remotePath, options) as unknown as Readable;
}

function sftpCreateWriteStream(sftp: SFTPWrapper, remotePath: string): NodeJS.WritableStream {
  return sftp.createWriteStream(remotePath) as unknown as NodeJS.WritableStream;
}

function sftpAppendStream(sftp: SFTPWrapper, remotePath: string, offset: number): NodeJS.WritableStream {
  return sftp.createWriteStream(remotePath, { flags: 'r+', start: offset }) as unknown as NodeJS.WritableStream;
}

function mapSFTPError(err: Error & { code?: number }, path: string): AppError {
  const NO_SUCH_FILE = 2;
  const PERMISSION_DENIED = 3;
  const FILE_EXISTS = 4;

  const code = typeof err.code === 'number' ? err.code : -1;

  if (code === NO_SUCH_FILE) {
    return new AppError({ code: ErrorCode.NOT_FOUND, message: `Not found: ${path}`, retryable: false, cause: err });
  }
  if (code === PERMISSION_DENIED) {
    return new AppError({ code: ErrorCode.FORBIDDEN, message: `Permission denied: ${path}`, retryable: false, cause: err });
  }
  if (code === FILE_EXISTS) {
    return new AppError({ code: ErrorCode.CONFLICT, message: `Already exists: ${path}`, retryable: false, cause: err });
  }
  return new AppError({ code: ErrorCode.TRANSFER_FAILED, message: err.message, retryable: true, cause: err });
}

// ---------------------------------------------------------------------------
// File metadata helpers
// ---------------------------------------------------------------------------

function fileEntryToProviderFile(entry: FileEntry, dir: string): ProviderFile {
  const fullPath = dir === '/' ? `/${entry.filename}` : `${dir}/${entry.filename}`;
  const isFolder = (entry.attrs.mode & 0o170000) === 0o040000;
  return {
    id: fullPath,
    name: entry.filename,
    isFolder,
    size: entry.attrs.size ?? 0,
    path: fullPath,
    modifiedAt: entry.attrs.mtime !== undefined
      ? new Date(entry.attrs.mtime * 1000).toISOString()
      : undefined,
  };
}

function statsToProviderFile(stats: import('ssh2').Stats, path: string): ProviderFile {
  const name = path.split('/').pop() ?? path;
  return {
    id: path,
    name,
    isFolder: stats.isDirectory(),
    size: stats.size ?? 0,
    path,
    modifiedAt: stats.mtime !== undefined
      ? new Date(stats.mtime * 1000).toISOString()
      : undefined,
  };
}

function normalizePath(rootPath: string, folderId?: string): string {
  if (folderId) return folderId;
  return rootPath || '/';
}

// ---------------------------------------------------------------------------
// Resumable upload session storage (in-process; sufficient for task scope)
// ---------------------------------------------------------------------------

interface VPSResumableSession {
  sessionId: string;
  remotePath: string;
  contentLength: number;
  chunkSize: number;
  nextOffset: number;
  expiresAt: string;
}

const resumableSessions = new Map<string, VPSResumableSession>();

// ---------------------------------------------------------------------------
// VPSAdapter
// ---------------------------------------------------------------------------

export class VPSAdapter implements ProviderAdapter {
  readonly descriptor: ProviderDescriptor = vpsDescriptor;

  // -------------------------------------------------------------------------
  // Auth lifecycle
  // -------------------------------------------------------------------------

  async connect(request: ConnectRequest): Promise<ConnectResponse> {
    const { context } = request;

    if (!request.code) {
      throw new AppError({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'VPS connect requires credentials encoded in request.code.',
        retryable: false,
        details: { requestId: context.requestId },
      });
    }

    const creds = decodeCredentials(request.code);
    const accountId = `${context.userId}:${creds.host}:${creds.port}:${creds.username}`;
    const sshConfig = credentialsToSSHAuthConfig(accountId, creds);

    let session: ManagedSSHSession | null = null;
    try {
      session = await sshConnectionManager.acquire(sshConfig);
    } catch (err) {
      throw AppError.fromUnknown(err, ErrorCode.UNAUTHORIZED);
    } finally {
      if (session) sshConnectionManager.release(session.id);
    }

    return {
      account: {
        accountId,
        displayName: `${creds.username}@${creds.host}`,
        email: undefined,
      },
      auth: {
        accountId,
        accessToken: encodeCredentials(creds),
        expiresAt: undefined,
      },
    };
  }

  async refreshAuth(request: RefreshAuthRequest): Promise<RefreshAuthResponse> {
    throw new AppError({
      code: ErrorCode.REFRESH_FAILED,
      message: 'VPS SSH credentials do not expire and do not support token refresh.',
      retryable: false,
      details: { requestId: request.context.requestId },
    });
  }

  async disconnect(request: DisconnectRequest): Promise<void> {
    sshConnectionManager.destroy(request.auth.accountId);
  }

  async validateAuth(request: ValidateAuthRequest): Promise<ValidateAuthResponse> {
    let creds: VPSCredentials;
    try {
      creds = decodeCredentials(request.auth.accessToken);
    } catch {
      return { valid: false, reason: 'revoked' };
    }
    const sshConfig = credentialsToSSHAuthConfig(request.auth.accountId, creds);

    let session: ManagedSSHSession | null = null;
    try {
      session = await sshConnectionManager.acquire(sshConfig);
      const sftp = await openSFTP(session);
      await sftpStat(sftp, creds.rootPath || '/');
      sftp.end();
      return { valid: true };
    } catch (err) {
      const appErr = AppError.fromUnknown(err, ErrorCode.UNAUTHORIZED);
      return {
        valid: false,
        reason: appErr.code === ErrorCode.UNAUTHORIZED ? 'revoked' : 'unknown',
      };
    } finally {
      if (session) sshConnectionManager.release(session.id);
    }
  }

  // -------------------------------------------------------------------------
  // Quota
  // -------------------------------------------------------------------------

  async getQuota(request: GetQuotaRequest): Promise<GetQuotaResponse> {
    const creds = decodeCredentials(request.auth.accessToken);
    const sshConfig = credentialsToSSHAuthConfig(request.auth.accountId, creds);

    const session = await sshConnectionManager.acquire(sshConfig);
    try {
      const output = await execCommand(session, `df -Pk ${creds.rootPath || '/'} | tail -1`);
      const parts = output.trim().split(/\s+/);
      const total = parseInt(parts[1] ?? '0', 10) * 1024;
      const used = parseInt(parts[2] ?? '0', 10) * 1024;
      const free = parseInt(parts[3] ?? '0', 10) * 1024;
      return { quota: { usedBytes: used, totalBytes: total, freeBytes: free } };
    } catch (err) {
      throw AppError.fromUnknown(err, ErrorCode.PROVIDER_UNAVAILABLE);
    } finally {
      sshConnectionManager.release(session.id);
    }
  }

  // -------------------------------------------------------------------------
  // File discovery
  // -------------------------------------------------------------------------

  async listFiles(request: ListFilesRequest): Promise<ListFilesResponse> {
    const creds = decodeCredentials(request.auth.accessToken);
    const dir = normalizePath(creds.rootPath, request.folderId);
    const sshConfig = credentialsToSSHAuthConfig(request.auth.accountId, creds);

    const session = await sshConnectionManager.acquire(sshConfig);
    try {
      const sftp = await openSFTP(session);
      const entries = await sftpReaddir(sftp, dir);
      sftp.end();

      const files: ProviderFile[] = entries.map((e) => fileEntryToProviderFile(e, dir));

      return { files, hasMore: false };
    } catch (err) {
      throw AppError.fromUnknown(err, ErrorCode.TRANSFER_FAILED);
    } finally {
      sshConnectionManager.release(session.id);
    }
  }

  async searchFiles(request: SearchFilesRequest): Promise<SearchFilesResponse> {
    const creds = decodeCredentials(request.auth.accessToken);
    const dir = normalizePath(creds.rootPath, request.folderId);
    const sshConfig = credentialsToSSHAuthConfig(request.auth.accountId, creds);

    const session = await sshConnectionManager.acquire(sshConfig);
    try {
      const safeQuery = request.query.replace(/'/g, "'\\''");
      const safeDir = dir.replace(/'/g, "'\\''");
      const output = await execCommand(
        session,
        `find '${safeDir}' -maxdepth 5 -name '*${safeQuery}*' -not -path '*/.*' 2>/dev/null | head -100`,
      );

      const paths = output.trim().split('\n').filter(Boolean);
      const files: ProviderFile[] = paths.map((p) => ({
        id: p,
        name: p.split('/').pop() ?? p,
        isFolder: false,
        size: 0,
        path: p,
      }));

      return { files, hasMore: false };
    } catch (err) {
      throw AppError.fromUnknown(err, ErrorCode.TRANSFER_FAILED);
    } finally {
      sshConnectionManager.release(session.id);
    }
  }

  async getFile(request: GetFileRequest): Promise<GetFileResponse> {
    const creds = decodeCredentials(request.auth.accessToken);
    const sshConfig = credentialsToSSHAuthConfig(request.auth.accountId, creds);

    const session = await sshConnectionManager.acquire(sshConfig);
    try {
      const sftp = await openSFTP(session);
      const stats = await sftpStat(sftp, request.fileId);
      sftp.end();
      return { file: statsToProviderFile(stats, request.fileId) };
    } catch (err) {
      throw AppError.fromUnknown(err, ErrorCode.NOT_FOUND);
    } finally {
      sshConnectionManager.release(session.id);
    }
  }

  // -------------------------------------------------------------------------
  // File mutation
  // -------------------------------------------------------------------------

  async createFolder(request: CreateFolderRequest): Promise<CreateFolderResponse> {
    const creds = decodeCredentials(request.auth.accessToken);
    const parent = normalizePath(creds.rootPath, request.parentId);
    const targetPath = parent === '/' ? `/${request.name}` : `${parent}/${request.name}`;
    const sshConfig = credentialsToSSHAuthConfig(request.auth.accountId, creds);

    const session = await sshConnectionManager.acquire(sshConfig);
    try {
      const sftp = await openSFTP(session);
      await sftpMkdir(sftp, targetPath);
      sftp.end();
      return {
        folder: { id: targetPath, name: request.name, isFolder: true, size: 0, path: targetPath },
      };
    } catch (err) {
      throw AppError.fromUnknown(err, ErrorCode.TRANSFER_FAILED);
    } finally {
      sshConnectionManager.release(session.id);
    }
  }

  async moveFile(request: MoveFileRequest): Promise<MoveFileResponse> {
    const creds = decodeCredentials(request.auth.accessToken);
    const name = request.newName ?? (request.fileId.split('/').pop() ?? request.fileId);
    const parent = normalizePath(creds.rootPath, request.newParentId);
    const newPath = parent === '/' ? `/${name}` : `${parent}/${name}`;
    const sshConfig = credentialsToSSHAuthConfig(request.auth.accountId, creds);

    const session = await sshConnectionManager.acquire(sshConfig);
    try {
      const sftp = await openSFTP(session);
      await sftpRename(sftp, request.fileId, newPath);
      const stats = await sftpStat(sftp, newPath);
      sftp.end();
      return { file: statsToProviderFile(stats, newPath) };
    } catch (err) {
      throw AppError.fromUnknown(err, ErrorCode.TRANSFER_FAILED);
    } finally {
      sshConnectionManager.release(session.id);
    }
  }

  async copyFile(request: CopyFileRequest): Promise<CopyFileResponse> {
    const creds = decodeCredentials(request.auth.accessToken);
    const name = request.newName ?? (request.fileId.split('/').pop() ?? request.fileId);
    const parent = normalizePath(creds.rootPath, request.newParentId);
    const newPath = parent === '/' ? `/${name}` : `${parent}/${name}`;
    const sshConfig = credentialsToSSHAuthConfig(request.auth.accountId, creds);

    const session = await sshConnectionManager.acquire(sshConfig);
    try {
      const safeSrc = request.fileId.replace(/'/g, "'\\''");
      const safeDst = newPath.replace(/'/g, "'\\''");
      await execCommand(session, `cp -r '${safeSrc}' '${safeDst}'`);
      const sftp = await openSFTP(session);
      const stats = await sftpStat(sftp, newPath);
      sftp.end();
      return { file: statsToProviderFile(stats, newPath) };
    } catch (err) {
      throw AppError.fromUnknown(err, ErrorCode.TRANSFER_FAILED);
    } finally {
      sshConnectionManager.release(session.id);
    }
  }

  async renameFile(request: RenameFileRequest): Promise<RenameFileResponse> {
    const parts = request.fileId.split('/');
    parts.pop();
    const parent = parts.join('/') || '/';
    const newPath = parent === '/' ? `/${request.newName}` : `${parent}/${request.newName}`;

    return this.moveFile({
      context: request.context,
      auth: request.auth,
      fileId: request.fileId,
      newParentId: parent,
      newName: request.newName,
    }).then((r) => ({ file: r.file }));
  }

  async deleteFile(request: DeleteFileRequest): Promise<void> {
    const creds = decodeCredentials(request.auth.accessToken);
    const sshConfig = credentialsToSSHAuthConfig(request.auth.accountId, creds);

    const session = await sshConnectionManager.acquire(sshConfig);
    try {
      const sftp = await openSFTP(session);
      const stats = await sftpStat(sftp, request.fileId);
      if (stats.isDirectory()) {
        await sftpRmdir(sftp, request.fileId);
      } else {
        await sftpUnlink(sftp, request.fileId);
      }
      sftp.end();
    } catch (err) {
      throw AppError.fromUnknown(err, ErrorCode.TRANSFER_FAILED);
    } finally {
      sshConnectionManager.release(session.id);
    }
  }

  // -------------------------------------------------------------------------
  // Stream transfer
  // -------------------------------------------------------------------------

  async downloadStream(request: DownloadStreamRequest): Promise<DownloadStreamResponse> {
    const creds = decodeCredentials(request.auth.accessToken);
    const sshConfig = credentialsToSSHAuthConfig(request.auth.accountId, creds);

    const session = await sshConnectionManager.acquire(sshConfig);
    try {
      const sftp = await openSFTP(session);
      const stats = await sftpStat(sftp, request.fileId);
      const file = statsToProviderFile(stats, request.fileId);

      const start = request.range?.start;
      const end = request.range?.end;
      const stream = sftpCreateReadStream(sftp, request.fileId, start, end);

      const contentLength = (start !== undefined && end !== undefined)
        ? end - start + 1
        : stats.size;

      stream.on('close', () => {
        sftp.end();
        sshConnectionManager.release(session.id);
      });
      stream.on('error', () => {
        sftp.end();
        sshConnectionManager.release(session.id);
      });

      return { file, stream, contentLength };
    } catch (err) {
      sshConnectionManager.release(session.id);
      throw AppError.fromUnknown(err, ErrorCode.TRANSFER_FAILED);
    }
  }

  async uploadStream(request: UploadStreamRequest): Promise<UploadStreamResponse> {
    const creds = decodeCredentials(request.auth.accessToken);
    const parent = normalizePath(creds.rootPath, request.parentId);
    const targetPath = parent === '/' ? `/${request.fileName}` : `${parent}/${request.fileName}`;
    const sshConfig = credentialsToSSHAuthConfig(request.auth.accountId, creds);

    const session = await sshConnectionManager.acquire(sshConfig);
    try {
      const sftp = await openSFTP(session);
      await pipeToSFTP(request.stream, sftpCreateWriteStream(sftp, targetPath));
      const stats = await sftpStat(sftp, targetPath);
      sftp.end();
      return { file: statsToProviderFile(stats, targetPath) };
    } catch (err) {
      throw AppError.fromUnknown(err, ErrorCode.TRANSFER_FAILED);
    } finally {
      sshConnectionManager.release(session.id);
    }
  }

  // -------------------------------------------------------------------------
  // Resumable upload
  // -------------------------------------------------------------------------

  async createResumableUpload(request: CreateResumableUploadRequest): Promise<CreateResumableUploadResponse> {
    const creds = decodeCredentials(request.auth.accessToken);
    const parent = normalizePath(creds.rootPath, request.parentId);
    const targetPath = parent === '/' ? `/${request.fileName}` : `${parent}/${request.fileName}`;
    const sessionId = `vps-resumable-${request.context.requestId}-${Date.now()}`;

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString();

    const vpsSession: VPSResumableSession = {
      sessionId,
      remotePath: targetPath,
      contentLength: request.contentLength,
      chunkSize: request.chunkSize,
      nextOffset: 0,
      expiresAt,
    };
    resumableSessions.set(sessionId, vpsSession);

    return {
      session: {
        sessionId,
        providerUploadId: targetPath,
        parentId: request.parentId,
        fileName: request.fileName,
        contentType: request.contentType,
        contentLength: request.contentLength,
        chunkSize: request.chunkSize,
        nextOffset: 0,
        expiresAt,
      },
    };
  }

  async uploadResumableChunk(request: UploadResumableChunkRequest): Promise<UploadResumableChunkResponse> {
    const vpsSession = resumableSessions.get(request.session.sessionId);
    if (!vpsSession) {
      throw new AppError({
        code: ErrorCode.NOT_FOUND,
        message: `Resumable session not found: ${request.session.sessionId}`,
        retryable: false,
      });
    }

    const creds = decodeCredentials(request.auth.accessToken);
    const sshConfig = credentialsToSSHAuthConfig(request.auth.accountId, creds);

    const session = await sshConnectionManager.acquire(sshConfig);
    try {
      const sftp = await openSFTP(session);
      const writeStream = sftpAppendStream(sftp, vpsSession.remotePath, request.offset);
      await pipeChunkToSFTP(request.payload, writeStream, request.chunkLength);
      sftp.end();

      const committedOffset = request.offset + request.chunkLength;
      vpsSession.nextOffset = committedOffset;

      const completed = request.isFinalChunk === true
        || committedOffset >= vpsSession.contentLength;

      if (completed) {
        resumableSessions.delete(request.session.sessionId);
      }

      return {
        session: { ...request.session, nextOffset: committedOffset },
        committedOffset,
        completed,
      };
    } catch (err) {
      throw AppError.fromUnknown(err, ErrorCode.CHUNK_FAILED);
    } finally {
      sshConnectionManager.release(session.id);
    }
  }

  async getResumableUploadStatus(request: GetResumableUploadStatusRequest): Promise<GetResumableUploadStatusResponse> {
    const vpsSession = resumableSessions.get(request.session.sessionId);
    if (!vpsSession) {
      throw new AppError({
        code: ErrorCode.NOT_FOUND,
        message: `Resumable session not found: ${request.session.sessionId}`,
        retryable: false,
      });
    }
    return {
      session: { ...request.session, nextOffset: vpsSession.nextOffset },
    };
  }

  async finalizeResumableUpload(request: FinalizeResumableUploadRequest): Promise<FinalizeResumableUploadResponse> {
    const vpsSession = resumableSessions.get(request.session.sessionId);

    const remotePath = vpsSession?.remotePath ?? request.session.providerUploadId;
    const creds = decodeCredentials(request.auth.accessToken);
    const sshConfig = credentialsToSSHAuthConfig(request.auth.accountId, creds);

    const session = await sshConnectionManager.acquire(sshConfig);
    try {
      const sftp = await openSFTP(session);
      const stats = await sftpStat(sftp, remotePath);
      sftp.end();

      if (vpsSession) {
        resumableSessions.delete(request.session.sessionId);
      }

      return {
        session: { ...request.session, nextOffset: stats.size },
        file: statsToProviderFile(stats, remotePath),
      };
    } catch (err) {
      throw AppError.fromUnknown(err, ErrorCode.TRANSFER_FAILED);
    } finally {
      sshConnectionManager.release(session.id);
    }
  }

  async abortResumableUpload(request: AbortResumableUploadRequest): Promise<void> {
    resumableSessions.delete(request.session.sessionId);
  }

  // -------------------------------------------------------------------------
  // Share links — not supported by VPS
  // -------------------------------------------------------------------------

  async createShareLink(_request: CreateShareLinkRequest): Promise<CreateShareLinkResponse> {
    throw new AppError({
      code: ErrorCode.VALIDATION_FAILED,
      message: 'VPS/SFTP does not support share links.',
      retryable: false,
    });
  }

  async revokeShareLink(_request: RevokeShareLinkRequest): Promise<void> {
    throw new AppError({
      code: ErrorCode.VALIDATION_FAILED,
      message: 'VPS/SFTP does not support share links.',
      retryable: false,
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers — exec command via SSH exec channel
// ---------------------------------------------------------------------------

function execCommand(session: ManagedSSHSession, command: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    session.client.exec(command, (err, stream) => {
      if (err) {
        reject(new AppError({
          code: ErrorCode.PROVIDER_UNAVAILABLE,
          message: `SSH exec failed: ${err.message}`,
          retryable: true,
          cause: err,
        }));
        return;
      }

      const chunks: Buffer[] = [];
      const errChunks: Buffer[] = [];

      stream.on('data', (data: Buffer) => chunks.push(data));
      stream.stderr?.on('data', (data: Buffer) => errChunks.push(data));
      stream.on('close', (code: number) => {
        if (code !== 0) {
          const stderr = Buffer.concat(errChunks).toString('utf8').trim();
          reject(new AppError({
            code: ErrorCode.TRANSFER_FAILED,
            message: `Command exited with code ${code}: ${stderr}`,
            retryable: false,
          }));
        } else {
          resolve(Buffer.concat(chunks).toString('utf8'));
        }
      });
      stream.on('error', (streamErr: Error) => {
        reject(AppError.fromUnknown(streamErr, ErrorCode.TRANSFER_FAILED));
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Helpers — pipe streams to SFTP write streams
// ---------------------------------------------------------------------------

function pipeToSFTP(source: Readable, dest: NodeJS.WritableStream): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    source.pipe(dest as NodeJS.WritableStream & NodeJS.ReadWriteStream);
    dest.on('close', resolve);
    dest.on('error', (err: Error) => reject(AppError.fromUnknown(err, ErrorCode.TRANSFER_FAILED)));
    source.on('error', (err: Error) => reject(AppError.fromUnknown(err, ErrorCode.TRANSFER_FAILED)));
  });
}

function pipeChunkToSFTP(
  payload: import('../types').UploadChunkPayload,
  dest: NodeJS.WritableStream,
  length: number,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (payload instanceof Readable) {
      const bytes = payload as Readable;
      bytes.pipe(dest as NodeJS.WritableStream & NodeJS.ReadWriteStream);
      dest.on('close', resolve);
      dest.on('error', (err: Error) => reject(AppError.fromUnknown(err, ErrorCode.CHUNK_FAILED)));
      bytes.on('error', (err: Error) => reject(AppError.fromUnknown(err, ErrorCode.CHUNK_FAILED)));
    } else {
      const buf = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
      dest.write(buf.slice(0, length), (err) => {
        if (err) {
          reject(AppError.fromUnknown(err, ErrorCode.CHUNK_FAILED));
        } else {
          dest.end();
        }
      });
      dest.on('close', resolve);
    }
  });
}

// ---------------------------------------------------------------------------
// Module-level singleton adapter
// ---------------------------------------------------------------------------

export const vpsAdapter = new VPSAdapter();
