const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { detectPort, stripAnsi, getPackageManager, getDevCommand, parseArgs } = require('../bin/index.js');

test('detectPort finds plain localhost URLs', () => {
  assert.strictEqual(detectPort('  ➜  Local:   http://localhost:5173/'), '5173');
  assert.strictEqual(detectPort('Server running at http://127.0.0.1:8080'), '8080');
  assert.strictEqual(detectPort('ready - started server on localhost:3000'), '3000');
});

test('detectPort finds ANSI-colored URLs (e.g. Vite with FORCE_COLOR)', () => {
  const colored = '\x1b[36mhttp://localhost:\x1b[1m5173\x1b[22m/\x1b[39m';
  assert.strictEqual(detectPort(colored), '5173');
});

test('detectPort works on a rolling buffer split across chunks', () => {
  let buffer = '';
  buffer += 'Local: http://localhost:';
  assert.strictEqual(detectPort(buffer), null);
  buffer += '4321/';
  assert.strictEqual(detectPort(buffer), '4321');
});

test('detectPort returns null when there is no local URL', () => {
  assert.strictEqual(detectPort('compiling...'), null);
  assert.strictEqual(detectPort(''), null);
});

test('stripAnsi removes color codes', () => {
  assert.strictEqual(stripAnsi('\x1b[32mgreen\x1b[39m'), 'green');
});

test('getDevCommand maps each package manager', () => {
  assert.strictEqual(getDevCommand('npm'), 'npm run dev');
  assert.strictEqual(getDevCommand('yarn'), 'yarn dev');
  assert.strictEqual(getDevCommand('pnpm'), 'pnpm dev');
  assert.strictEqual(getDevCommand('bun'), 'bun run dev');
});

test('getPackageManager detects the lockfile in cwd', (t) => {
  const cases = [
    ['bun.lock', 'bun'],
    ['bun.lockb', 'bun'],
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['package-lock.json', 'npm'],
  ];
  const originalCwd = process.cwd();
  t.after(() => process.chdir(originalCwd));

  for (const [lockFile, expected] of cases) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'incognito-dev-test-'));
    fs.writeFileSync(path.join(dir, lockFile), '');
    process.chdir(dir);
    assert.strictEqual(getPackageManager(), expected, `${lockFile} -> ${expected}`);
    process.chdir(originalCwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('getPackageManager defaults to npm without a lockfile', (t) => {
  const originalCwd = process.cwd();
  t.after(() => process.chdir(originalCwd));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'incognito-dev-test-'));
  process.chdir(dir);
  assert.strictEqual(getPackageManager(), 'npm');
  process.chdir(originalCwd);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('parseArgs handles browser flags and help', () => {
  assert.deepStrictEqual(parseArgs([]), { browser: 'chrome', help: false });
  assert.strictEqual(parseArgs(['--browser', 'edge']).browser, 'edge');
  assert.strictEqual(parseArgs(['-b', 'brave']).browser, 'brave');
  assert.strictEqual(parseArgs(['--browser=brave']).browser, 'brave');
  assert.strictEqual(parseArgs(['--help']).help, true);
  assert.strictEqual(parseArgs(['-h']).help, true);
});
