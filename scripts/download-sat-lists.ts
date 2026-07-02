import { prisma } from '../src/lib/prisma';
import { downloadSATList, cacheSATList } from '../src/lib/sat-client';
import { SATListType } from '../src/types/sat.types';

const listTypes: SATListType[] = ['list_69', 'list_69_b', 'list_69_b_bis', 'list_49_bis'];

async function main() {
  console.log('--- STARTING SAT LIST DOWNLOAD & CACHE JOB ---');
  console.log(`Timestamp: ${new Date().toISOString()}`);

  for (const listType of listTypes) {
    console.log(`\n[${listType}] Starting download...`);
    try {
      const startTime = Date.now();
      const rfcs = await downloadSATList(listType);
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log(`[${listType}] Successfully downloaded ${rfcs.length} RFCs in ${duration}s.`);

      console.log(`[${listType}] Caching in database...`);
      await cacheSATList(listType, rfcs, prisma);
      console.log(`[${listType}] Cache update successful.`);
    } catch (error: any) {
      console.error(`[${listType}] FAILED to update list:`, error.message || error);
    }
  }

  console.log('\n--- SAT LIST DOWNLOAD & CACHE JOB COMPLETE ---');
}

main()
  .catch((e) => {
    console.error('Fatal error in SAT download script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
