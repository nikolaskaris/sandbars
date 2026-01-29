/**
 * Local development script to manually trigger cron jobs
 *
 * Usage:
 *   npx ts-node scripts/run-crons.ts [command]
 *
 * Commands:
 *   all         - Run all cron jobs in sequence
 *   stations    - Sync NDBC station list
 *   readings    - Sync latest buoy readings
 *   grid        - Compute wave grid
 *
 * Example:
 *   npx ts-node scripts/run-crons.ts all
 *   npx ts-node scripts/run-crons.ts stations
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET || '';

async function runCron(path: string, name: string) {
  console.log(`\n🔄 Running ${name}...`);
  const startTime = Date.now();

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: 'GET',
      headers: CRON_SECRET ? { Authorization: `Bearer ${CRON_SECRET}` } : {},
    });

    const data = await response.json();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    if (data.success) {
      console.log(`✅ ${name} completed in ${duration}s`);
      console.log(`   ${JSON.stringify(data, null, 2)}`);
    } else {
      console.log(`❌ ${name} failed: ${data.error}`);
    }

    return data;
  } catch (error) {
    console.log(`❌ ${name} error: ${error}`);
    return { success: false, error: String(error) };
  }
}

async function main() {
  const command = process.argv[2] || 'all';

  console.log(`\n🚀 Sandbars Cron Runner`);
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Command: ${command}`);

  switch (command) {
    case 'stations':
      await runCron('/api/cron/sync-stations', 'Sync Stations');
      break;

    case 'readings':
      await runCron('/api/cron/sync-readings', 'Sync Readings');
      break;

    case 'grid':
      await runCron('/api/cron/compute-grid', 'Compute Grid');
      break;

    case 'all':
      // Run in sequence with dependencies
      console.log('\n📋 Running all cron jobs in sequence...');

      await runCron('/api/cron/sync-stations', 'Sync Stations');
      await runCron('/api/cron/sync-readings', 'Sync Readings');
      await runCron('/api/cron/compute-grid', 'Compute Grid');

      console.log('\n✨ All cron jobs completed!');
      break;

    default:
      console.log(`\n❓ Unknown command: ${command}`);
      console.log('   Available commands: all, stations, readings, grid');
  }
}

main().catch(console.error);
