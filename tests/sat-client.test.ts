import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import * as satClient from '@/lib/sat-client';

describe('SAT Client Unit Tests (English)', () => {
  let mockPrisma: any;
  let downloadSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();

    const db: Record<string, any> = {};
    mockPrisma = {
      sATListCache: {
        findUnique: vi.fn().mockImplementation(async ({ where }) => {
          return db[where.listType] || null;
        }),
        upsert: vi.fn().mockImplementation(async ({ where, update, create }) => {
          db[where.listType] = {
            id: `cache_${where.listType}`,
            listType: where.listType,
            data: create.data,
            downloadedAt: create.downloadedAt,
            source: create.source,
          };
          return db[where.listType];
        }),
      },
    } as unknown as PrismaClient;

    // Spy on internal module functions
    downloadSpy = vi.spyOn(satClient, 'downloadSATList').mockResolvedValue(['XAXX010101000']);
  });

  afterEach(() => {
    downloadSpy.mockRestore();
  });

  // 1. RFC found in 69-B list
  it('should identify an RFC listed in the SAT 69-B CFF blacklist', async () => {
    const blacklistedRfc = 'BADRFC123456';

    downloadSpy.mockImplementation(async (listType: string) => {
      if (listType === 'list_69_b') {
        return [blacklistedRfc];
      }
      return [];
    });

    const result = await satClient.checkRfcInSatLists(blacklistedRfc, mockPrisma);

    expect(result.signals.list_69b).toBe(true);
    expect(result.signals.list_69b_bis).toBe(false);
    expect(result.recommendation).toContain('Block approval immediately');
  });

  // 2. Clean RFC: RFC not in any list -> all found = false
  it('should return found=false for all lists when RFC is clean', async () => {
    const cleanRfc = 'GOODRFC123456';
    downloadSpy.mockResolvedValue([]);

    const result = await satClient.checkRfcInSatLists(cleanRfc, mockPrisma);

    expect(result.signals.list_69b).toBe(false);
    expect(result.signals.not_located).toBe(false);
    expect(result.checks.every(c => c.found === false)).toBe(true);
  });

  // 3. Cache hit: Second call uses cached data
  it('should hit the database cache and avoid downloading if within 24 hours', async () => {
    const rfc = 'TESTCACHE123';
    downloadSpy.mockResolvedValue([rfc]);

    const result1 = await satClient.checkRfcInSatLists(rfc, mockPrisma);
    expect(downloadSpy).toHaveBeenCalledTimes(4); // 4 lists checked now (article_49_bis has no public list)

    downloadSpy.mockClear();

    const result2 = await satClient.checkRfcInSatLists(rfc, mockPrisma);
    expect(downloadSpy).toHaveBeenCalledTimes(0);

    expect(result1.signals.list_69b).toBe(true);
    expect(result2.signals.list_69b).toBe(true);
  });

  // 4. Cache expired
  it('should re-download the SAT lists if the cache is older than 24 hours', async () => {
    const rfc = 'TESTEXPIRED';

    const expiredDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
    mockPrisma.sATListCache.findUnique.mockResolvedValue({
      id: 'cache_list_69_b',
      listType: 'list_69_b',
      data: [rfc],
      downloadedAt: expiredDate,
      source: satClient.SOURCE_URLS.list_69_b,
    });

    downloadSpy.mockResolvedValue([rfc]);

    await satClient.checkRfcInSatLists(rfc, mockPrisma);
    expect(downloadSpy).toHaveBeenCalled();
  });

  // 5. Error handling
  it('should fall back to using expired cache data if a remote download fails', async () => {
    const rfc = 'TESTFALLBACK';
    const expiredDate = new Date(Date.now() - 30 * 60 * 60 * 1000);

    mockPrisma.sATListCache.findUnique.mockResolvedValue({
      id: 'cache_list_69_b',
      listType: 'list_69_b',
      data: [rfc],
      downloadedAt: expiredDate,
      source: satClient.SOURCE_URLS.list_69_b,
    });

    downloadSpy.mockRejectedValue(new Error('SAT Server Down'));

    const result = await satClient.checkRfcInSatLists(rfc, mockPrisma);

    expect(result.signals.list_69b).toBe(true);
  });

  // 6. All lists checked
  it('should verify all 5 SAT list types are queried', async () => {
    downloadSpy.mockResolvedValue([]);
    const result = await satClient.checkRfcInSatLists('SOMETESTRFC12', mockPrisma);

    expect(result.checks).toHaveLength(5);
    const checkedTypes = result.checks.map(c => c.listType);
    expect(checkedTypes).toContain('list_69_not_located');
    expect(checkedTypes).toContain('list_69_b');
    expect(checkedTypes).toContain('list_69_b_bis');
    expect(checkedTypes).toContain('csd_revoked');
    expect(checkedTypes).toContain('article_49_bis');
  });

  // 7. Metadata stored
  it('should populate correct metadata fields (source, checkedAt, reference) for each check', async () => {
    downloadSpy.mockResolvedValue([]);
    const result = await satClient.checkRfcInSatLists('SOMETESTRFC12', mockPrisma);

    result.checks.forEach(check => {
      if (check.listType !== 'article_49_bis') {
        expect(check.source).toBe(satClient.SOURCE_URLS[check.listType]);
      }
      expect(check.checkedAt).toBeInstanceOf(Date);
      expect(check.reference).toBe(`${check.listType}_list`);
      expect(check.rfc).toBe('SOMETESTRFC12');
      expect(check.fileId).toBe('temp_file');
    });
  });
});
