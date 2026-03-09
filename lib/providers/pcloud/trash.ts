import { AppError } from '../../errors/AppError'
import { ErrorCode } from '../../errors/ErrorCode'
import type {
  EmptyTrashRequest,
  ListFileVersionsRequest,
  ListFileVersionsResponse,
  ListTrashRequest,
  ListTrashResponse,
  RestoreFileRequest,
  RestoreFileVersionRequest,
} from '../types'

export async function listTrash(_request: ListTrashRequest): Promise<ListTrashResponse> {
  throw new AppError({
    code: ErrorCode.VALIDATION_FAILED,
    message: 'Trash not supported for this provider yet.',
    retryable: false,
  })
}

export async function restoreFile(_request: RestoreFileRequest): Promise<void> {
  throw new AppError({
    code: ErrorCode.VALIDATION_FAILED,
    message: 'Trash restore not supported for this provider yet.',
    retryable: false,
  })
}

export async function emptyTrash(_request: EmptyTrashRequest): Promise<void> {
  throw new AppError({
    code: ErrorCode.VALIDATION_FAILED,
    message: 'Empty trash not supported for this provider yet.',
    retryable: false,
  })
}

export async function listFileVersions(_request: ListFileVersionsRequest): Promise<ListFileVersionsResponse> {
  throw new AppError({
    code: ErrorCode.VALIDATION_FAILED,
    message: 'Versioning not supported for this provider yet.',
    retryable: false,
  })
}

export async function restoreFileVersion(_request: RestoreFileVersionRequest): Promise<void> {
  throw new AppError({
    code: ErrorCode.VALIDATION_FAILED,
    message: 'Versioning restore not supported for this provider yet.',
    retryable: false,
  })
}
