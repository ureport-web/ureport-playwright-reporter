import { test, expect } from '@playwright/test';

test('passing test', async () => {
  expect(1 + 1).toBe(2);
});

test('failing test', async () => {
  // intentionally fails so we can assert FAIL status + failure payload
  expect(1 + 1).toBe(999);
});

test.skip('skipped test', () => {
  // intentionally skipped
});

test('annotated uid test', {
  annotation: { type: 'ureport-uid', description: 'TC-CUSTOM-001' },
}, async () => {
  expect(true).toBe(true);
});

// Tags via { tag: [...] } option — go into testCase.tags directly
test('tagged via option @smoke', { tag: ['@regression'] }, async () => {
  expect(true).toBe(true);
});

// Custom annotations become extra keys under info (custom relations)
test('custom relation test', {
  annotation: [
    { type: 'jira', description: 'PROJ-123' },
    { type: 'owner', description: 'alice' },
  ],
}, async () => {
  expect(true).toBe(true);
});

// components and teams annotations are collected into arrays
test('components and teams test', {
  annotation: [
    { type: 'components', description: 'auth' },
    { type: 'components', description: 'checkout' },
    { type: 'teams', description: 'backend' },
  ],
}, async () => {
  expect(true).toBe(true);
});
