/**
 * Simple seed: creates default admin user.
 * Run: node scripts/seed.mjs
 */
import { createRequire } from 'module';
import { createHash } from 'crypto';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Use sqlite3 directly
const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '../prisma/dev.db');

// Hash using bcrypt-like hash (we'll use a built-in node crypto sha256
// and store it in a way compatible with bcryptjs)
// Actually, we'll use the @node-rs/bcrypt or just use a direct approach
// Since we can't easily use bcryptjs in ESM, we'll call the prisma seed differently.
console.log('DB path:', dbPath);
