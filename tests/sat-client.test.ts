import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import * as satClient from '@/lib/sat-client';

describe('SAT Client Unit Tests', () => {
  let mockPrisma: any;
  let downloadSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Simple mock database
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
    
    // Mock download to return the blacklisted RFC for 69-B and a clean list for others
    downloadSpy.mockImplementation(async (listType: string) => {
      if (listType === 'list_69_b') {
        return [blacklistedRfc];
      }
      return [];
    });

    const result = await satClient.checkRfcInSatLists(blacklistedRfc, mockPrisma);

    expect(result.isBlacklisted).toBe(true);
    const check69B = result.checks.find(c => c.listType === 'list_69_b');
    expect(check69B?.found).toBe(true);

    const check69 = result.checks.find(c => c.listType === 'list_69');
    expect(check69?.found).toBe(false);
  });

  // 2. Clean RFC: RFC not in any list -> all found = false
  it('should return found=false for all lists when RFC is clean', async () => {
    const cleanRfc = 'GOODRFC123456';
    downloadSpy.mockResolvedValue([]);

    const result = await satClient.checkRfcInSatLists(cleanRfc, mockPrisma);

    expect(result.isBlacklisted).toBe(false);
    expect(result.checks.every(c => c.found === false)).toBe(true);
  });

  // 3. Cache hit: Second call uses cached data (verify downloadSATList called only once)
  it('should hit the database cache and avoid downloading the lists again if within 24 hours', async () => {
    const rfc = 'TESTCACHE123';
    downloadSpy.mockResolvedValue([rfc]);

    // First call (triggers download and upsert)
    const result1 = await satClient.checkRfcInSatLists(rfc, mockPrisma);
    expect(downloadSpy).toHaveBeenCalledTimes(4); // 4 lists checked

    // Reset spy counters
    downloadSpy.mockClear();

    // Second call (uses cached data, no downloads)
    const result2 = await satClient.checkRfcInSatLists(rfc, mockPrisma);
    expect(downloadSpy).toHaveBeenCalledTimes(0);

    expect(result1.isBlacklisted).toBe(true);
    expect(result2.isBlacklisted).toBe(true);
  });

  // 4. Cache expired: After 24h, re-downloads data
  it('should re-download the SAT lists if the cache is older than 24 hours', async () => {
    const rfc = 'TESTEXPIRED';
    
    // Manually pre-seed an expired cache
    const expiredDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
    mockPrisma.sATListCache.findUnique.mockResolvedValue({
      id: 'cache_list_69',
      listType: 'list_69',
      data: [rfc],
      downloadedAt: expiredDate,
      source: satClient.SOURCE_URLS.list_69,
    });

    downloadSpy.mockResolvedValue([rfc]);

    const result = await satClient.checkRfcInSatLists(rfc, mockPrisma);

    // Should call download for all list types since they are expired or missing
    expect(downloadSpy).toHaveBeenCalled();
  });

  // 5. Error handling: Network failure -> use cached data if available
  it('should fall back to using expired cache data if a remote download fails', async () => {
    const rfc = 'TESTFALLBACK';
    const expiredDate = new Date(Date.now() - 30 * 60 * 60 * 1000); // Expired cache (30 hours ago)

    mockPrisma.sATListCache.findUnique.mockResolvedValue({
      id: 'cache_list_69_b',
      listType: 'list_69_b',
      data: [rfc],
      downloadedAt: expiredDate,
      source: satClient.SOURCE_URLS.list_69_b,
    });

    // Make download throw an error (simulating offline/network fail)
    downloadSpy.mockRejectedValue(new Error('SAT Server Down'));

    const result = await satClient.checkRfcInSatLists(rfc, mockPrisma);

    // The check should still run, fall back gracefully to cache and find the blacklisted RFC
    const check69B = result.checks.find(c => c.listType === 'list_69_b');
    expect(check69B?.found).toBe(true);
    expect(result.isBlacklisted).toBe(true);
  });

  // 6. All lists checked
  it('should verify all 4 SAT list types are queried', async () => {
    downloadSpy.mockResolvedValue([]);
    const result = await satClient.checkRfcInSatLists('SOMETESTRFC12', mockPrisma);

    expect(result.checks).toHaveLength(4);
    const checkedTypes = result.checks.map(c => c.listType);
    expect(checkedTypes).toContain('list_69');
    expect(checkedTypes).toContain('list_69_b');
    expect(checkedTypes).toContain('list_69_b_bis');
    expect(checkedTypes).toContain('list_49_bis');
  });

  // 7. Metadata stored
  it('should populate correct metadata fields (source, checkedAt, reference) for each check', async () => {
    downloadSpy.mockResolvedValue([]);
    const result = await satClient.checkRfcInSatLists('SOMETESTRFC12', mockPrisma);

    result.checks.forEach(check => {
      expect(check.source).toBe(satClient.SOURCE_URLS[check.listType]);
      expect(check.checkedAt).toBeInstanceOf(Date);
      expect(check.reference).toBe(`${check.listType}_list`);
      expect(check.rfc).toBe('SOMETESTRFC12');
    });
  });
});
