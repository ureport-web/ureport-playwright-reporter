import {
  detectBrowser,
  detectDevice,
  detectEnvironments,
  detectSettings,
} from "../src/mapper";
import type { FullConfig, FullProject } from "@playwright/test/reporter";

function makeProject(use: Record<string, unknown> = {}): FullProject {
  return { use } as unknown as FullProject;
}

function makeConfig(overrides: Partial<FullConfig> = {}): FullConfig {
  return { use: {}, projects: [], ...overrides } as unknown as FullConfig;
}

describe("detectDevice", () => {
  // mobile
  test("iPhone UA + isMobile → MOBILE-IPHONE", () => {
    expect(
      detectDevice(
        makeProject({
          isMobile: true,
          userAgent:
            "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.4 Mobile/15E148 Safari/604.1",
        }),
      ),
    ).toBe("MOBILE-IPHONE");
  });

  test("iPad UA + isMobile → MOBILE-IPAD", () => {
    expect(
      detectDevice(
        makeProject({
          isMobile: true,
          userAgent:
            "Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.4 Mobile/15E148 Safari/604.1",
        }),
      ),
    ).toBe("MOBILE-IPAD");
  });

  test("Android Pixel UA + isMobile → MOBILE-PIXEL 5", () => {
    expect(
      detectDevice(
        makeProject({
          isMobile: true,
          userAgent:
            "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4812.0 Mobile Safari/537.36",
        }),
      ),
    ).toBe("MOBILE-PIXEL 5");
  });

  test("Android Samsung UA + isMobile → MOBILE-SM-G965U", () => {
    expect(
      detectDevice(
        makeProject({
          isMobile: true,
          userAgent:
            "Mozilla/5.0 (Linux; Android 8.0.0; SM-G965U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.87 Mobile Safari/537.36",
        }),
      ),
    ).toBe("MOBILE-SM-G965U");
  });

  test("isMobile true but no userAgent → MOBILE", () => {
    expect(detectDevice(makeProject({ isMobile: true }))).toBe("MOBILE");
  });

  // desktop
  test("Windows UA + isMobile false → DESKTOP-WINDOWS", () => {
    expect(
      detectDevice(
        makeProject({
          isMobile: false,
          userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.0.0 Safari/537.36",
        }),
      ),
    ).toBe("DESKTOP-WINDOWS");
  });

  test("macOS UA + isMobile false → DESKTOP-MACOS", () => {
    expect(
      detectDevice(
        makeProject({
          isMobile: false,
          userAgent:
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.0.0 Safari/537.36",
        }),
      ),
    ).toBe("DESKTOP-MACOS");
  });

  test("Linux UA + isMobile false → DESKTOP-LINUX", () => {
    expect(
      detectDevice(
        makeProject({
          isMobile: false,
          userAgent:
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.0.0 Safari/537.36",
        }),
      ),
    ).toBe("DESKTOP-LINUX");
  });

  test("ChromeOS UA + isMobile false → DESKTOP-CHROMEOS", () => {
    expect(
      detectDevice(
        makeProject({
          isMobile: false,
          userAgent:
            "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.0.0 Safari/537.36",
        }),
      ),
    ).toBe("DESKTOP-CHROMEOS");
  });

  // no info
  test("no isMobile flag → undefined", () => {
    expect(detectDevice(makeProject({}))).toBeUndefined();
  });
});

