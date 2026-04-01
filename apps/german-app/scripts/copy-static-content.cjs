const fs = require('fs');
const path = require('path');

const appRoot = path.join(__dirname, '..');
const repoRoot = path.join(appRoot, '..', '..');
const dist = path.join(appRoot, 'dist');

if (!fs.existsSync(dist)) {
  console.error('dist/ not found. Run: npx expo export -p web');
  process.exit(1);
}

for (const name of ['lws', 'grammar', 'other']) {
  const src = path.join(repoRoot, name);
  const dest = path.join(dist, name);
  if (!fs.existsSync(src)) {
    console.warn('Skip missing:', src);
    continue;
  }
  fs.cpSync(src, dest, { recursive: true });
  console.log('Copied', name, '→', dest);
}
