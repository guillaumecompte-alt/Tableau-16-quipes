const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const staged = path.join(root, 'desktop-package');
const built = path.join(root, 'dist-desktop');
const electronSource = path.join(root, 'electron');

if (!fs.existsSync(path.join(built, 'desktop.html'))) {
  throw new Error('Le build desktop est absent. Exécutez d’abord npm run desktop:build.');
}

fs.rmSync(staged, { recursive: true, force: true });
fs.mkdirSync(staged, { recursive: true });
fs.cpSync(built, path.join(staged, 'dist-desktop'), { recursive: true });
fs.cpSync(electronSource, path.join(staged, 'electron'), { recursive: true });

const rootPackage = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const runtimePackage = {
  name: 'ze-padel-desktop-runtime',
  version: rootPackage.version || '1.0.0',
  private: true,
  main: 'electron/main.cjs',
  description: 'Application locale ZE PADEL pour Windows',
};
fs.writeFileSync(
  path.join(staged, 'package.json'),
  JSON.stringify(runtimePackage, null, 2) + '\n',
  'utf8',
);
console.log('Package desktop prêt dans desktop-package/.');
