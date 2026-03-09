import { expect, test } from '@playwright/test'
import { Readable } from 'stream'
import { ErrorCode } from '../../../../lib/errors/ErrorCode'
import { PCloudAdapter } from '../../../../lib/providers/pcloud'
import {
  PROVIDER_PARITY_CHECKLIST,
  type ProviderAdapter,
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

test.describe('Task 4.3 - pCloud provider parity (AUTH-1)', () => {
  const originalFetch = globalThis.fetch
  const originalEnv = {
    PCLOUD_CLIENT_ID: process.env.PCLOUD_CLIENT_ID,
    PCLOUD_CLIENT_SECRET: process.env.PCLOUD_CLIENT_SECRET,
    PCLOUD_REDIRECT_URI: process.env.PCLOUD_REDIRECT_URI,
  }

  test.afterEach(() => {
    globalThis.fetch = originalFetch
    process.env.PCLOUD_CLIENT_ID = originalEnv.PCLOUD_CLIENT_ID
    process.env.PCLOUD_CLIENT_SECRET = originalEnv.PCLOUD_CLIENT_SECRET
    process.env.PCLOUD_REDIRECT_URI = originalEnv.PCLOUD_REDIRECT_URI
  })

  test('AUTH-1: pCloud passes all supported provider parity checks', async () => {
    process.env.PCLOUD_CLIENT_ID = 'pcloud-client-id'
    process.env.PCLOUD_CLIENT_SECRET = 'pcloud-client-secret'
    process.env.PCLOUD_REDIRECT_URI = 'http://localhost:3010/providers/pcloud/callback'

    const calls: Array<{ method: string; url: string }> = []

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      const method = (init?.method ?? 'GET').toUpperCase()
      calls.push({ method, url })

      if (url === 'https://api.pcloud.com/oauth2_token' && method === 'POST') {
        return json(200, {
          access_token: 'pcloud-access-token',
          locationid: 2,
        })
      }

      if (url === 'https://cdn.pcloud.test/dl/file.bin' && method === 'GET') {
        return new Response(Buffer.from('pcloud-stream-bytes'), {
          status: 200,
          headers: { 'content-length': '18' },
        })
      }

      const parsed = new URL(url)
      const endpoint = parsed.pathname.replace(/^\//, '')
      const accessToken = parsed.searchParams.get('access_token')

      if ((parsed.hostname === 'api.pcloud.com' || parsed.hostname === 'eapi.pcloud.com') && endpoint === 'userinfo' && method === 'GET') {
        if (accessToken === 'expired-token') {
          return json(200, { result: 1000, error: 'Invalid access token' })
        }
        return json(200, {
          result: 0,
          userid: 'eu-2001',
          email: 'pcloud.qa@example.com',
          firstname: 'PCloud',
          lastname: 'QA',
          quota: 2000,
          usedquota: 500,
        })
      }

      if (parsed.hostname === 'eapi.pcloud.com' && endpoint === 'listfolder' && method === 'GET') {
        return json(200, {
          result: 0,
          metadata: {
            contents: [
              { folderid: 11, isfolder: true, name: 'Docs', size: 0, parentfolderid: 0 },
              { fileid: 22, isfolder: false, name: 'one.txt', size: 1, parentfolderid: 0 },
              { fileid: 33, isfolder: false, name: 'two.txt', size: 2, parentfolderid: 0 },
            ],
          },
        })
      }

      if (parsed.hostname === 'eapi.pcloud.com' && endpoint === 'search' && method === 'GET') {
        return json(200, {
          result: 0,
          entries: [{ fileid: 44, isfolder: false, name: 'hit.txt', size: 9, parentfolderid: 0 }],
        })
      }

      if (parsed.hostname === 'eapi.pcloud.com' && endpoint === 'stat' && method === 'GET') {
        return json(200, {
          result: 0,
          metadata: { fileid: 55, isfolder: false, name: 'stat.txt', size: 18, parentfolderid: 0 },
        })
      }

      if (parsed.hostname === 'eapi.pcloud.com' && endpoint === 'createfolder' && method === 'GET') {
        return json(200, {
          result: 0,
          metadata: { folderid: 66, isfolder: true, name: 'Created', size: 0, parentfolderid: 0 },
        })
      }

      if (parsed.hostname === 'eapi.pcloud.com' && endpoint === 'renamefile' && method === 'GET') {
        const toName = parsed.searchParams.get('toname') ?? 'renamed.txt'
        return json(200, {
          result: 0,
          metadata: { fileid: 77, isfolder: false, name: toName, size: 10, parentfolderid: 1 },
        })
      }

      if (parsed.hostname === 'eapi.pcloud.com' && endpoint === 'copyfile' && method === 'GET') {
        return json(200, {
          result: 0,
          metadata: { fileid: 88, isfolder: false, name: 'copy.txt', size: 10, parentfolderid: 1 },
        })
      }

      if (parsed.hostname === 'eapi.pcloud.com' && endpoint === 'deletefile' && method === 'GET') {
        return json(200, { result: 0 })
      }

      if (parsed.hostname === 'eapi.pcloud.com' && endpoint === 'getfilelink' && method === 'GET') {
        return json(200, { result: 0, hosts: ['cdn.pcloud.test'], path: '/dl/file.bin' })
      }

      if (parsed.hostname === 'eapi.pcloud.com' && endpoint === 'uploadfile' && method === 'POST') {
        return json(200, {
          result: 0,
          fileids: [99],
          metadata: [{ fileid: 99, isfolder: false, name: 'upload.bin', size: 11, parentfolderid: 0 }],
        })
      }

      if (parsed.hostname === 'eapi.pcloud.com' && endpoint === 'upload_create' && method === 'GET') {
        return json(200, { result: 0, uploadid: 12345 })
      }

      if (parsed.hostname === 'eapi.pcloud.com' && endpoint === 'upload_write' && method === 'POST') {
        return json(200, { result: 0 })
      }

      if (parsed.hostname === 'eapi.pcloud.com' && endpoint === 'upload_info' && method === 'GET') {
        return json(200, { result: 0, currentoffset: 8 })
      }

      if (parsed.hostname === 'eapi.pcloud.com' && endpoint === 'upload_save' && method === 'GET') {
        return json(200, {
          result: 0,
          metadata: { fileid: 111, isfolder: false, name: 'resume.bin', size: 16, parentfolderid: 0 },
        })
      }

      if (parsed.hostname === 'eapi.pcloud.com' && endpoint === 'upload_delete' && method === 'GET') {
        return json(200, { result: 0 })
      }

      throw new Error(`Unhandled pCloud fetch: ${method} ${url}`)
    }) as typeof fetch

    const adapter = new PCloudAdapter()
    const parityAdapter = adapter as ProviderAdapter
    const context = { requestId: 'req-pcloud-1', userId: 'user-pcloud-1' }
    const checkResults: Record<ProviderParityCheckId, boolean> = {
      auth_lifecycle: false,
      file_discovery: false,
      file_mutation: false,
      stream_transfer: false,
      resumable_transfer: false,
      trash: false,
      versioning: false,
    }

    expect(adapter.descriptor.id).toBe('pcloud')
    expect(adapter.descriptor.displayName).toBe('pCloud')
    expect(adapter.descriptor.capabilities.supportsAuthRefresh).toBe(false)

    const connected = await adapter.connect({ context, code: 'oauth-code-pcloud' })
    const validAuth = await adapter.validateAuth({ context, auth: connected.auth })
    const invalidAuth = await adapter.validateAuth({
      context,
      auth: { ...connected.auth, accessToken: 'expired-token' },
    })
    await expect(adapter.refreshAuth({ context, auth: connected.auth })).rejects.toMatchObject({
      code: ErrorCode.REFRESH_FAILED,
    })
    await adapter.disconnect({ context, auth: connected.auth })

    checkResults.auth_lifecycle =
      connected.account.accountId === 'eu-2001' &&
      validAuth.valid === true &&
      invalidAuth.valid === false &&
      invalidAuth.reason === 'revoked'

    const listed = await adapter.listFiles({ context, auth: connected.auth, folderId: '0', pageSize: 2 })
    const searched = await adapter.searchFiles({ context, auth: connected.auth, query: 'hit', pageSize: 10 })
    const fetched = await adapter.getFile({ context, auth: connected.auth, fileId: '55' })

    checkResults.file_discovery =
      listed.files.length === 2 &&
      listed.hasMore === true &&
      listed.nextCursor === '2' &&
      searched.files.length === 1 &&
      searched.hasMore === false &&
      fetched.file.id === '55'

    const created = await adapter.createFolder({ context, auth: connected.auth, name: 'Created', parentId: '0' })
    const moved = await adapter.moveFile({ context, auth: connected.auth, fileId: '77', newParentId: '1', newName: 'moved.txt' })
    const copied = await adapter.copyFile({ context, auth: connected.auth, fileId: '77', newParentId: '1', newName: 'copy.txt' })
    const renamed = await adapter.renameFile({ context, auth: connected.auth, fileId: '77', newName: 'renamed.txt' })
    await adapter.deleteFile({ context, auth: connected.auth, fileId: '77' })

    checkResults.file_mutation =
      created.folder.id === '66' &&
      moved.file.name === 'moved.txt' &&
      copied.file.id === '88' &&
      renamed.file.name === 'renamed.txt'

    const downloaded = await adapter.downloadStream({
      context,
      auth: connected.auth,
      fileId: '55',
      range: { start: 0, end: 17 },
    })
    const downloadedBytes = await readStream(downloaded.stream)
    const uploaded = await adapter.uploadStream({
      context,
      auth: connected.auth,
      parentId: '0',
      fileName: 'upload.bin',
      contentType: 'application/octet-stream',
      stream: Readable.from(Buffer.from('upload-body')),
    })

    checkResults.stream_transfer =
      downloaded.contentLength === 18 &&
      downloadedBytes.toString('utf8') === 'pcloud-stream-bytes' &&
      uploaded.file.id === '99'

    const sessionCreated = await adapter.createResumableUpload({
      context,
      auth: connected.auth,
      parentId: '0',
      fileName: 'resume.bin',
      contentLength: 16,
      chunkSize: 8,
      contentType: 'application/octet-stream',
    })
    const chunkUploaded = await adapter.uploadResumableChunk({
      context,
      auth: connected.auth,
      session: sessionCreated.session,
      offset: 0,
      chunkLength: 8,
      payload: Buffer.from('12345678'),
    })
    const status = await adapter.getResumableUploadStatus({ context, auth: connected.auth, session: chunkUploaded.session })
    const finalized = await adapter.finalizeResumableUpload({ context, auth: connected.auth, session: status.session })
    await adapter.abortResumableUpload({ context, auth: connected.auth, session: status.session })

    checkResults.resumable_transfer =
      sessionCreated.session.providerUploadId === '12345' &&
      chunkUploaded.committedOffset === 8 &&
      chunkUploaded.completed === false &&
      status.session.nextOffset === 8 &&
      finalized.file.id === '111'

    const supportedChecks = PROVIDER_PARITY_CHECKLIST.filter((check) =>
      check.requiredMethods.every((method) => typeof parityAdapter[method] === 'function')
    )
    const parityResults = supportedChecks.map((check) => ({
      checkId: check.id,
      passed: checkResults[check.id],
    }))

    expect(parityResults.every((result) => result.passed)).toBe(true)
    expect(calls.some((call) => call.url === 'https://api.pcloud.com/oauth2_token')).toBe(true)
    expect(calls.some((call) => call.url.includes('eapi.pcloud.com/upload_write'))).toBe(true)
  })
})
