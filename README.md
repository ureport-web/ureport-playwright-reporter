# ureport-playwright-reporter

A Playwright reporter that automatically ships test results to [UReport](https://github.com/ureport-web/ureport-standalone).

## Install

```bash
npm install -D ureport-playwright-reporter
```

## Configuration

### Minimal config

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  reporter: [
    ["list"],
    [
      "ureport-playwright-reporter",
      {
        serverUrl: process.env.UREPORT_URL, // e.g. "http://localhost:4100"
        apiToken: process.env.UREPORT_API_TOKEN, // API token from UReport user settings
        product: "MyApp",
        type: "E2E",
      },
    ],
  ],
});
```

> **Getting your API token:** In UReport, go to **User Settings → API Token** and generate a token. Store it as an environment variable — never commit it to source control.

### Full config (all options)

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  reporter: [
    ["list"],
    [
      "ureport-playwright-reporter",
      {
        // --- required ---
        serverUrl: process.env.UREPORT_URL,
        apiToken: process.env.UREPORT_API_TOKEN,
        product: "MyApp",
        type: "E2E", // 'E2E' | 'UI' | 'API' | any string

        // --- build metadata ---
        buildNumber: process.env.BUILD_NUMBER, // defaults to Date.now()
        team: "Frontend Team",
        browser: "CHROME", // overrides auto-detection
        device: "MOBILE-PIXEL 5", // overrides auto-detection
        platform: "linux", // overrides auto-detection
        platform_version: "22.04", // overrides auto-detection
        stage: "staging",
        version: "1.4.2",

        // --- environment & settings (auto-detected from Playwright config) ---
        environments: { baseURL: "https://staging.example.com" },
        settings: { timeout: 30000, retries: 2, workers: 4 },

        // --- payload control ---
        batchSize: 50, // test results per POST (default: 50)
        includeSteps: true, // send step-level detail (default: true)
        includeScreenshots: true, // embed screenshots as base64 (default: true)
        saveRelations: true, // save test relations after build (default: true)

        // --- test transform (optional) ---
        testTransform: (testCase, ctx) => {
          // extract structured data from test name or compute a cleaner display name
          return {};
        },
      },
    ],
  ],
});
```

### All options

| Option                 | Type                      | Required | Default       | Description                                                                                                                                                                                                                                            |
| ---------------------- | ------------------------- | -------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `serverUrl`            | `string`                  | Yes      | —             | UReport server base URL                                                                                                                                                                                                                                |
| `apiToken`             | `string`                  | Yes      | —             | API token from UReport user settings                                                                                                                                                                                                                   |
| `product`              | `string`                  | Yes      | —             | Product name in UReport                                                                                                                                                                                                                                |
| `type`                 | `string`                  | Yes      | —             | Build type, e.g. `"E2E"`, `"UI"`, `"API"`                                                                                                                                                                                                              |
| `buildNumber`          | `string \| number`        | No       | `Date.now()`  | CI build number                                                                                                                                                                                                                                        |
| `team`                 | `string`                  | No       | —             | Team name                                                                                                                                                                                                                                              |
| `browser`              | `string`                  | No       | auto-detected | Browser name (e.g. `"CHROME"`, `"FIREFOX"`)                                                                                                                                                                                                            |
| `device`               | `string`                  | No       | auto-detected | Device name (e.g. `"MOBILE-PIXEL 5"`, `"DESKTOP-WINDOWS"`)                                                                                                                                                                                             |
| `platform`             | `string`                  | No       | auto-detected | OS platform                                                                                                                                                                                                                                            |
| `platform_version`     | `string`                  | No       | auto-detected | OS version string (from `os.release()`)                                                                                                                                                                                                                |
| `stage`                | `string`                  | No       | —             | Deployment stage, e.g. `"staging"`, `"prod"`                                                                                                                                                                                                           |
| `version`              | `string`                  | No       | —             | Application version under test                                                                                                                                                                                                                         |
| `batchSize`            | `number`                  | No       | `50`          | Number of test results per POST request                                                                                                                                                                                                                |
| `includeSteps`         | `boolean`                 | No       | `true`        | Send step-level detail to UReport                                                                                                                                                                                                                      |
| `includeScreenshots`   | `boolean`                 | No       | `true`        | Embed screenshots as base64 in step payloads                                                                                                                                                                                                           |
| `environments`         | `Record<string, unknown>` | No       | auto-detected | Environment metadata. Auto-detected from `use.baseURL`                                                                                                                                                                                                 |
| `settings`             | `Record<string, unknown>` | No       | auto-detected | Run settings. Auto-detected from `timeout`/`retries`/`workers`                                                                                                                                                                                         |
| `autoDetectPlatform`   | `boolean`                 | No       | `true`        | Set to false to disable auto-detection of platform and platform_version                                                                                                                                                                                |
| `saveRelations`        | `boolean`                 | No       | `true`        | Save test relation records after the build                                                                                                                                                                                                             |
| `quickInfoAnnotations` | `string[]`                | No       | `[]`          | Annotation types treated as execution-specific quick info. Values are stored per-test-run in `test.info.quickInfo` and surfaced in the UReport test detail view with a one-click copy button. Never saved to test relations (values differ every run). |
| `testTransform`        | `function`                | No       | —             | Optional function called for every test before mapping. Return `name` to override the display name and UID; return `relations` to inject custom key/value pairs into the test relation's `customs`. See [testTransform](#testtransform). |

