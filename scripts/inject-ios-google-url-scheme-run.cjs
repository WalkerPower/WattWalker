/**
 * Runs inject-ios-google-url-scheme.py with python3 or python (local dev after cap sync).
 * If Python is missing, exits 0 with a warning so `cap sync` still completes.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const script = path.join(__dirname, 'inject-ios-google-url-scheme.py');
let foundInterpreter = false;
for (const bin of ['python3', 'python']) {
  const r = spawnSync(bin, [script], { stdio: 'inherit' });
  if (r.error) {
    if (r.error.code === 'ENOENT') continue;
    console.error(r.error);
    process.exit(1);
  }
  foundInterpreter = true;
  process.exit(r.status ?? 1);
}
if (!foundInterpreter) {
  console.warn(
    '[inject-ios-google-url-scheme] Python not found; skipped. iOS Google URL scheme is set on Codemagic or run with Python + VITE_GOOGLE_IOS_CLIENT_ID in .env.'
  );
}
process.exit(0);
