// Version is read from package.json at build time
// This avoids hardcoding versions in multiple places

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory of this file, then navigate to package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packagePath = join(__dirname, '..', 'package.json');

let version = '0.0.0'; // fallback

try {
  const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
  version = pkg.version;
} catch {
  // Fallback if package.json can't be read (shouldn't happen in normal use)
}

export const VERSION = version;
