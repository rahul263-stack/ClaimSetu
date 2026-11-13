// Builds reports/<name>.pdf from reports/<name>.md using Chrome or Edge in headless mode.
// Usage: node tools/build-report-pdf.js [markdown file]   (default: the product report)
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.join(__dirname, '..');
const md = path.resolve(process.argv[2] || path.join(root, 'reports', 'India AI operations platform idea.md'));
const pdf = md.replace(/\.md$/i, '.pdf');
const browsers = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
const browser = browsers.find(b => fs.existsSync(b));
if (!browser) { console.error('No Chrome or Edge found. Set CHROME_PATH to a browser executable.'); process.exit(1); }

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'report-'));
const html = path.join(tmp, 'report.html');
try {
  execFileSync(process.execPath, [path.join(__dirname, 'md-to-html.js'), md, html], { stdio: 'inherit' });
  execFileSync(browser, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${pdf}`, pathToFileURL(html).href], { stdio: 'ignore', timeout: 90000 });
  console.log('wrote', pdf);
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
