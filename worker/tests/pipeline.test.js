'use strict';

// ── Mocks must be declared before requires ────────────────────────────────────
jest.mock('dotenv', () => ({ config: jest.fn() }));

// Mock redis client used for transfer quota
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    incrby: jest.fn().mockResolvedValue(0),
    expire: jest.fn().mockResolvedValue(1),
    decrby: jest.fn().mockResolvedValue(0),
    on: jest.fn()
  }));
});

// Mock pg Pool
const mockQuery = jest.fn().mockResolvedValue({ rows: [{ now: new Date() }] });
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: mockQuery,
    on: jest.fn()
  }))
}));

// Mock fs
const mockStatSync  = jest.fn();
const mockExistsSync = jest.fn();
const mockReadStream = jest.fn();
jest.mock('fs', () => ({
  statSync:        (...a) => mockStatSync(...a),
  existsSync:      (...a) => mockExistsSync(...a),
  createReadStream:(...a) => mockReadStream(...a),
  mkdirSync:       jest.fn()
}));

// Mock child_process
const mockExecFile = jest.fn();
const mockSpawn    = jest.fn();
jest.mock('child_process', () => ({
  execFile: (...a) => mockExecFile(...a),
  spawn:    (...a) => mockSpawn(...a)
}));

// Mock chokidar so worker doesn't start watching on require
jest.mock('chokidar', () => ({
  watch: jest.fn().mockReturnValue({
    on:    jest.fn().mockReturnThis(),
    close: jest.fn().mockResolvedValue()
  })
}));

// ── Load worker AFTER mocks ───────────────────────────────────────────────────
const worker = require('../sync-worker');

// ── Helpers ───────────────────────────────────────────────────────────────────
const UUID_A = '04ff14a8-59b9-4791-88c2-8488911aafeb';
const FILE_A = `/mnt/local/${UUID_A}/test.txt`;
const REL_A  = 'test.txt';
const FILE_ID = 'aaaaaaaa-0000-0000-0000-000000000001';

beforeEach(() => {
  jest.clearAllMocks();
  mockStatSync.mockReturnValue({ mtimeMs: Date.now() - 9999999, size: 100 });
  mockExistsSync.mockReturnValue(true);
});

// ── Stage 1: Detect ───────────────────────────────────────────────────────────
describe('stage1Detect', () => {
  test('skips files not in a UUID subfolder', async () => {
    const result = await worker.stage1Detect('/mnt/local/some-random-file.txt');
    expect(result).toBeNull();
  });

  test('skips files already syncing', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: UUID_A }] }) // user check
      .mockResolvedValueOnce({
        rows: [{ id: FILE_ID, status: 'syncing', synced_at: null, updated_at: new Date() }]
      });
    const result = await worker.stage1Detect(FILE_A);
    expect(result).toBeNull();
  });

  test('skips synced files not modified since sync', async () => {
    const syncedAt = new Date(Date.now() - 60000); // synced 60s ago
    mockStatSync.mockReturnValue({ mtimeMs: syncedAt.getTime() - 1000, size: 100 });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: UUID_A }] }) // user check
      .mockResolvedValueOnce({
        rows: [{ id: FILE_ID, status: 'synced', synced_at: syncedAt, updated_at: new Date() }]
      });
    const result = await worker.stage1Detect(FILE_A);
    expect(result).toBeNull();
  });

  test('returns context for existing file in error state', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: UUID_A }] }) // user check
      .mockResolvedValueOnce({
        rows: [{ id: FILE_ID, status: 'error', synced_at: null, updated_at: new Date() }]
      });
    const result = await worker.stage1Detect(FILE_A);
    expect(result).toMatchObject({ fileId: FILE_ID, userId: UUID_A, rel: REL_A, isNew: false });
  });

  test('inserts new file as pending and returns context', async () => {
    // User exists, no existing record
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: UUID_A }] })
      .mockResolvedValueOnce({ rows: [] });
    // sha256 read stream mock
    const EventEmitter = require('events');
    const stream = new EventEmitter();
    mockReadStream.mockReturnValue(stream);
    // Insert returns id
    mockQuery.mockResolvedValueOnce({ rows: [{ id: FILE_ID }] });

    // Trigger stream events asynchronously
    setImmediate(() => {
      stream.emit('data', Buffer.from('hello'));
      stream.emit('end');
    });

    const result = await worker.stage1Detect(FILE_A);
    expect(result).toMatchObject({ fileId: FILE_ID, userId: UUID_A, isNew: true });
  });
});

// ── Stage 2: Prioritise ───────────────────────────────────────────────────────
describe('stage2Prioritise', () => {
  test('documents get priority 1', () => {
    expect(worker.stage2Prioritise('/mnt/local/u/doc.pdf')).toBe(1);
    expect(worker.stage2Prioritise('/mnt/local/u/doc.docx')).toBe(1);
    expect(worker.stage2Prioritise('/mnt/local/u/notes.md')).toBe(1);
  });

  test('images get priority 2', () => {
    expect(worker.stage2Prioritise('/mnt/local/u/photo.png')).toBe(2);
    expect(worker.stage2Prioritise('/mnt/local/u/photo.jpg')).toBe(2);
  });

  test('videos get priority 3', () => {
    expect(worker.stage2Prioritise('/mnt/local/u/movie.mp4')).toBe(3);
    expect(worker.stage2Prioritise('/mnt/local/u/clip.mkv')).toBe(3);
  });

  test('unknown types get priority 4', () => {
    expect(worker.stage2Prioritise('/mnt/local/u/data.xyz')).toBe(4);
    expect(worker.stage2Prioritise('/mnt/local/u/archive.zip')).toBe(4);
  });
});

