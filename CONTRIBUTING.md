# Contributing to incognito-dev

Thanks for your interest in contributing! 🕶️

## Getting Started

```bash
git clone https://github.com/clicelee/incognito-dev.git
cd incognito-dev
npm test
```

- Requires Node.js 20.12 or newer.
- The whole CLI lives in `bin/index.js` — zero runtime dependencies, and we'd like to keep it that way.

## Making Changes

1. Fork the repo and create a branch from `main`.
2. Make your change.
3. Run `npm test` and make sure all tests pass (add a test if you're changing `detectPort`, package manager detection, or arg parsing).
4. Open a pull request with a short description of what and why.

## Reporting Bugs

Open an issue at https://github.com/clicelee/incognito-dev/issues with:

- Your OS and Node.js version
- The dev server you're using (Vite, Next.js, etc.)
- What happened vs. what you expected

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
