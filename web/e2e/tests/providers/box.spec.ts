import { expect, test } from '@playwright/test'
import { Readable } from 'stream'
import { BoxAdapter } from '../../../../lib/providers/box'
import {
  PROVIDER_PARITY_CHECKLIST,
  type ProviderParityCheckId,
} from '../../../../lib/providers/ProviderAdapter.interface'

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

async function readStream(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array))
  }
  return Buffer.concat(chunks)
}

test.describe('Task 4.3 - Box provider parity (AUTH-1)', () => {
  const originalFetch = globalThis.fetch
  const originalEnv = {
    BOX_CLIENT_ID: process.env.BOX_CLIENT_ID,
    BOX_CLIENT_SECRET: process.env.BOX_CLIENT_SECRET,
    BOX_REDIRECT_URI: process.env.BOX_REDIRECT_URI,
  }

  test.afterEach(() => {
    globalThis.fetch = originalFetch
    process.env.BOX_CLIENT_ID = originalEnv.BOX_CLIENT_ID
    process.env.BOX_CLIENT_SECRET = originalEnv.BOX_CLIENT_SECRET
    process.env.BOX_REDIRECT_URI = originalEnv.BOX_REDIRECT_URI
  })

  test('AUTH-1: Box passes all 5 provider parity checks', async () => {
    process.env.BOX_CLIENT_ID = 'box-client-id'
    process.env.BOX_CLIENT_SECRET = 'box-client-secret'
    process.env.BOX_REDIRECT_URI = 'http://localhost:3010/providers/box/callback'

    const calls: Array<{ method: string; url: string }> = []

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      const method = (init?.method ?? 'GET').toUpperCase()
      calls.push({ method, url })

      if (url === 'https://api.box.com/oauth2/token' && method === 'POST') {
        const body = String(init?.body ?? '')
        if (body.includes('grant_type=authorization_code')) {
          return json(200, {
            access_token: 'box-access-token',
            refresh_token: 'box-refresh-token',
            expires_in: 3600,
          })
        }
        if (body.includes('grant_type=refresh_token')) {
          return json(200, {
            access_token: 'box-access-token-refreshed',
            refresh_token: 'box-refresh-token-2',
            expires_in: 7200,
          })
        }
      }

      if (url === 'https://api.box.com/oauth2/revoke' && method === 'POST') {
        return new Response('', { status: 200 })
      }

      if (url === 'https://api.box.com/2.0/users/me' && method === 'GET') {
        const auth = (init?.headers as Record<string, string> | undefined)?.Authorization
        if (auth === 'Bearer expired-token') {
          return json(401, { error: 'unauthorized' })
        }
        return json(200, {
          id: 'box-account-1',
          login: 'box.qa@example.com',
          name: 'Box QA',
          space_amount: 1000,
          space_used: 100,
        })
      }

      if (url.startsWith('https://api.box.com/2.0/folders/0/items?') && method === 'GET') {
        return json(200, {
          entries: [
            { id: 'f-1', type: 'folder', name: 'Docs', size: 0, parent: { id: '0' } },
            { id: 'file-1', type: 'file', name: 'report.txt', size: 42, parent: { id: '0' } },
          ],
          next_marker: 'cursor-2',
        })
      }

      if (url.startsWith('https://api.box.com/2.0/search?') && method === 'GET') {
        return json(200, {
          entries: [{ id: 'file-2', type: 'file', name: 'search-hit.txt', size: 12, parent: { id: '0' } }],
          total_count: 3,
          offset: 0,
          limit: 1,
        })
      }

      if (url.startsWith('https://api.box.com/2.0/files/999?') && method === 'GET') {
        return json(404, { error: 'not_found' })
      }

      if (url.startsWith('https://api.box.com/2.0/folders/999?') && method === 'GET') {
        return json(200, { id: '999', type: 'folder', name: 'Recovered Folder', size: 0, parent: { id: '0' } })
      }

      if (url === 'https://api.box.com/2.0/folders' && method === 'POST') {
        return json(200, { id: 'new-folder', type: 'folder', name: 'Created', size: 0, parent: { id: '0' } })
      }

      if (url === 'https://api.box.com/2.0/files/file-1' && method === 'PUT') {
        return json(200, { id: 'file-1', type: 'file', name: 'renamed.txt', size: 42, parent: { id: '1' } })
      }

      if (url === 'https://api.box.com/2.0/files/file-1/copy' && method === 'POST') {
        return json(200, { id: 'file-copy-1', type: 'file', name: 'copy.txt', size: 42, parent: { id: '1' } })
      }

      if (url === 'https://api.box.com/2.0/files/file-delete' && method === 'DELETE') {
        return new Response(null, { status: 204 })
      }

      if (url === 'https://api.box.com/2.0/files/file-download/content' && method === 'GET') {
        return new Response(Buffer.from('box-download-bytes'), {
          status: 200,
          headers: { 'content-length': '18' },
        })
      }

      if (url.startsWith('https://api.box.com/2.0/files/file-download?') && method === 'GET') {
        return json(200, { id: 'file-download', type: 'file', name: 'download.bin', size: 18, parent: { id: '0' } })
      }

      if (url === 'https://upload.box.com/api/2.0/files/content' && method === 'POST') {
        return json(201, {
          entries: [{ id: 'upload-1', type: 'file', name: 'upload.bin', size: 11, parent: { id: '0' } }],
        })
      }

      if (url === 'https://upload.box.com/api/2.0/files/upload_sessions' && method === 'POST') {
        return json(201, {
          id: 'provider-upload-1',
          part_size: 8,
          session_expires_at: '2026-03-05T00:00:00.000Z',
        })
      }

      if (url === 'https://upload.box.com/api/2.0/files/upload_sessions/provider-upload-1' && method === 'PUT') {
        return json(200, {})
      }

      if (url === 'https://api.box.com/2.0/files/upload_sessions/provider-upload-1' && method === 'GET') {
        return json(200, { num_parts_processed: 1 })
      }

      if (url === 'https://upload.box.com/api/2.0/files/upload_sessions/provider-upload-1/commit' && method === 'POST') {
        return json(201, {
          entries: [{ id: 'final-file-1', type: 'file', name: 'resume.bin', size: 16, parent: { id: '0' } }],
        })
      }

      if (url === 'https://upload.box.com/api/2.0/files/upload_sessions/provider-upload-1' && method === 'DELETE') {
        return new Response(null, { status: 204 })
      }

      throw new Error(`Unhandled Box fetch: ${method} ${url}`)
    }) as typeof fetch

    const adapter = new BoxAdapter()
    const context = { requestId: 'req-box-1', userId: 'user-box-1' }
    const checkResults: Record<ProviderParityCheckId, boolean> = {
      auth_lifecycle: false,
      file_discovery: false,
      file_mutation: false,
      stream_transfer: false,
      resumable_transfer: false,
    }

    expect(adapter.descriptor.id).toBe('box')
    expect(adapter.descriptor.displayName).toBe('Box')
    expect(adapter.descriptor.capabilities.supportsAuthRefresh).toBe(true)

    const connected = await adapter.connect({ context, code: 'oauth-code-box' })
    const validAuth = await adapter.validateAuth({ context, auth: connected.auth })
    const invalidAuth = await adapter.validateAuth({
      context,
      auth: { ...connected.auth, accessToken: 'expired-token' },
    })
    const refreshed = await adapter.refreshAuth({ context, auth: connected.auth })
    await adapter.disconnect({ context, auth: refreshed.auth })

    checkResults.auth_lifecycle =
      connected.account.accountId === 'box-account-1' &&
      validAuth.valid === true &&
      invalidAuth.valid === false &&
      invalidAuth.reason === 'expired' &&
      refreshed.auth.accessToken === 'box-access-token-refreshed'

    const listed = await adapter.listFiles({ context, auth: refreshed.auth, folderId: '0', pageSize: 2 })
    const searched = await adapter.searchFiles({ context, auth: refreshed.auth, query: 'search', pageSize: 1 })
    const fetched = await adapter.getFile({ context, auth: refreshed.auth, fileId: '999' })

    checkResults.file_discovery =
      listed.files.length === 2 &&
      listed.hasMore === true &&
      listed.nextCursor === 'cursor-2' &&
      searched.files.length === 1 &&
      searched.hasMore === true &&
      searched.nextCursor === '1' &&
      fetched.file.isFolder === true &&
      fetched.file.id === '999'

    const created = await adapter.createFolder({ context, auth: refreshed.auth, name: 'Created', parentId: '0' })
    const moved = await adapter.moveFile({ context, auth: refreshed.auth, fileId: 'file-1', newParentId: '1', newName: 'renamed.txt' })
    const copied = await adapter.copyFile({ context, auth: refreshed.auth, fileId: 'file-1', newParentId: '1', newName: 'copy.txt' })
    const renamed = await adapter.renameFile({ context, auth: refreshed.auth, fileId: 'file-1', newName: 'renamed.txt' })
    await adapter.deleteFile({ context, auth: refreshed.auth, fileId: 'file-delete' })

    checkResults.file_mutation =
      created.folder.id === 'new-folder' &&
      moved.file.id === 'file-1' &&
      copied.file.id === 'file-copy-1' &&
      renamed.file.name === 'renamed.txt'

    const downloaded = await adapter.downloadStream({
      context,
      auth: refreshed.auth,
      fileId: 'file-download',
      range: { start: 0, end: 17 },
    })
    const downloadedBytes = await readStream(downloaded.stream)
    const uploaded = await adapter.uploadStream({
      context,
      auth: refreshed.auth,
      parentId: '0',
      fileName: 'upload.bin',
      contentType: 'application/octet-stream',
      stream: Readable.from(Buffer.from('upload-body')),
    })

    checkResults.stream_transfer =
      downloaded.file.id === 'file-download' &&
      downloaded.contentLength === 18 &&
      downloadedBytes.toString('utf8') === 'box-download-bytes' &&
      uploaded.file.id === 'upload-1'

    const sessionCreated = await adapter.createResumableUpload({
      context,
      auth: refreshed.auth,
      parentId: '0',
      fileName: 'resume.bin',
      contentLength: 16,
      chunkSize: 8,
      contentType: 'application/octet-stream',
    })
    const chunkUploaded = await adapter.uploadResumableChunk({
      context,
      auth: refreshed.auth,
      session: sessionCreated.session,
      offset: 0,
      chunkLength: 8,
      payload: Buffer.from('12345678'),
    })
    const status = await adapter.getResumableUploadStatus({ context, auth: refreshed.auth, session: chunkUploaded.session })
    const finalized = await adapter.finalizeResumableUpload({ context, auth: refreshed.auth, session: status.session })
    await adapter.abortResumableUpload({ context, auth: refreshed.auth, session: status.session })

    checkResults.resumable_transfer =
      sessionCreated.session.providerUploadId === 'provider-upload-1' &&
      chunkUploaded.committedOffset === 8 &&
      chunkUploaded.completed === false &&
      status.session.nextOffset === 8 &&
      finalized.file.id === 'final-file-1'

    const parityResults = PROVIDER_PARITY_CHECKLIST.map((check) => ({
      checkId: check.id,
      passed: checkResults[check.id],
    }))

    expect(parityResults.every((result) => result.passed)).toBe(true)
    expect(calls.some((call) => call.url === 'https://api.box.com/oauth2/revoke')).toBe(true)
  })
})
