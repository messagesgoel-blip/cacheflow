import { Readable } from 'stream';
import { ProviderAdapter } from './ProviderAdapter.interface';
import { 
  ProviderAuthState, 
  ProviderOperationContext, 
  UploadStreamRequest, 
  UploadStreamResponse,
  CreateResumableUploadRequest,
  CreateResumableUploadResponse,
  UploadResumableChunkRequest,
  UploadResumableChunkResponse,
  GetResumableUploadStatusRequest,
  GetResumableUploadStatusResponse,
  FinalizeResumableUploadRequest,
  FinalizeResumableUploadResponse,
  AbortResumableUploadRequest,
  ResumableUploadSession 
} from './types';

/**
 * Type guard to check if a provider supports upload operations
 */
export function supportsUpload(provider: ProviderAdapter): provider is ProviderAdapter {
  return (
    typeof provider.uploadStream === 'function' &&
    typeof provider.createResumableUpload === 'function' &&
    typeof provider.uploadResumableChunk === 'function' &&
    typeof provider.getResumableUploadStatus === 'function' &&
    typeof provider.finalizeResumableUpload === 'function' &&
    typeof provider.abortResumableUpload === 'function'
  );
}

/**
 * Upload progress callback type
 */
export type UploadProgressCallback = (progress: {
  loaded: number;
  total: number;
  percentage: number;
  sessionId?: string;
}) => void;

/**
 * Options for uploading with progress tracking
 */
export interface UploadWithOptions {
  context: ProviderOperationContext;
  auth: ProviderAuthState;
  provider: ProviderAdapter;
  parentId?: string;
  fileName: string;
  contentType?: string;
  contentLength?: number;
  stream: Readable;
  onProgress?: UploadProgressCallback;
  chunkSize?: number;
}

/**
 * Upload result interface
 */
export interface UploadResult {
  fileId: string;
  fileName: string;
  size: number;
  mimeType?: string;
  webUrl?: string;
}

/**
 * Perform a standard upload with progress tracking
 */
export async function performUpload(options: UploadWithOptions): Promise<UploadResult> {
  const {
    context,
    auth,
    provider,
    parentId,
    fileName,
    contentType,
    contentLength,
    stream,
    onProgress,
  } = options;

  const uploadRequest: UploadStreamRequest = {
    context,
    auth,
    parentId,
    fileName,
    contentType,
    contentLength,
    stream,
  };

  const response = await provider.uploadStream(uploadRequest);

  return {
    fileId: response.file.id,
    fileName: response.file.name,
    size: response.file.size,
    mimeType: response.file.mimeType,
    webUrl: response.file.webUrl,
  };
}

/**
 * Perform a resumable upload with progress tracking
 */
export async function performResumableUpload(
  options: Omit<UploadWithOptions, 'stream'> & { 
    stream: Readable; 
    chunkSize?: number 
  }
): Promise<UploadResult> {
  const {
    context,
    auth,
    provider,
    parentId,
    fileName,
    contentType,
    contentLength,
    stream,
    onProgress,
    chunkSize = 1024 * 1024,
  } = options;

  if (!contentLength) {
    throw new Error('Content length is required for resumable uploads');
  }

  const sessionResponse = await provider.createResumableUpload({
    context,
    auth,
    parentId,
    fileName,
    contentType,
    contentLength,
    chunkSize,
  });

  const session = sessionResponse.session;
  
  if (onProgress) {
    onProgress({
      loaded: 0,
      total: contentLength,
      percentage: 0,
      sessionId: session.sessionId,
    });
  }

  // Process the stream in chunks
  const chunks = await splitStreamIntoChunks(stream, chunkSize);
  let uploadedBytes = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const offset = i * chunkSize;
    const isFinalChunk = i === chunks.length - 1;

    const chunkResponse = await provider.uploadResumableChunk({
      context,
      auth,
      session,
      offset,
      chunkLength: chunk.length,
      payload: chunk,
      isFinalChunk,
    });

    uploadedBytes = chunkResponse.committedOffset;
    
    if (onProgress) {
      onProgress({
        loaded: uploadedBytes,
        total: contentLength,
        percentage: Math.round((uploadedBytes / contentLength) * 100),
        sessionId: session.sessionId,
      });
    }
  }

  const finalizeResponse = await provider.finalizeResumableUpload({
    context,
    auth,
    session,
  });

  return {
    fileId: finalizeResponse.file.id,
    fileName: finalizeResponse.file.name,
    size: finalizeResponse.file.size,
    mimeType: finalizeResponse.file.mimeType,
    webUrl: finalizeResponse.file.webUrl,
  };
}

async function splitStreamIntoChunks(stream: Readable, chunkSize: number): Promise<Buffer[]> {
  const chunks: Buffer[] = [];
  
  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    
    if (buffer.length > chunkSize) {
      for (let i = 0; i < buffer.length; i += chunkSize) {
        chunks.push(buffer.subarray(i, Math.min(i + chunkSize, buffer.length)));
      }
    } else {
      chunks.push(buffer);
    }
  }
  
  return chunks;
}