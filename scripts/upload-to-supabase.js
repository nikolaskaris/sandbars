/**
 * Upload GeoJSON files to Supabase Storage
 *
 * Uploads wave forecast and buoy observation files to the "forecasts" bucket.
 * Files are overwritten on each upload.
 *
 * Usage: node scripts/upload-to-supabase.js
 *
 * Environment variables (checked in order):
 *   Local:  NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (from .env.local)
 *   CI:     SUPABASE_URL, SUPABASE_SERVICE_KEY
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Try to load .env.local for local development (optional in CI)
try {
  const dotenv = require('dotenv');
  dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
} catch {
  // dotenv not available or .env.local doesn't exist - that's fine in CI
}

// Support both local (.env.local) and CI environment variable names
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_NAME = 'forecasts';
const DATA_DIR = path.join(__dirname, '..', 'public', 'data');

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Error: Missing Supabase credentials');
  console.error('Required: SUPABASE_URL + SUPABASE_SERVICE_KEY (CI)');
  console.error('      or: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (.env.local)');
  process.exit(1);
}

// Initialize Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function getFilesToUpload() {
  const files = [];

  // Check if data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    console.error(`Error: Data directory not found: ${DATA_DIR}`);
    return files;
  }

  // Get all wave-data-f*.geojson files
  const allFiles = fs.readdirSync(DATA_DIR);
  for (const file of allFiles) {
    if (file.match(/^wave-data-f\d+\.geojson$/)) {
      files.push(file);
    }
  }

  // Add buoy-observations.geojson if it exists
  if (fs.existsSync(path.join(DATA_DIR, 'buoy-observations.geojson'))) {
    files.push('buoy-observations.geojson');
  }

  return files.sort();
}

async function uploadFile(fileName) {
  const filePath = path.join(DATA_DIR, fileName);
  const fileContent = fs.readFileSync(filePath);

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, fileContent, {
      contentType: 'application/json',
      upsert: true, // Overwrite if exists
    });

  if (error) {
    throw new Error(`Failed to upload ${fileName}: ${error.message}`);
  }

  return data;
}

async function main() {
  console.log('Uploading GeoJSON files to Supabase Storage...\n');
  console.log(`Bucket: ${BUCKET_NAME}`);
  console.log(`Source: ${DATA_DIR}\n`);

  const files = await getFilesToUpload();

  if (files.length === 0) {
    console.log('No files found to upload.');
    return;
  }

  console.log(`Found ${files.length} files to upload:\n`);

  let successCount = 0;
  let failCount = 0;

  for (const file of files) {
    try {
      process.stdout.write(`  Uploading ${file}... `);
      await uploadFile(file);
      console.log('done');
      successCount++;
    } catch (error) {
      console.log(`FAILED: ${error.message}`);
      failCount++;
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Uploaded ${successCount} files to Supabase Storage`);

  if (failCount > 0) {
    console.log(`Failed: ${failCount} files`);
    process.exit(1);
  }

  // Print example public URL
  if (successCount > 0) {
    const projectId = SUPABASE_URL.replace('https://', '').split('.')[0];
    console.log(`\nPublic URL format:`);
    console.log(`https://${projectId}.supabase.co/storage/v1/object/public/${BUCKET_NAME}/<filename>`);
  }

  // Exit with error if no files were uploaded
  if (successCount === 0) {
    console.error('No files were uploaded');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Upload failed:', error.message);
  process.exit(1);
});
