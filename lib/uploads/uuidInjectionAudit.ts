import fs from 'fs'
import path from 'path'
import type {
  UploadUuidAuditReport,
  UploadUuidInjectionCategory,
  UploadUuidInjectionPoint,
} from '../providers/types'

interface UploadAuditTarget {
  filePath: string
  category: UploadUuidInjectionCategory
  notes: string
  affectsUploadPath?: boolean
}

interface InjectionPattern {
  expression: string
  regex: RegExp
  category?: UploadUuidInjectionCategory
}

interface ScanResult {
  points: UploadUuidInjectionPoint[]
  scannedLines: number
}

const UUID_SEGMENT_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const UUID_PREFIX_PATTERN =
  /^[0-9a-f]{8}(?:-|_)[0-9a-f]{4}(?:-|_)[1-5][0-9a-f]{3}(?:-|_)[89ab][0-9a-f]{3}(?:-|_)[0-9a-f]{12}(?:-|_)/i

const UPLOAD_PATH_MUTATOR_FILE = 'api/src/routes/files.js'
const UPLOAD_PATH_HINTS = ['relativePath', 'originalname', 'filename', 'path.join', 'diskPath']

const UPLOAD_PATH_INJECTION_PATTERNS: InjectionPattern[] = [
  { expression: 'uuid', regex: /\buuid\b/i, category: 'upload_path' },
  { expression: 'crypto.randomUUID()', regex: /crypto\.randomUUID\s*\(/, category: 'upload_path' },
  { expression: 'crypto.randomBytes()', regex: /crypto\.randomBytes\s*\(/, category: 'upload_path' },
  { expression: 'Date.now().toString()', regex: /Date\.now\s*\(\)\.toString\s*\(/, category: 'upload_path' },
]

const UUID_INJECTION_PATTERNS: InjectionPattern[] = [
  { expression: 'uuidv4()', regex: /\buuidv4\s*\(/, category: 'request_tracking' },
  { expression: 'crypto.randomUUID()', regex: /crypto\.randomUUID\s*\(/ },
  { expression: 'crypto.randomBytes()', regex: /crypto\.randomBytes\s*\(/, category: 'oauth_state' },
  { expression: 'Date.now().toString()', regex: /Date\.now\s*\(\)\.toString\s*\(/ },
  { expression: 'Date.now()', regex: /Date\.now\s*\(\)(?!\.toString)/ },
  { expression: 'uuid field', regex: /\buuid\s*:/i, category: 'qa_mock' },
  { expression: 'sessionId field', regex: /\bsessionId\s*:\s*string\b/, category: 'resumable_session' },
]

export const UPLOAD_UUID_AUDIT_TARGETS: UploadAuditTarget[] = [
  {
    filePath: 'api/src/middleware/requestTracker.js',
    category: 'request_tracking',
    notes: 'Generates per-request UUIDs for correlation headers.',
  },
  {
    filePath: 'api/src/routes/transfer.js',
    category: 'transfer_tracking',
    notes: 'Generates transfer task IDs for in-memory progress tracking.',
  },
  {
    filePath: 'worker/queues/transferQueue.ts',
    category: 'transfer_tracking',
    notes: 'Generates queue job IDs from user ID + timestamp.',
  },
  {
    filePath: 'api/src/routes/remotes.js',
    category: 'remote_config',
    notes: 'Generates remote IDs and OAuth state values.',
  },
  {
    filePath: 'api/src/routes/userRemotes.js',
    category: 'qa_mock',
    notes: 'QA mock responses include static uuid-shaped fields.',
  },
  {
    filePath: 'lib/providers/types.ts',
    category: 'resumable_session',
    notes: 'Defines resumable upload sessionId surface.',
  },
]

export const UPLOAD_UUID_AUDIT_GATE = 'UUID-1' as const

function buildPointId(filePath: string, line: number, expression: string): string {
  const safeExpression = expression
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()

  return `${filePath}:${line}:${safeExpression}`
}

function trimSnippet(value: string): string {
  return value.trim().slice(0, 200)
}

function buildReadFailurePoint(filePath: string, error: unknown, notes: string): UploadUuidInjectionPoint {
  const message = error instanceof Error ? error.message : String(error)

  return {
    id: buildPointId(filePath, 0, 'READ_FAILED'),
    filePath,
    line: 0,
    expression: 'READ_FAILED',
    snippet: '',
    category: 'unknown',
    affectsUploadPath: false,
    notes: `${notes}: ${message}`,
  }
}

function scanTargetFile(target: UploadAuditTarget, repoRoot: string): ScanResult {
  const absolutePath = path.resolve(repoRoot, target.filePath)

  if (!fs.existsSync(absolutePath)) {
    return {
      scannedLines: 0,
      points: [
        {
          id: buildPointId(target.filePath, 0, 'MISSING_FILE'),
          filePath: target.filePath,
          line: 0,
          expression: 'MISSING_FILE',
          snippet: '',
          category: 'unknown',
          affectsUploadPath: false,
          notes: `Audit target missing: ${target.filePath}`,
        },
      ],
    }
  }

  let lines: string[]
  try {
    lines = fs.readFileSync(absolutePath, 'utf8').split(/\r?\n/)
  } catch (error) {
    return {
      scannedLines: 0,
      points: [buildReadFailurePoint(target.filePath, error, 'Audit target could not be read')],
    }
  }

  const points: UploadUuidInjectionPoint[] = []

  lines.forEach((line, index) => {
    UUID_INJECTION_PATTERNS.forEach((pattern) => {
      if (!pattern.regex.test(line)) {
        return
      }

      const category = pattern.category ?? target.category
      const affectsUploadPath =
        target.affectsUploadPath === true ||
        (category === 'upload_path' && /\b(path|name|upload)\b/i.test(line))

      points.push({
        id: buildPointId(target.filePath, index + 1, pattern.expression),
        filePath: target.filePath,
        line: index + 1,
        expression: pattern.expression,
        snippet: trimSnippet(line),
        category,
        affectsUploadPath,
        notes: target.notes,
      })
    })
  })

  return { points, scannedLines: lines.length }
}

function scanUploadPathMutators(repoRoot: string): ScanResult {
  const absolutePath = path.resolve(repoRoot, UPLOAD_PATH_MUTATOR_FILE)

  if (!fs.existsSync(absolutePath)) {
    return {
      scannedLines: 0,
      points: [
        {
          id: buildPointId(UPLOAD_PATH_MUTATOR_FILE, 0, 'MISSING_FILE'),
          filePath: UPLOAD_PATH_MUTATOR_FILE,
          line: 0,
          expression: 'MISSING_FILE',
          snippet: '',
          category: 'unknown',
          affectsUploadPath: false,
          notes: 'Upload path mutator file is missing and could not be audited.',
        },
      ],
    }
  }

  let lines: string[]
  try {
    lines = fs.readFileSync(absolutePath, 'utf8').split(/\r?\n/)
  } catch (error) {
    return {
      scannedLines: 0,
      points: [buildReadFailurePoint(UPLOAD_PATH_MUTATOR_FILE, error, 'Upload path mutator file could not be read')],
    }
  }

  const points: UploadUuidInjectionPoint[] = []

  lines.forEach((line, index) => {
    if (!UPLOAD_PATH_HINTS.some((hint) => line.includes(hint))) {
      return
    }

    UPLOAD_PATH_INJECTION_PATTERNS.forEach((pattern) => {
      if (!pattern.regex.test(line)) {
        return
      }

      points.push({
        id: buildPointId(UPLOAD_PATH_MUTATOR_FILE, index + 1, pattern.expression),
        filePath: UPLOAD_PATH_MUTATOR_FILE,
        line: index + 1,
        expression: pattern.expression,
        snippet: trimSnippet(line),
        category: 'upload_path',
        affectsUploadPath: true,
        notes: 'Potential UUID injection into persisted upload path.',
      })
    })
  })

  return { points, scannedLines: lines.length }
}

function dedupePoints(points: UploadUuidInjectionPoint[]): UploadUuidInjectionPoint[] {
  const unique = new Map<string, UploadUuidInjectionPoint>()

  points.forEach((point) => {
    if (!unique.has(point.id)) {
      unique.set(point.id, point)
    }
  })

  return [...unique.values()]
}

export function pathContainsUuidSegment(inputPath: string): boolean {
  const normalized = inputPath.replace(/\\/g, '/')
  return normalized.split('/').some((segment) => UUID_SEGMENT_PATTERN.test(segment))
}

export function fileNameHasUuidPrefix(fileName: string): boolean {
  return UUID_PREFIX_PATTERN.test(fileName)
}

export function buildUploadUuidAuditReport(repoRoot = process.cwd()): UploadUuidAuditReport {
  const allPoints: UploadUuidInjectionPoint[] = []

  let scannedLines = 0
  let scannedFiles = 0

  UPLOAD_UUID_AUDIT_TARGETS.forEach((target) => {
    const result = scanTargetFile(target, repoRoot)
    scannedFiles += 1
    scannedLines += result.scannedLines
    allPoints.push(...result.points)
  })

  const uploadPathResult = scanUploadPathMutators(repoRoot)
  scannedFiles += 1
  scannedLines += uploadPathResult.scannedLines
  allPoints.push(...uploadPathResult.points)

  const points = dedupePoints(allPoints)
  const uploadPathInjectionPoints = points.filter((point) => point.affectsUploadPath).length

  return {
    gate: UPLOAD_UUID_AUDIT_GATE,
    generatedAt: new Date().toISOString(),
    points,
    summary: {
      scannedFiles,
      scannedLines,
      injectionPoints: points.length,
      uploadPathInjectionPoints,
      hasBlockingUploadPathInjection: uploadPathInjectionPoints > 0,
    },
  }
}

