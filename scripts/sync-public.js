import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const publicDir = path.join(rootDir, 'public');
const adminDir = path.join(publicDir, 'admin');
const portalDir = path.join(publicDir, 'portal');

fs.mkdirSync(adminDir, { recursive: true });
fs.mkdirSync(portalDir, { recursive: true });

// Sync admin panel
const adminSrc = path.join(rootDir, 'admin-panel', 'index.html');
if (fs.existsSync(adminSrc)) {
  fs.copyFileSync(adminSrc, path.join(adminDir, 'index.html'));
  console.log('[Sync] admin-panel/index.html -> public/admin/index.html');
}

// Sync demo portal
const portalSrc = path.join(rootDir, 'demo-portal', 'index.html');
if (fs.existsSync(portalSrc)) {
  fs.copyFileSync(portalSrc, path.join(portalDir, 'index.html'));
  fs.copyFileSync(portalSrc, path.join(publicDir, 'index.html'));
  console.log('[Sync] demo-portal/index.html -> public/portal/index.html & public/index.html');
}

console.log('[Sync] Static public web assets ready for Vercel deployment.');