// ── Stage 3: Check ────────────────────────────────────────────────────────────
describe('stage3Check', () => {
  test('always returns true (placeholder)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ quota_bytes: 1000, used_bytes: 100, size_bytes: 100 }]
    });
    const result = await worker.stage3Check(FILE_ID, UUID_A, REL_A);
    expect(result).toBe(true);
  });
});

// ── Stage 4: Upload ───────────────────────────────────────────────────────────
describe('stage4Upload', () => {
  test('returns ok:true on successful rclone copy', async () => {
    mockQuery.mockResolvedValue({ rows: [{ user_id: UUID_A, size_bytes: 100 }] });
    mockExecFile.mockImplementation((_cmd, _args, cb) => cb(null, '', ''));

    const result = await worker.stage4Upload(FILE_ID, FILE_A, REL_A, UUID_A);
    expect(result.ok).toBe(true);
  });

  test('returns ok:false with error on rclone failure', async () => {
    mockQuery.mockResolvedValue({ rows: [{ user_id: UUID_A, size_bytes: 100 }] });
    mockExecFile.mockImplementation((_cmd, _args, cb) =>
      cb(new Error('connection failed'), '', 'SFTP error: connection refused')
    );

    const result = await worker.stage4Upload(FILE_ID, FILE_A, REL_A, UUID_A);
    expect(result.ok).toBe(false);
    expect(result.err).toContain('SFTP error');
  });
});

// ── Stage 5: Verify ───────────────────────────────────────────────────────────
describe('stage5Verify', () => {
  function mockLocalHash(data = 'hello') {
    const EventEmitter = require('events');
    const stream = new EventEmitter();
    mockReadStream.mockReturnValue(stream);
    setImmediate(() => {
      stream.emit('data', Buffer.from(data));
      stream.emit('end');
    });
  }

  function mockRcloneCat({ exitCode = 0, data = 'hello', stderr = '' } = {}) {
    const EventEmitter = require('events');
    const stdout = new EventEmitter();
    const stderrStream = new EventEmitter();
    const proc = new EventEmitter();
    proc.stdout = stdout;
    proc.stderr = stderrStream;
    mockSpawn.mockReturnValue(proc);
    setImmediate(() => {
      if (data) stdout.emit('data', Buffer.from(data));
      stdout.emit('end');
      if (stderr) stderrStream.emit('data', Buffer.from(stderr));
      proc.emit('close', exitCode);
    });
  }

  test('marks synced on hash match', async () => {
    mockLocalHash('hello');
    mockRcloneCat({ data: 'hello' });
    mockQuery.mockResolvedValue({ rows: [] });

    const result = await worker.stage5Verify(FILE_ID, FILE_A, REL_A, UUID_A, 100);
    expect(result).toBe(true);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("status='synced'"),
      expect.any(Array)
    );
  });

  test('marks error on hash mismatch', async () => {
    mockLocalHash('hello');
    mockRcloneCat({ data: 'different content' });
    mockQuery.mockResolvedValue({ rows: [] });

    const result = await worker.stage5Verify(FILE_ID, FILE_A, REL_A, UUID_A, 100);
    expect(result).toBe(false);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("status='error'"),
      expect.arrayContaining([FILE_ID, expect.stringContaining('hash mismatch')])
    );
  });

  test('marks error with reason when rclone cat fails (remote path missing)', async () => {
    mockLocalHash('hello');
    mockRcloneCat({ exitCode: 1, data: '', stderr: 'directory not found' });
    mockQuery.mockResolvedValue({ rows: [] });

    const result = await worker.stage5Verify(FILE_ID, FILE_A, REL_A, UUID_A, 100);
    expect(result).toBe(false);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("status='error'"),
      expect.arrayContaining([FILE_ID, expect.stringContaining('rclone cat failed')])
    );
  });
});

// ── Stage 6: Resolve ──────────────────────────────────────────────────────────
describe('stage6Resolve', () => {
  test('creates conflict record when file modified after sync within 300s', async () => {
    const syncedAt = new Date(Date.now() - 120000); // synced 2 min ago
    const mtime    = Date.now() - 30000;            // modified 30s ago (after sync)

    mockQuery
      .mockResolvedValueOnce({ rows: [{ user_id: UUID_A, synced_at: syncedAt }] }) // SELECT
      .mockResolvedValueOnce({ rows: [] }) // check existing conflict
      .mockResolvedValueOnce({ rows: [] }) // UPDATE files SET status=conflict
      .mockResolvedValueOnce({ rows: [] }); // INSERT conflicts

    mockStatSync.mockReturnValue({ mtimeMs: mtime });

    await worker.stage6Resolve(FILE_ID, REL_A, FILE_A);

    const insertCall = mockQuery.mock.calls.find(c =>
      typeof c[0] === 'string' && c[0].includes('INSERT INTO conflicts')
    );
    expect(insertCall).toBeDefined();
  });

  test('skips conflict if file not modified since sync', async () => {
    const syncedAt = new Date(Date.now() - 120000);
    mockStatSync.mockReturnValue({ mtimeMs: syncedAt.getTime() - 5000 }); // older than sync

    mockQuery.mockResolvedValueOnce({ rows: [{ user_id: UUID_A, synced_at: syncedAt }] });

    await worker.stage6Resolve(FILE_ID, REL_A, FILE_A);

    const insertCall = mockQuery.mock.calls.find(c =>
      typeof c[0] === 'string' && c[0].includes('INSERT INTO conflicts')
    );
    expect(insertCall).toBeUndefined();
  });

  test('skips if no synced_at (never synced)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ user_id: UUID_A, synced_at: null }] });

    await worker.stage6Resolve(FILE_ID, REL_A, FILE_A);

    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
});
