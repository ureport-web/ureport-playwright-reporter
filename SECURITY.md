# Security Policy

## Supported versions

Only the latest release on npm receives security fixes.

| Version | Supported |
|---|---|
| Latest | ✅ |
| Older | ❌ |

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report vulnerabilities privately via GitHub's [Security Advisories](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability) feature on this repository, or email the maintainer directly at **yizhongji@gmail.com**.

Include in your report:

- Description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept
- Affected versions (if known)

## What to expect

- Acknowledgement within 3 business days
- A fix or mitigation plan within 14 days for confirmed critical issues
- Credit in the release notes if you wish

## Scope

This package runs in CI environments and communicates with a UReport server using an API token. Security concerns most likely to apply:

- **API token exposure** — the token is passed via config; ensure it is stored as a CI secret, not committed to source control
- **Screenshot data** — when `includeScreenshots: true`, screenshots are base64-encoded and sent to your UReport server; ensure the server is access-controlled
- **Dependency vulnerabilities** — run `npm audit` to check; this package has no runtime dependencies
- **Malicious test output** — the reporter serialises test names and error messages into JSON payloads; if your test input is untrusted, validate it before it reaches your UReport server