---

## Annotating tests

### Tags

Tags let you categorise tests (e.g. smoke, regression). Use Playwright's built-in tag syntax:

```ts
test(
  "login with valid credentials",
  { tag: ["@smoke", "@auth"] },
  async ({ page }) => {
    // ...
  },
);
```

Or embed tags directly in the test title:

```ts
test("checkout flow @smoke @regression", async ({ page }) => {
  // ...
});
```

Both styles are picked up automatically — no extra config needed.

### Components

Associate a test with one or more components. Use the `components` annotation type — you can add multiple:

```ts
test(
  "add item to cart",
  {
    annotation: [
      { type: "components", description: "cart" },
      { type: "components", description: "product-page" },
    ],
  },
  async ({ page }) => {
    // ...
  },
);
```

### Teams

Associate a test with one or more teams:

```ts
test(
  "payment flow",
  {
    annotation: [
      { type: "teams", description: "checkout-team" },
      { type: "teams", description: "payments-team" },
    ],
  },
  async ({ page }) => {
    // ...
  },
);
```

### Combining tags, components, and teams

All annotation types can be combined freely:

```ts
test(
  "user registration @smoke",
  {
    annotation: [
      { type: "components", description: "auth" },
      { type: "components", description: "onboarding" },
      { type: "teams", description: "growth-team" },
    ],
  },
  async ({ page }) => {
    // ...
  },
);
```

### Custom metadata

Any annotation type other than the reserved ones (`components`, `teams`, `ureport-uid`) becomes freeform metadata stored on the test relation. Useful for linking to issue trackers or tracking ownership:

```ts
test(
  "password reset",
  {
    annotation: [
      { type: "jira", description: "AUTH-42" },
      { type: "owner", description: "alice" },
      { type: "components", description: "auth" },
    ],
  },
  async ({ page }) => {
    // ...
  },
);
```

### Quick Info

**Quick Info** is for execution-specific values you want instantly accessible in the UReport test detail view — things like a trace URL, a log link, a distributed-trace ID, or a session token. Each item appears as a labelled row with a copy-to-clipboard button, so you can jump straight from a failed test to the relevant trace or log without hunting through CI output.

Because these values change every run they are **never** persisted in test relations.

