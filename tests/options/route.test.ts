import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const FAKE_ROWS = [
  {
    instrument_name: 'BTC-26SEP26-100000-C',
    mark_iv: 50,
    open_interest: 10,
    bid_price: 0.001,
    ask_price: 0.002,
    mark_price: 0.0015,
    underlying_price: 100000,
    volume_usd: 1000,
    base_currency: 'BTC',
  },
  {
    instrument_name: 'BTC-26SEP26-100000-P',
    mark_iv: 50,
    open_interest: 20,
    bid_price: 0.001,
    ask_price: 0.002,
    mark_price: 0.0015,
    underlying_price: 100000,
    volume_usd: 1000,
    base_currency: 'BTC',
  },
];

function mockFetch(): ReturnType<typeof vi.fn> {
  return vi.fn(async (url: string | URL | Request) => {
    const u = typeof url === 'string' ? url : url.toString();
    if (u.includes('get_book_summary_by_currency')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ result: FAKE_ROWS }),
      };
    }
    if (u.includes('get_index_price')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ result: { index_price: 100000 } }),
      };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  }) as unknown as ReturnType<typeof vi.fn>;
}

describe('GET /api/crypto/options/exposure', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('200 returns snapshot with computed levels', async () => {
    globalThis.fetch = mockFetch() as unknown as typeof globalThis.fetch;
    const cache = await import('../../src/app/api/crypto/options/exposure/route');
    const req = new Request(
      'https://test.local/api/crypto/options/exposure?symbol=BTC&expiryBucket=all',
    );
    const res = await cache.GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.source).toBe('deribit_public');
    expect(body.data.currency).toBe('BTC');
    expect(body.data.spot).toBe(100000);
    expect(body.data.freshness.status).toBe('live');
    expect(body.data.strikes.length).toBe(1);
    expect(body.data.strikes[0].strike).toBe(100000);
    expect(body.data.aggregate.totalOi).toBe(30);
    expect(body.data.warnings).toBeInstanceOf(Array);
  });

  it('400 on unsupported symbol (SOL)', async () => {
    globalThis.fetch = mockFetch() as unknown as typeof globalThis.fetch;
    const cache = await import('../../src/app/api/crypto/options/exposure/route');
    const req = new Request(
      'https://test.local/api/crypto/options/exposure?symbol=SOL',
    );
    const res = await cache.GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/unsupported symbol/);
  });

  it('400 on invalid expiryBucket', async () => {
    globalThis.fetch = mockFetch() as unknown as typeof globalThis.fetch;
    const cache = await import('../../src/app/api/crypto/options/exposure/route');
    const req = new Request(
      'https://test.local/api/crypto/options/exposure?symbol=BTC&expiryBucket=999d',
    );
    const res = await cache.GET(req);
    expect(res.status).toBe(400);
  });

  it('502 when fetch rejects', async () => {
    const failing = vi.fn(async () => {
      throw new Error('network down');
    });
    globalThis.fetch = failing as unknown as typeof globalThis.fetch;
    const cache = await import('../../src/app/api/crypto/options/exposure/route');
    const req = new Request(
      'https://test.local/api/crypto/options/exposure?symbol=BTC',
    );
    const res = await cache.GET(req);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/network down/);
  });

  it('cache hit avoids second fetch within TTL', async () => {
    const f = mockFetch();
    globalThis.fetch = f as unknown as typeof globalThis.fetch;
    const cache = await import('../../src/app/api/crypto/options/exposure/route');
    const url = 'https://test.local/api/crypto/options/exposure?symbol=BTC&expiryBucket=all';
    await cache.GET(new Request(url));
    await cache.GET(new Request(url));
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('history stub returns 404', async () => {
    const history = await import(
      '../../src/app/api/crypto/options/exposure/history/route'
    );
    const res = await history.GET();
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.available).toBe(false);
  });
});
