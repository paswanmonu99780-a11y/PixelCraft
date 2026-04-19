const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, '..', 'build');
const indexPath = path.join(buildDir, 'index.html');
const notFoundPath = path.join(buildDir, '404.html');
const noJekyllPath = path.join(buildDir, '.nojekyll');

if (!fs.existsSync(indexPath)) {
  process.exit(0);
}

fs.copyFileSync(indexPath, notFoundPath);
fs.writeFileSync(noJekyllPath, '', 'utf8');
