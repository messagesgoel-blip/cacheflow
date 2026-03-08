import { NextRequest } from 'next/server';

type DuplicateDetectionOptions = {
  minSize?: number;
  maxSize?: number;
  includeTrash?: boolean;
  recursive?: boolean;
  providers?: string[];
};

function parseBoolean(value: string | null): boolean | undefined {
  if (value === null) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return undefined;
}

function parseNumber(value: string | null): number | undefined {
  if (value === null || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeProviders(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    return value.map(String).map((v) => v.trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return undefined;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const options: DuplicateDetectionOptions = {
    minSize: parseNumber(searchParams.get('minSize')),
    maxSize: parseNumber(searchParams.get('maxSize')),
    includeTrash: parseBoolean(searchParams.get('includeTrash')),
    recursive: parseBoolean(searchParams.get('recursive')),
    providers: normalizeProviders(searchParams.get('providers')),
  };

  return Response.json({
    success: true,
    count: 0,
    duplicates: [],
    options,
  });
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json(
      {
        success: false,
        error: 'Invalid request body',
      },
      { status: 400 },
    );
  }

  const options: DuplicateDetectionOptions = {
    minSize: typeof body.minSize === 'number' ? body.minSize : undefined,
    maxSize: typeof body.maxSize === 'number' ? body.maxSize : undefined,
    includeTrash: typeof body.includeTrash === 'boolean' ? body.includeTrash : undefined,
    recursive: typeof body.recursive === 'boolean' ? body.recursive : undefined,
    providers: normalizeProviders(body.providers),
  };

  return Response.json({
    success: true,
    count: 0,
    duplicates: [],
    options,
  });
}

