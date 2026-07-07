#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { styleText } = require('util');

const BANNER = `    ____                             _ __           _____ __             __
   /  _/___  _________  ____ _____  (_) /_____     / ___// /_____ ______/ /_
   / // __ \\/ ___/ __ \\/ __ \`/ __ \\/ / __/ __ \\    \\__ \\/ __/ __ \`/ ___/ __/
 _/ // / / / /__/ /_/ / /_/ / / / / / /_/ /_/ /   ___/ / /_/ /_/ / /  / /_
/___/_/ /_/\\___/\\____/\\__, /_/ /_/_/\\__/\\____/   /____/\\__/\\__,_/_/   \\__/
                     /____/                                                 `;

const ANSI_RE = /\x1b\[[0-9;]*m/g;
const stripAnsi = (text) => text.replace(ANSI_RE, '');

const URL_PATTERN = /(?:localhost|127\.0\.0\.1):(\d+)/;

// Returns the port from the first local URL found in the text, or null
function detectPort(text) {
  const match = stripAnsi(text).match(URL_PATTERN);
  return match ? match[1] : null;
}

function renderBox(title, lines) {
  const width = Math.max(...lines.map((l) => stripAnsi(l).length), title.length) + 2;
  const border = (s) => styleText('cyan', s);
  const row = (l) => border('║ ') + l + ' '.repeat(width - stripAnsi(l).length) + border(' ║');
  return [
    border(`╔═ ${title} ${'═'.repeat(width - title.length - 1)}╗`),
    row(''),
    ...lines.map(row),
    row(''),
    border(`╚${'═'.repeat(width + 2)}╝`),
  ].join('\n');
}

function getPackageManager() {
  const lockFiles = {
    'bun.lock': 'bun',
    'bun.lockb': 'bun',
    'pnpm-lock.yaml': 'pnpm',
    'yarn.lock': 'yarn',
    'package-lock.json': 'npm',
  };
  for (const [file, pm] of Object.entries(lockFiles)) {
    if (fs.existsSync(path.join(process.cwd(), file))) return pm;
  }
  return 'npm';
}

function getDevCommand(pm) {
  const map = {
    bun: 'bun run dev',
    pnpm: 'pnpm dev',
    yarn: 'yarn dev',
    npm: 'npm run dev'
  };
  return map[pm];
}

const BROWSERS = {
  chrome: {
    label: 'Google Chrome',
    macApp: 'Google Chrome',
    winCommand: 'chrome',
    linuxCommands: ['google-chrome', 'google-chrome-stable', 'chromium'],
    privateFlag: '--incognito',
    privateLabel: 'Incognito Mode',
  },
  brave: {
    label: 'Brave',
    macApp: 'Brave Browser',
    winCommand: 'brave',
    linuxCommands: ['brave-browser', 'brave'],
    privateFlag: '--incognito',
    privateLabel: 'Private Mode',
  },
  edge: {
    label: 'Microsoft Edge',
    macApp: 'Microsoft Edge',
    winCommand: 'msedge',
    linuxCommands: ['microsoft-edge'],
    privateFlag: '--inprivate',
    privateLabel: 'InPrivate Mode',
  },
};

function parseArgs(argv) {
  const options = { browser: 'chrome', help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--browser' || arg === '-b') {
      options.browser = argv[++i];
    } else if (arg.startsWith('--browser=')) {
      options.browser = arg.slice('--browser='.length);
    } else {
      console.error(styleText('red', `❌ Unknown option: ${arg}`));
      console.info(styleText('gray', '→ Run incognito-dev --help for usage.'));
      process.exit(1);
    }
  }
  return options;
}

function printHelp() {
  console.log(`Usage: incognito-dev [options]

Runs your dev server and opens localhost in a private browser window.

Options:
  -b, --browser <name>  Browser to use: ${Object.keys(BROWSERS).join(', ')} (default: chrome)
  -h, --help            Show this help message`);
}