```ts
// playwright.config.ts
quickInfoAnnotations: ["trace_url", "session_id", "log_url"];

// in a test (or a beforeEach / fixture):
test.info().annotations.push({
  type: "trace_url",
  description: `https://trace.playwright.dev/?trace=${traceUrl}`,
});
test.info().annotations.push({ type: "session_id", description: sessionId });
test.info().annotations.push({
  type: "log_url",
  description: `https://logs.example.com/runs/${runId}`,
});
```

### testTransform

`testTransform` is an optional function that runs for every test before it is mapped to a UReport payload. Use it to extract structured data from the test name (e.g. a company code embedded in the title) or to compute a cleaner display name — without needing to add annotations to every test.

```ts
// playwright.config.ts
reporter: [
  [
    "ureport-playwright-reporter",
    {
      browser: "chrome",
      testTransform: (testCase, ctx) => {
        // e.g. title: "4Y-425 canvasSsfBiddingTest-Cash-1pax-1segment"
        const match = testCase.title.match(/^(\w+)-(\d+)\s+(.+)/);
        if (!match) return {};
        return {
          // Overrides both the display name and the UID for this test
          name: `[${match[1]}] ${match[3]} | ${ctx.browser}`,
          // "[4Y] canvasSsfBiddingTest-Cash-1pax-1segment | chrome"
          relations: {
            companyCode: match[1], // "4Y"  → stored in customs.companyCode
            companyId: match[2],   // "425" → stored in customs.companyId
          },
        };
      },
    },
  ],
];
```

**Priority rules:**

- `name` — overrides both the display name and the UID. A `ureport-uid` annotation on the test always takes precedence over the transformed name for the UID.
- `relations` — keys are seeded into `info` *before* the annotation loop, so an annotation with the same key will override the transform value.
- The second argument `ctx` exposes the build-level fields set in options: `browser`, `device`, `platform`, `platform_version`, `stage`, `version`, `team`.

---

### Override test UID

By default the reporter generates a stable UID from the test file path and title. Override it to pin a test to a known identifier:

```ts
test(
  "login flow",
  {
    annotation: { type: "ureport-uid", description: "TC-001" },
  },
  async ({ page }) => {
    // ...
  },
);
```

The value (`TC-001`) is used to track this test across builds in UReport.

---

## Steps

Test steps are captured automatically — every Playwright action, assertion, and `test.step()` call is recorded.

To create named logical groupings that show up clearly in UReport, use `test.step()`:

```ts
test("checkout flow", async ({ page }) => {
  await test.step("Add item to cart", async () => {
    await page.goto("/products");
    await page.getByText("Add to cart").click();
  });

  await test.step("Complete purchase", async () => {
    await page.getByRole("button", { name: "Checkout" }).click();
    await page.getByLabel("Card number").fill("4242 4242 4242 4242");
    await page.getByRole("button", { name: "Pay" }).click();
    await expect(page.getByText("Order confirmed")).toBeVisible();
  });
});
```

Hook steps (beforeEach/afterEach) are automatically split into `setup` and `teardown` sections.

### Step attachments

Use `test.info().attach()` inside a `test.step()` to attach structured content. UReport reads the `contentType` and renders a format toggle (JSON/XML, curl/text, etc.) in the Steps tab.

```ts
test("login API returns token", async ({ request }) => {
  test.info().annotations.push({
    type: "ureport-uid",
    description: "auth-login-api-001",
  });

  const response = await request.post("/api/login", {
    data: { username: "alice", password: "secret" },
  });

  await test.step("POST /api/login", async () => {
    // JSON body — shows JSON/XML toggle in UReport
    await test.info().attach("response-body", {
      body: await response.text(),
      contentType: "application/json",
    });
    expect(response.ok()).toBeTruthy();
  });
});
```

Other supported content types:

```ts
// curl command — shows curl/text toggle
await test.info().attach("request-curl", {
  body: `curl -X POST https://api.example.com/api/login -H 'Content-Type: application/json' -d '{"username":"alice"}'`,
  contentType: "text/x-curl",
});

// XML — shows XML toggle
await test.info().attach("soap-response", {
  body: `<?xml version="1.0"?><root><status>OK</status></root>`,
  contentType: "application/xml",
});

// Plain text
await test.info().attach("server-log", {
  body: "INFO: user alice logged in at 2024-01-15T10:30:00Z",
  contentType: "text/plain",
});
```

| `contentType`                  | UReport view formats |
| ------------------------------ | -------------------- |
| `application/json`             | JSON, XML            |
| `application/xml` / `text/xml` | XML                  |
| `text/x-curl`                  | curl, text           |
| `text/plain`                   | text                 |

> Only the first content attachment per step is captured. Screenshots and content attachments are independent — a step can have both.

---

## How it works

1. **`onBegin`** — validates config, authenticates with the API token, creates a build record
2. **`onStepEnd`** — accumulates step data (title, status, timestamp, screenshot) per test
3. **`onTestEnd`** — maps each Playwright result to a UReport payload
4. **`onEnd`** — flushes all results in batches, finalizes the build, optionally saves test relations

The reporter sets `printsToStdio()` to `false` so standard Playwright reporters (e.g. `list`, `dot`) still show their normal output alongside it.

---

## Development

### Setup

```bash
npm install
npm run build     # compile CJS + ESM + types to dist/
```

### Running tests

```bash
# Unit tests only (fast, no build required)
npm test

# Integration tests (spawns real Playwright subprocesses against a mock HTTP server)
npm run test:integration

# Both
npm run test:all
```

The integration tests start a mock UReport HTTP server, spawn `npx playwright test` as a subprocess against fixture configs, and assert on the exact HTTP payloads sent.

`npm run build` is required before running integration tests since the reporter loads from `dist/cjs/index.js`.

### Smoke test against a real server

```ts
// smoke.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testMatch: "tests/integration/fixtures/sample.spec.ts",
  reporter: [
    [
      "./dist/cjs/index.js",
      {
        serverUrl: process.env.UREPORT_URL,
        apiToken: process.env.UREPORT_API_TOKEN,
        product: "SmokeTest",
        type: "E2E",
        buildNumber: Date.now(),
      },
    ],
  ],
  projects: [
    { name: "Desktop Chrome", use: { ...devices["Desktop Chrome"] } },
    { name: "Mobile Chrome", use: { ...devices["Pixel 5"] } },
  ],
});
```

```bash
npm run build
UREPORT_URL=http://your-ureport-server \
UREPORT_API_TOKEN=your-token \
npx playwright test --config smoke.config.ts
```

```bash
npm pack   # inspect the tarball before publishing
```
