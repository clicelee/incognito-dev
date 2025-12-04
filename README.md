# 🕶️ incognito-dev

A lightweight CLI tool that automatically runs your dev server and opens localhost in Google Chrome Incognito mode — no cache conflicts, no login sessions, just a clean slate every time.
[Click here](http://incognito-dev-docs.vercel.app/) to visit the official website.

./demo.mp4

---

## 🚀 Installation

```bash
npm install -g incognito-dev
# or use without install
npx incognito-dev
```

---

## 💡 Usage

⚠️ No more `npm run dev`, no more `yarn dev`!
Instead, just run:

```bash
incognito-dev
```

Your development server will automatically open in incognito mode - no more manual clicks or browser switching!

The tool will:
1. Detect your package manager (npm, yarn, or pnpm)
2. Run the appropriate dev command (npm run dev, etc.)
3. Find an available port (e.g., localhost:3000, localhost:3001)
4. Launch Google Chrome in incognito mode with the local server URL

---

## Before vs After

**Before:**
```bash
npm run dev
# Server starts, but you have to manually click the URL or copy-paste it
# ...and it opens in your current browser session with all cookies/history
```

**After:**
```bash
incognito-dev
# Everything happens automatically in incognito mode!
```

## ✅ Example Output

```bash
    ____                             _ __           _____ __             __ 
   /  _/___  _________  ____ _____  (_) /_____     / ___// /_____ ______/ /_
   / // __ \/ ___/ __ \/ __ `/ __ \/ / __/ __ \    \__ \/ __/ __ `/ ___/ __/
 _/ // / / / /__/ /_/ / /_/ / / / / / /_/ /_/ /   ___/ / /_/ /_/ / /  / /_  
/___/_/ /_/\___/\____/\__, /_/ /_/_/\__/\____/   /____/\__/\__,_/_/   \__/  
                     /____/

   ╔ 🚀 Launch Summary ════════════════════════════╗
   ║                                               ║
   ║   🕶️  Incognito Dev Mode                      ║
   ║                                               ║
   ║   ✔ Dev Server: npm → http://localhost:3000   ║
   ║   ✔ Browser: Google Chrome (Incognito Mode)   ║
   ║                                               ║
   ╚═══════════════════════════════════════════════╝
```

---

## ✨ Features

- Automatic port detection via [`detect-port`](https://www.npmjs.com/package/detect-port)
- Supports all major package managers: `npm`, `yarn`, `pnpm`
- Opens Chrome incognito mode — no history, no saved logins
- Great for testing login pages or clean sessions
- Works with various dev servers (Vite, Next.js, Create React App, etc.)


---

## 📦 Requirements

- A `dev` script must exist in your `package.json`:

```json
"scripts": {
  "dev": "vite"
}
```

---

## 📄 License

MIT

---

## 👨‍💻 Author

> Made with 🎲 by [@clicelee](https://github.com/clicelee)