function openIncognito(url, browser) {
  const platform = os.platform();

  console.log(styleText('cyan', `🔍 Opening in ${browser.label} (${browser.privateLabel})...`));
  try {
    if (platform === 'darwin') {
      // open -na needs no automation permission, unlike AppleScript
      execSync(`open -na "${browser.macApp}" --args ${browser.privateFlag} --new-window "${url}"`);
    } else if (platform === 'win32') {
      execSync(`start "" ${browser.winCommand} ${browser.privateFlag} --new-window "${url}"`);
    } else {
      let opened = false;
      for (const cmd of browser.linuxCommands) {
        try {
          execSync(`${cmd} ${browser.privateFlag} --new-window "${url}" > /dev/null 2>&1 &`);
          opened = true;
          break;
        } catch {
          // try the next known binary name
        }
      }
      if (!opened) throw new Error(`could not launch any of: ${browser.linuxCommands.join(', ')}`);
    }
    console.log(styleText('green', '✅ Browser launched successfully!'));
  } catch (error) {
    console.error(styleText('red', `❌ Failed to open ${browser.label}: ${error.message}`));

    try {
      console.log(styleText('yellow', '⚠️ Falling back to your default browser (not private mode)...'));
      if (platform === 'darwin') {
        execSync(`open "${url}"`);
      } else if (platform === 'win32') {
        execSync(`start "" "${url}"`);
      } else {
        execSync(`xdg-open "${url}"`);
      }
      console.log(styleText('green', '✅ URL opened in your default browser.'));
    } catch (fallbackError) {
      console.error(styleText('red', `❌ Could not open any browser: ${fallbackError.message}`));
      console.log(styleText('yellow', `ℹ️ Please open this URL manually: ${url}`));
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const browser = BROWSERS[options.browser];
  if (!browser) {
    console.error(styleText('red', `❌ Unknown browser "${options.browser}". Available: ${Object.keys(BROWSERS).join(', ')}`));
    process.exit(1);
  }

  const pm = getPackageManager();

  // Check package.json and dev script
  const pkgPath = path.resolve(process.cwd(), 'package.json');
  if (!fs.existsSync(pkgPath)) {
    console.error(styleText('red', '❌ Could not find package.json in the current directory.'));
    process.exit(1);
  }
  
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  } catch (error) {
    console.error(styleText('red', `❌ Could not parse package.json: ${error.message}`));
    process.exit(1);
  }
  if (!pkg.scripts || !pkg.scripts.dev) {
    console.error(styleText('red', '❌ No "dev" script found in package.json.'));
    console.info(styleText('gray', '→ Please define a "dev" script. Example: "dev": "vite"'));
    process.exit(1);
  }

  const command = getDevCommand(pm);

  const box = renderBox('Launch Summary', [
    styleText('bold', 'Incognito Dev Mode'),
    '',
    styleText('green', '✔ Dev Command: ') + styleText('white', command),
    styleText('cyan', '✔ Browser: ') + styleText('white', `${browser.label} (${browser.privateLabel})`),
  ]);

  console.log(styleText('yellow', BANNER));
  console.log('\n' + box + '\n');

  // Detach on POSIX so the wrapper shell and the dev server share a process
  // group we can kill together — devProcess.kill() alone only kills the
  // shell and orphans the actual dev server.
  const isWindows = os.platform() === 'win32';
  const devProcess = spawn(command, {
    shell: true,
    stdio: ['inherit', 'pipe', 'pipe'],
    detached: !isWindows,
  });

  const stopDevServer = () => {
    if (isWindows) {
      try {
        execSync(`taskkill /pid ${devProcess.pid} /T /F`, { stdio: 'ignore' });
      } catch {
        devProcess.kill();
      }
    } else {
      try {
        process.kill(-devProcess.pid, 'SIGTERM');
      } catch {
        devProcess.kill('SIGTERM');
      }
    }
  };

  let browserLaunched = false;
  let outputBuffer = '';

  const detectTimer = setTimeout(() => {
    console.log(styleText('yellow', '⚠️ No local URL detected yet — the browser will still open automatically once your server prints one.'));
  }, 15000);
  detectTimer.unref();

  // The URL may arrive split across chunks or wrapped in ANSI colors,
  // so match against a rolling buffer of cleaned output.
  const forwardAndDetect = (chunk, stream) => {
    stream.write(chunk);
    if (browserLaunched) return;

    outputBuffer = (outputBuffer + stripAnsi(chunk.toString())).slice(-1000);
    const port = detectPort(outputBuffer);
    if (port) {
      browserLaunched = true;
      clearTimeout(detectTimer);
      console.log(styleText('green', `✔ Active port detected: ${port}`));
      openIncognito(`http://localhost:${port}`, browser);
    }
  };

  devProcess.stdout.on('data', (chunk) => forwardAndDetect(chunk, process.stdout));
  devProcess.stderr.on('data', (chunk) => forwardAndDetect(chunk, process.stderr));
  
  // Handle process termination (code is null when killed by a signal,
  // e.g. after our own shutdown — treat that as a clean stop)
  devProcess.on('close', (code) => {
    if (code) {
      console.log(styleText('red', `❌ Dev server exited with code ${code}.`));
    } else {
      console.log(styleText('green', '✅ Dev server stopped successfully.'));
    }
    process.exit(code ?? 0);
  });

  // Handle user Ctrl+C: stop the whole tree, then let the close event
  // above do the final exit (force-quit if the server hangs)
  process.on('SIGINT', () => {
    console.log(styleText('yellow', '\n👋 Shutting down Incognito Dev...'));
    stopDevServer();
    setTimeout(() => process.exit(0), 3000).unref();
  });
}

if (require.main === module) {
  main();
}

module.exports = { detectPort, stripAnsi, getPackageManager, getDevCommand, parseArgs };