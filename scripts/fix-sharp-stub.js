// npm's "overrides" + "file:" protocol resolves sharp to a symlink, but the
// *target* it computes for that symlink is unreliable across platforms --
// on this Windows host it links to an absolute path (works here only), and
// inside a fresh Linux container it links to a wrong relative path
// (node_modules/@xenova/transformers/vendor/sharp-stub, which doesn't
// exist), breaking the install. Replacing whatever npm created with a
// plain physical copy sidesteps that symlink-resolution inconsistency
// entirely, on every platform.
const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'node_modules', 'sharp');
const stub = path.join(__dirname, '..', 'vendor', 'sharp-stub');

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });
fs.copyFileSync(path.join(stub, 'package.json'), path.join(target, 'package.json'));
fs.copyFileSync(path.join(stub, 'index.js'), path.join(target, 'index.js'));

console.log('Replaced node_modules/sharp with vendor/sharp-stub (physical copy).');
