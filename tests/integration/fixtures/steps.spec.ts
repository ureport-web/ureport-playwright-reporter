import { test, expect } from '@playwright/test';

// beforeEach/afterEach hooks become 'hook' category steps in the reporter.
// The mapper routes them to setup[] / teardown[] based on the title containing "before"/"after".
test.beforeEach(async () => {
  expect(true).toBe(true); // minimal work so the hook is visible as a step
});

test.afterEach(async () => {
  expect(true).toBe(true);
});

test('test with explicit steps', async () => {
  await test.step('prepare data', async () => {
    expect({ items: [1, 2, 3] }).toHaveProperty('items');
  });

  await test.step('validate result', async () => {
    expect([1, 2, 3]).toHaveLength(3);
  });

  await test.step('cleanup', async () => {
    expect(true).toBe(true);
  });
});

test('test with a failing step', async () => {
  await test.step('this step passes', async () => {
    expect(1).toBe(1);
  });

  // This throws — the step itself is marked as FAIL in the reporter
  await test.step('this step fails', async () => {
    expect(1).toBe(999);
  }).catch(() => {});  // swallow so the test body can continue reporting
});

test('test with content attachments', async () => {
  await test.step('JSON step', async () => {
    await test.info().attach('response-body', {
      body: '{"ok":true}',
      contentType: 'application/json',
    });
  });

  await test.step('curl step', async () => {
    await test.info().attach('request-curl', {
      body: `curl -X GET https://api.example.com/health`,
      contentType: 'text/x-curl',
    });
  });
});