describe("detectBrowser", () => {
  // channel takes priority
  test("chrome channel → CHROME", () => {
    expect(detectBrowser(makeProject({ channel: "chrome" }))).toBe("CHROME");
  });

  test("chrome-beta channel → CHROME", () => {
    expect(detectBrowser(makeProject({ channel: "chrome-beta" }))).toBe(
      "CHROME",
    );
  });

  test("msedge channel → EDGE", () => {
    expect(detectBrowser(makeProject({ channel: "msedge" }))).toBe("EDGE");
  });

  test("msedge-beta channel → EDGE", () => {
    expect(detectBrowser(makeProject({ channel: "msedge-beta" }))).toBe("EDGE");
  });

  test("unknown channel passes through uppercased", () => {
    expect(detectBrowser(makeProject({ channel: "electron" }))).toBe(
      "ELECTRON",
    );
  });

  // browserName fallback
  test("webkit browserName → SAFARI", () => {
    expect(detectBrowser(makeProject({ browserName: "webkit" }))).toBe(
      "SAFARI",
    );
  });

  test("chromium browserName → CHROMIUM", () => {
    expect(detectBrowser(makeProject({ browserName: "chromium" }))).toBe(
      "CHROMIUM",
    );
  });

  test("firefox browserName → FIREFOX", () => {
    expect(detectBrowser(makeProject({ browserName: "firefox" }))).toBe(
      "FIREFOX",
    );
  });

  // channel overrides browserName
  test("channel overrides browserName", () => {
    expect(
      detectBrowser(
        makeProject({ browserName: "chromium", channel: "chrome" }),
      ),
    ).toBe("CHROME");
  });

  test("falls back to defaultBrowserType when browserName not set", () => {
    expect(detectBrowser(makeProject({ defaultBrowserType: "chromium" }))).toBe(
      "CHROMIUM",
    );
  });

  test("defaultBrowserType webkit → SAFARI", () => {
    expect(detectBrowser(makeProject({ defaultBrowserType: "webkit" }))).toBe(
      "SAFARI",
    );
  });

  test("no browser info → CHROMIUM (Playwright default)", () => {
    expect(detectBrowser(makeProject({}))).toBe("CHROME");
  });
});

describe("detectEnvironments", () => {
  test("baseURL on first project use → { baseURL }", () => {
    const config = makeConfig({
      projects: [makeProject({ baseURL: "https://staging.example.com" })],
    });
    expect(detectEnvironments(config)).toEqual({
      baseURL: "https://staging.example.com",
    });
  });

  test("no projects → undefined", () => {
    expect(detectEnvironments(makeConfig())).toBeUndefined();
  });

  test("project with no baseURL → undefined", () => {
    const config = makeConfig({ projects: [makeProject({})] });
    expect(detectEnvironments(config)).toBeUndefined();
  });
});

describe("detectSettings", () => {
  test("timeout, retries and workers all set → full object", () => {
    const config = makeConfig({
      projects: [
        makeProject() as unknown as FullProject & {
          timeout: number;
          retries: number;
        },
      ],
      workers: 4,
    });
    (config.projects[0] as unknown as Record<string, unknown>).timeout = 30000;
    (config.projects[0] as unknown as Record<string, unknown>).retries = 2;
    expect(detectSettings(config)).toEqual({
      timeout: 30000,
      retries: 2,
      workers: 4,
    });
  });

  test("only workers set → { workers }", () => {
    expect(detectSettings(makeConfig({ workers: 2 }))).toEqual({ workers: 2 });
  });

  test("only timeout set on first project → { timeout }", () => {
    const config = makeConfig({
      projects: [
        { timeout: 10000, retries: 0, use: {} } as unknown as FullProject,
      ],
    });
    expect(detectSettings(config)).toEqual({ timeout: 10000 });
  });

  test("only retries set on first project → { retries }", () => {
    const config = makeConfig({
      projects: [{ timeout: 0, retries: 3, use: {} } as unknown as FullProject],
    });
    expect(detectSettings(config)).toEqual({ retries: 3 });
  });

  test("all absent/zero → undefined", () => {
    const config = makeConfig({
      projects: [{ timeout: 0, retries: 0, use: {} } as unknown as FullProject],
      workers: 0,
    });
    expect(detectSettings(config)).toBeUndefined();
  });

  test("no projects and no workers → undefined", () => {
    expect(detectSettings(makeConfig())).toBeUndefined();
  });
});
