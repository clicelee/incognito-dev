#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const detect = require('detect-port');
const os = require('os');
const fs = require('fs');
const path = require('path');
const figlet = require('figlet');
const chalk = require('chalk');
const boxen = require('boxen');

const DEFAULT_PORT = 3000;

function getPackageManager() {
  const lockFiles = {
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
      console.log(chalk.cyan('🔍 Opening in Chrome Incognito mode...'));
      execSync(`osascript -e '${script}'`);
    } else if (platform === 'win32') {
      console.log(chalk.cyan('🔍 Opening in Chrome Incognito mode...'));
      execSync(`start chrome --new-window --incognito "${url}"`);
    } else {
      console.log(chalk.cyan('🔍 Opening in Chrome Incognito mode...'));
      execSync(`google-chrome --incognito --new-window "${url}"`);
    }
    console.log(chalk.green('✅ Browser launched successfully!'));
  } catch (error) {
    console.error(chalk.red(`❌ Failed to open browser: ${error.message}`));
    
    try {
      console.log(chalk.yellow(`⚠️ Trying alternative browsers...`));
      
      // Try alternative browsers by platform
      if (platform === 'darwin') {
        execSync(`open -a "Safari" "${url}"`);
        console.log(chalk.green('✅ URL opened in Safari.'));
      } else if (platform === 'win32') {
        execSync(`start microsoft-edge:${url}`);
        console.log(chalk.green('✅ URL opened in Microsoft Edge.'));
      } else {
        execSync(`firefox "${url}"`);
        console.log(chalk.green('✅ URL opened in Firefox.'));
      }
    } catch (fallbackError) {
      console.error(chalk.red(`❌ Could not open any browser: ${fallbackError.message}`));
      console.log(chalk.yellow(`ℹ️ Please open this URL manually: ${url}`));
    }
  }
}

(async () => {
  const pm = getPackageManager();

  // Check package.json and dev script
  const pkgPath = path.resolve(process.cwd(), 'package.json');
  if (!fs.existsSync(pkgPath)) {
    console.error(chalk.red('❌ Could not find package.json in the current directory.'));
    process.exit(1);
  }
  
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  if (!pkg.scripts || !pkg.scripts.dev) {
    console.error(chalk.red('❌ No "dev" script found in package.json.'));
    console.info(chalk.gray('→ Please define a "dev" script. Example: "dev": "vite"'));
    process.exit(1);
  }

  const command = getDevCommand(pm);

  const title = figlet.textSync('Incognito Start', {
    font: 'Slant',
    horizontalLayout: 'default',
    verticalLayout: 'default'
  });

  const message = `🕶️  ${chalk.bold('Incognito Dev Mode')}

` +
    chalk.green('✔ Dev Command: ') + chalk.white(`${command}`) + '\n' +
    chalk.cyan('✔ Browser: ') + chalk.white('Google Chrome (Incognito Mode)') + '\n';

  const box = boxen(message, {
    padding: 1,
    margin: 1,
    borderStyle: 'double',
    borderColor: 'cyan',
    title: '🚀 Launch Summary',
    titleAlignment: 'left'
  });

  console.log(chalk.yellow(title));
  console.log(box);

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
          console.log(chalk.green(`✔ Active port detected: ${port}`));
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
          console.log(chalk.green(`✔ Active port detected: ${port}`));
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
      console.log(chalk.red(`❌ Dev server exited with code ${code}.`));
    } else {
      console.log(chalk.green('✅ Dev server stopped successfully.'));
    }
    process.exit(code);
  });
  
  // Handle user Ctrl+C
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n👋 Shutting down Incognito Dev...'));
    devProcess.kill();
    process.exit(0);
  });
})();