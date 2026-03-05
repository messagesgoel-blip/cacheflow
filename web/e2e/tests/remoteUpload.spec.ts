import { test, expect } from '@playwright/test';
import { AutoPlacementEngine } from '../../../lib/placement/autoPlacementEngine';

/**
 * Task 4.15: E2E remote upload + placement tests
 * Gate: TRANSFER-1
 * Contracts: 4.12, 4.13
 */

test.describe('Remote Upload + Auto Placement', () => {
  test('TRANSFER-1: remote upload succeeds with local source URL and provider target', async ({ request }) => {
    const response = await request.post('/api/remote-upload', {
      headers: {
        Cookie: 'accessToken=mock-jwt-token',
      },
      data: {
        url: 'http://localhost:3000/manifest.json',
        provider: 'aws_s3',
        filename: 'manifest-copy.json',
        metadata: {
          task: '4.15',
          flow: 'e2e',
        },
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.provider).toBe('aws_s3');
    expect(body.fileId).toContain('s3://');
    expect(body.fileId).toContain('/manifest-copy.json');
    expect(typeof body.size).toBe('number');
    expect(body.size).toBeGreaterThanOrEqual(0);
    expect(body.contentType).toContain('application/json');
    expect(Number.isNaN(Date.parse(body.uploadedAt))).toBe(false);
  });

  test('TRANSFER-1: remote upload rejects malformed URL input', async ({ request }) => {
    const response = await request.post('/api/remote-upload', {
      headers: {
        Cookie: 'accessToken=mock-jwt-token',
      },
      data: {
        url: 'not-a-valid-url',
        provider: 'aws_s3',
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body).toEqual({ error: 'Invalid URL format' });
  });

  test('TRANSFER-1: auto placement selects a suitable ready node', async () => {
    const engine = new AutoPlacementEngine();

    const resource = {
      id: 'res-web-1',
      name: 'web-server',
      requirements: {
        cpu: 2,
        memory: 2048,
        storage: 10240,
        ports: [80, 443],
      },
      constraints: {
        nodeSelector: {
          environment: 'production',
        },
      },
      priority: 10,
    };

    const nodes = [
      {
        id: 'node-prod-1',
        name: 'prod-1',
        capacity: { cpu: 8, memory: 16384, storage: 200000, gpu: 0, ports: [80, 443, 3000] },
        available: { cpu: 6, memory: 12288, storage: 180000, gpu: 0, ports: [80, 443, 3000] },
        labels: { environment: 'production', region: 'us-east' },
        status: 'ready' as const,
      },
      {
        id: 'node-staging-1',
        name: 'staging-1',
        capacity: { cpu: 16, memory: 32768, storage: 500000, gpu: 0, ports: [80, 443, 3000] },
        available: { cpu: 16, memory: 32768, storage: 500000, gpu: 0, ports: [80, 443, 3000] },
        labels: { environment: 'staging', region: 'us-east' },
        status: 'ready' as const,
      },
    ];

    const result = engine.placeResource(resource, nodes);

    expect(result.nodeId).toBe('node-prod-1');
    expect(result.resourceName).toBe('web-server');
    expect(result.score).toBeGreaterThan(0);
    expect(result.reason).toContain('Node selector labels match');
    expect(result.placements).toHaveLength(1);
    expect(result.placements[0]).toMatchObject({
      resourceId: 'res-web-1',
      nodeId: 'node-prod-1',
    });
  });

  test('TRANSFER-1: auto placement reports conflicts when resources cannot be placed', async () => {
    const engine = new AutoPlacementEngine();

    const resources = [
      {
        id: 'res-priority-ok',
        name: 'api-service',
        requirements: { cpu: 2, memory: 2048, storage: 1024 },
        priority: 100,
      },
      {
        id: 'res-too-large',
        name: 'huge-batch-job',
        requirements: { cpu: 64, memory: 131072, storage: 1024 },
        priority: 1,
      },
    ];

    const nodes = [
      {
        id: 'node-small-1',
        name: 'small-1',
        capacity: { cpu: 8, memory: 16384, storage: 100000, gpu: 0, ports: [80, 443] },
        available: { cpu: 8, memory: 16384, storage: 100000, gpu: 0, ports: [80, 443] },
        labels: { environment: 'production' },
        status: 'ready' as const,
      },
    ];

    const result = engine.placeMultiple(resources, nodes);

    expect(result.resourceName).toBe('1 of 2 resources placed');
    expect(result.placements).toHaveLength(2);

    const successful = result.placements.find((p) => p.resourceId === 'res-priority-ok');
    expect(successful).toBeDefined();
    expect(successful?.nodeId).toBe('node-small-1');
    expect(successful?.score).toBeGreaterThan(0);

    const conflicted = result.placements.find((p) => p.resourceId === 'res-too-large');
    expect(conflicted).toBeDefined();
    expect(conflicted?.nodeId).toBe('');
    expect(conflicted?.score).toBe(0);
    expect(conflicted?.conflicts?.[0]).toContain('PLACEMENT_FAILED_INSUFFICIENT_RESOURCES');
  });
});
