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

function openIncognito(url) {
  const platform = os.platform();
  
  try {
    if (platform === 'darwin') {
      // Improved AppleScript for macOS
      const script = `
        tell application "Google Chrome"
          activate
          set incognitoWindow to make new window with properties {mode:"incognito"}
          set URL of active tab of incognitoWindow to "${url}"
        end tell
      `;
      console.log(styleText('cyan', '🔍 Opening in Chrome Incognito mode...'));
      execSync(`osascript -e '${script}'`);
    } else if (platform === 'win32') {
      console.log(styleText('cyan', '🔍 Opening in Chrome Incognito mode...'));
      execSync(`start chrome --new-window --incognito "${url}"`);
    } else {
      console.log(styleText('cyan', '🔍 Opening in Chrome Incognito mode...'));
      execSync(`google-chrome --incognito --new-window "${url}"`);
    }
    console.log(styleText('green', '✅ Browser launched successfully!'));
  } catch (error) {
    console.error(styleText('red', `❌ Failed to open browser: ${error.message}`));
    
    try {
      console.log(styleText('yellow', `⚠️ Trying alternative browsers...`));
      
      // Try alternative browsers by platform
      if (platform === 'darwin') {
        execSync(`open -a "Safari" "${url}"`);
        console.log(styleText('green', '✅ URL opened in Safari.'));
      } else if (platform === 'win32') {
        execSync(`start microsoft-edge:${url}`);
        console.log(styleText('green', '✅ URL opened in Microsoft Edge.'));
      } else {
        execSync(`firefox "${url}"`);
        console.log(styleText('green', '✅ URL opened in Firefox.'));
      }
    } catch (fallbackError) {
      console.error(styleText('red', `❌ Could not open any browser: ${fallbackError.message}`));
      console.log(styleText('yellow', `ℹ️ Please open this URL manually: ${url}`));
    }
  }
}

(async () => {
  const pm = getPackageManager();

  // Check package.json and dev script
  const pkgPath = path.resolve(process.cwd(), 'package.json');
  if (!fs.existsSync(pkgPath)) {
    console.error(styleText('red', '❌ Could not find package.json in the current directory.'));
    process.exit(1);
  }
  
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
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
    styleText('cyan', '✔ Browser: ') + styleText('white', 'Google Chrome (Incognito Mode)'),
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

  const URL_PATTERN = /(?:localhost|127\.0\.0\.1):(\d+)/;

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
    const match = outputBuffer.match(URL_PATTERN);
    if (match) {
      browserLaunched = true;
      clearTimeout(detectTimer);
      const port = match[1];
      console.log(styleText('green', `✔ Active port detected: ${port}`));
      openIncognito(`http://localhost:${port}`);
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
})();