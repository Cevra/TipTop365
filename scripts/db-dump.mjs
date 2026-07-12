// Logical DB dump → Bunny storage (plan D21, nightly via .github/workflows/backup.yml).
// Usage: node scripts/db-dump.mjs <label>
//   needs: pg_dump on PATH, DATABASE_URL (or DIRECT_URL)
//   uploads only if BUNNY_STORAGE_ZONE + BUNNY_STORAGE_PASSWORD are set,
//   otherwise leaves the dump on disk and says so (no crash).
import { spawnSync } from 'node:child_process';
import { readFileSync, statSync, unlinkSync } from 'node:fs';

const label = process.argv[2] ?? 'manual';
const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('db-dump: DATABASE_URL/DIRECT_URL not set');
  process.exit(1);
}

const file = `tiptop-${label}.sql`;

const pg = spawnSync('pg_dump', [dbUrl, '-f', file, '--no-owner', '--no-privileges'], {
  stdio: 'inherit',
});
if (pg.error) {
  console.error('db-dump: pg_dump not found on PATH. Install postgresql-client.', pg.error.message);
  process.exit(1);
}
if (pg.status !== 0) {
  console.error(`db-dump: pg_dump exited ${pg.status}`);
  process.exit(pg.status ?? 1);
}
console.log(`db-dump: wrote ${file} (${statSync(file).size} bytes)`);

const zone = process.env.BUNNY_STORAGE_ZONE;
const password = process.env.BUNNY_STORAGE_PASSWORD;
if (!zone || !password) {
  console.log('db-dump: BUNNY_STORAGE_ZONE/PASSWORD not set — keeping local dump, skipping upload.');
  process.exit(0);
}

const host = process.env.BUNNY_STORAGE_HOST || 'storage.bunnycdn.com';
const res = await fetch(`https://${host}/${zone}/backups/${file}`, {
  method: 'PUT',
  headers: { AccessKey: password, 'Content-Type': 'application/octet-stream' },
  body: readFileSync(file),
});
if (!res.ok) {
  console.error(`db-dump: Bunny upload failed ${res.status}`);
  process.exit(1);
}
console.log(`db-dump: uploaded to Bunny backups/${file}`);
unlinkSync(file);
