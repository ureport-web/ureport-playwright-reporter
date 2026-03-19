# ureport-playwright-reporter

A Playwright reporter that automatically ships test results to [UReport](https://github.com/your-org/ureport).

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
        browser: "chrome", // overrides auto-detection
        device: "MOBILE-Pixel 5", // overrides auto-detection
        platform: "linux", // overrides process.platform
        platform_version: "22.04",
        stage: "staging",
        version: "1.4.2", // app version under test

        // --- environment & settings (auto-detected from Playwright config) ---
        environments: { baseURL: "https://staging.example.com" },
        settings: { timeout: 30000, retries: 2, workers: 4 },

        // --- payload control ---
        batchSize: 50, // test results per POST (default: 50)
        includeSteps: true, // send step-level detail (default: true)
        includeScreenshots: true, // embed screenshots as base64 (default: true)
        saveRelations: true, // save test relations after build (default: true)
        outputFile: "ureport.json", // write submitted payload to a local file
      },
    ],
  ],
});
```

### All options

| Option               | Type                      | Required | Default            | Description                                                      |
| -------------------- | ------------------------- | -------- | ------------------ | ---------------------------------------------------------------- |
| `serverUrl`          | `string`                  | Yes      | —                  | UReport server base URL                                          |
| `apiToken`           | `string`                  | Yes      | —                  | API token from UReport user settings                             |
| `product`            | `string`                  | Yes      | —                  | Product name in UReport                                          |
| `type`               | `string`                  | Yes      | —                  | Build type, e.g. `"E2E"`, `"UI"`, `"API"`                        |
| `buildNumber`        | `string \| number`        | No       | `Date.now()`       | CI build number                                                  |
| `team`               | `string`                  | No       | —                  | Team name                                                        |
| `browser`            | `string`                  | No       | auto-detected      | Browser name                                                     |
| `device`             | `string`                  | No       | auto-detected      | Device name (e.g. `"MOBILE-Pixel 5"`, `"DESKTOP-Windows"`)       |
| `platform`           | `string`                  | No       | `process.platform` | OS platform                                                      |
| `platform_version`   | `string`                  | No       | —                  | OS version string                                                |
| `stage`              | `string`                  | No       | —                  | Deployment stage, e.g. `"staging"`, `"prod"`                     |
| `version`            | `string`                  | No       | —                  | Application version under test                                   |
| `batchSize`          | `number`                  | No       | `50`               | Number of test results per POST request                          |
| `includeSteps`       | `boolean`                 | No       | `true`             | Send step-level detail to UReport                                |
| `includeScreenshots` | `boolean`                 | No       | `true`             | Embed screenshots as base64 in step payloads                     |
| `environments`       | `Record<string, unknown>` | No       | auto-detected      | Environment metadata. Auto-detected from `use.baseURL`           |
| `settings`           | `Record<string, unknown>` | No       | auto-detected      | Run settings. Auto-detected from `timeout`/`retries`/`workers`   |
| `saveRelations`      | `boolean`                 | No       | `true`             | Save test relation records after the build                       |
| `outputFile`         | `string`                  | No       | —                  | Write the full submitted payload to this JSON file after the run |

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
