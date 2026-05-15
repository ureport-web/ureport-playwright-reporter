# Contributing to ureport-playwright-reporter

Thank you for your interest in contributing. This document covers how to get started, submit changes, and what to expect during review.

## Ways to contribute

- **Bug reports** — open an issue with a minimal reproduction
- **Feature requests** — open an issue describing the use case before writing code
- **Pull requests** — bug fixes, new features, documentation improvements
- **Documentation** — corrections, examples, clarifications

## Getting started

```bash
git clone https://github.com/your-org/ureport-playwright-reporter.git
cd ureport-playwright-reporter
npm install
npm run build
npm test
```

Requirements: Node.js >= 18.

## Development workflow

1. Fork the repo and create a branch from `main`:
   ```bash
   git checkout -b fix/my-bug-fix
   ```

2. Make your changes. Keep commits focused — one logical change per commit.

3. Run the full test suite before opening a PR:
   ```bash
   npm run build
   npm test                  # unit tests
   npm run test:integration  # integration tests (requires build)
   ```

4. Push your branch and open a pull request against `main`.

## Pull request guidelines

- **One PR per concern** — avoid bundling unrelated changes
- **Tests required** — new behaviour must be covered by tests; bug fixes should add a regression test
- **Keep the diff small** — the smaller and more focused the PR, the faster the review
- **Update the README** if your change affects behaviour or options visible to users
- **No breaking changes without discussion** — open an issue first if your change affects the public API

## Commit style

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add autoToken option
fix: handle timedOut status mapping
docs: clarify tag @ prefix behaviour
test: add step attachment integration test
```

## Reporting bugs

Open a GitHub issue and include:

- Package version (`npm list ureport-playwright-reporter`)
- Node.js version (`node --version`)
- Playwright version (`npm list @playwright/test`)
- Minimal reproduction — a snippet or repo that demonstrates the problem
- Expected vs actual behaviour

## Code style

- TypeScript strict mode is enabled — no `any` without a comment explaining why
- No runtime dependencies — keep the package lean; use only Node.js built-ins
- Unit tests live in `tests/`, integration tests in `tests/integration/`

## Questions

Open a GitHub Discussion or an issue tagged `question`.
