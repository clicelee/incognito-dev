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

  const devProcess = spawn(command, {
    shell: true,
    stdio: ['inherit', 'pipe', 'pipe'], // Pipe stderr too
  });

  // Define various URL patterns
  const urlPatterns = [
    /localhost:(\d+)/,
    /127\.0\.0\.1:(\d+)/,
    /Local:\s+https?:\/\/localhost:(\d+)/,
    /Running at\s+https?:\/\/localhost:(\d+)/,
    /http:\/\/localhost:(\d+)/
  ];

  let browserLaunched = false;

  // Monitor stdout
  devProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(output); // Show dev server output
    
    if (!browserLaunched) {
      for (const pattern of urlPatterns) {
        const match = output.match(pattern);
        if (match) {
          const port = match[1];
          const url = `http://localhost:${port}`;
          console.log(styleText('green', `✔ Active port detected: ${port}`));
          openIncognito(url);
          browserLaunched = true;
          break;
        }
      }
    }
  });
  
  // Monitor stderr
  devProcess.stderr.on('data', (data) => {
    const output = data.toString();
    console.error(output); // Show error output
    
    // Check URL patterns in stderr too (some dev servers output here)
    if (!browserLaunched) {
      for (const pattern of urlPatterns) {
        const match = output.match(pattern);
        if (match) {
          const port = match[1];
          const url = `http://localhost:${port}`;
          console.log(styleText('green', `✔ Active port detected: ${port}`));
          openIncognito(url);
          browserLaunched = true;
          break;
        }
      }
    }
  });
  
  // Handle process termination
  devProcess.on('close', (code) => {
    if (code !== 0) {
      console.log(styleText('red', `❌ Dev server exited with code ${code}.`));
    } else {
      console.log(styleText('green', '✅ Dev server stopped successfully.'));
    }
    process.exit(code);
  });
  
  // Handle user Ctrl+C
  process.on('SIGINT', () => {
    console.log(styleText('yellow', '\n👋 Shutting down Incognito Dev...'));
    devProcess.kill();
    process.exit(0);
  });
})();