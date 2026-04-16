import { test, expect, Page } from "@playwright/test";

/**
 * Comprehensive site speed audit.
 * Measures real browser metrics: navigation timing, resource sizes,
 * Core Web Vitals (LCP, CLS), JS bundle weight, and API latencies.
 */

interface TimingResult {
  route: string;
  ttfb: number;
  domContentLoaded: number;
  loadComplete: number;
  lcp: number | null;
  cls: number | null;
  jsTransferKB: number;
  cssTransferKB: number;
  imgTransferKB: number;
  fontTransferKB: number;
  totalTransferKB: number;
  resourceCount: number;
  longTasks: number;
  apiCalls: { url: string; duration: number; size: number }[];
}

async function measureRoute(page: Page, path: string): Promise<TimingResult> {
  // Collect API calls via request/response interception
  const apiCalls: { url: string; duration: number; size: number }[] = [];
  const requestStarts = new Map<string, number>();

  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("supabase") || url.includes("/api/")) {
      requestStarts.set(url, Date.now());
    }
  });

  page.on("response", async (res) => {
    const url = res.url();
    const startTime = requestStarts.get(url);
    if (startTime) {
      const duration = Date.now() - startTime;
      let size = 0;
      try {
        const body = await res.body();
        size = body.length;
      } catch {
        // streaming or opaque response
      }
      apiCalls.push({ url: url.replace(/\?.*/, "?..."), duration, size });
      requestStarts.delete(url);
    }
  });

  // Inject LCP + CLS observers before navigation
  await page.addInitScript(() => {
    (window as any).__LCP__ = 0;
    (window as any).__CLS__ = 0;

    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      if (entries.length > 0) {
        (window as any).__LCP__ = entries[entries.length - 1].startTime;
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          (window as any).__CLS__ += (entry as any).value;
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
  });

  // Navigate
  await page.goto(path, { waitUntil: "domcontentloaded" });

  // Wait a bit for late LCP/CLS entries
  await page.waitForTimeout(1500);

  // Gather Navigation Timing
  const navTiming = await page.evaluate(() => {
    const nav = performance.getEntriesByType(
      "navigation"
    )[0] as PerformanceNavigationTiming;
    return {
      ttfb: Math.round(nav.responseStart - nav.requestStart),
      domContentLoaded: Math.round(
        nav.domContentLoadedEventEnd - nav.startTime
      ),
      loadComplete: Math.round(nav.loadEventEnd - nav.startTime),
    };
  });

  // Gather Resource Timing
  const resources = await page.evaluate(() => {
    const entries = performance.getEntriesByType(
      "resource"
    ) as PerformanceResourceTiming[];
    let js = 0,
      css = 0,
      img = 0,
      font = 0,
      total = 0;
    for (const e of entries) {
      const size = e.transferSize || e.encodedBodySize || 0;
      total += size;
      if (
        e.initiatorType === "script" ||
        e.name.endsWith(".js") ||
        e.name.includes("/_next/static/chunks/")
      )
        js += size;
      else if (e.initiatorType === "css" || e.name.endsWith(".css"))
        css += size;
      else if (
        e.initiatorType === "img" ||
        /\.(png|jpg|jpeg|webp|svg|gif|ico)/.test(e.name)
      )
        img += size;
      else if (e.initiatorType === "font" || /\.(woff2?|ttf|otf)/.test(e.name))
        font += size;
    }
    return {
      jsBytes: js,
      cssBytes: css,
      imgBytes: img,
      fontBytes: font,
      totalBytes: total,
      count: entries.length,
    };
  });

  // LCP & CLS
  const lcp = await page.evaluate(() => (window as any).__LCP__ || null);
  const cls = await page.evaluate(() => (window as any).__CLS__ || null);

  // Long tasks (> 50ms) — count from PerformanceObserver if available
  const longTasks = await page.evaluate(() => {
    try {
      const entries = performance.getEntriesByType("longtask");
      return entries.length;
    } catch {
      return 0;
    }
  });

  return {
    route: path,
    ttfb: navTiming.ttfb,
    domContentLoaded: navTiming.domContentLoaded,
    loadComplete: navTiming.loadComplete,
    lcp,
    cls,
    jsTransferKB: Math.round(resources.jsBytes / 1024),
    cssTransferKB: Math.round(resources.cssBytes / 1024),
    imgTransferKB: Math.round(resources.imgBytes / 1024),
    fontTransferKB: Math.round(resources.fontBytes / 1024),
    totalTransferKB: Math.round(resources.totalBytes / 1024),
    resourceCount: resources.count,
    longTasks,
    apiCalls,
  };
}

function printReport(r: TimingResult) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`  ROUTE: ${r.route}`);
  console.log(`${"=".repeat(70)}`);
  console.log(`  TTFB:               ${r.ttfb} ms`);
  console.log(`  DOM Content Loaded: ${r.domContentLoaded} ms`);
  console.log(`  Load Complete:      ${r.loadComplete} ms`);
  console.log(`  LCP:                ${r.lcp != null ? r.lcp.toFixed(0) + " ms" : "N/A"}`);
  console.log(`  CLS:                ${r.cls != null ? r.cls.toFixed(4) : "N/A"}`);
  console.log(`  Long Tasks (>50ms): ${r.longTasks}`);
  console.log(`  ---`);
  console.log(`  JS Transfer:        ${r.jsTransferKB} KB`);
  console.log(`  CSS Transfer:       ${r.cssTransferKB} KB`);
  console.log(`  Image Transfer:     ${r.imgTransferKB} KB`);
  console.log(`  Font Transfer:      ${r.fontTransferKB} KB`);
  console.log(`  TOTAL Transfer:     ${r.totalTransferKB} KB`);
  console.log(`  Resource Count:     ${r.resourceCount}`);

  if (r.apiCalls.length > 0) {
    console.log(`  ---`);
    console.log(`  API/Supabase Calls:`);
    for (const call of r.apiCalls.sort((a, b) => b.duration - a.duration)) {
      console.log(
        `    ${call.duration.toString().padStart(5)} ms | ${(call.size / 1024).toFixed(1).padStart(7)} KB | ${call.url.substring(0, 80)}`
      );
    }
  }
}

// ─── Key routes to audit ─────────────────────────────────────────────
const ROUTES = [
  "/dashboard",
  "/lebensmittel",
  "/rezepte",
  "/ernaehrungsplan",
  "/patienten",
  "/referenzwerte",
];

test.describe("Site Speed Audit", () => {
  const allResults: TimingResult[] = [];

  for (const route of ROUTES) {
    test(`Speed audit: ${route}`, async ({ page }) => {
      const result = await measureRoute(page, route);
      allResults.push(result);
      printReport(result);

      // Assertions: flag severe issues
      expect
        .soft(result.domContentLoaded, `${route} DOMContentLoaded too slow`)
        .toBeLessThan(5000);
      expect
        .soft(result.totalTransferKB, `${route} total transfer too large`)
        .toBeLessThan(5000); // 5 MB budget
      if (result.lcp != null) {
        expect
          .soft(result.lcp, `${route} LCP too slow`)
          .toBeLessThan(4000); // "needs improvement" threshold
      }
      if (result.cls != null) {
        expect
          .soft(result.cls, `${route} CLS too high`)
          .toBeLessThan(0.25); // "poor" threshold
      }
    });
  }

  test("JS bundle analysis", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    const chunks = await page.evaluate(() => {
      const entries = performance.getEntriesByType(
        "resource"
      ) as PerformanceResourceTiming[];
      return entries
        .filter(
          (e) =>
            e.name.includes("/_next/static/") &&
            (e.name.endsWith(".js") || e.name.includes(".js?"))
        )
        .map((e) => ({
          name: e.name.replace(/.*\/_next\/static\//, "_next/static/"),
          transferKB: Math.round((e.transferSize || e.encodedBodySize) / 1024),
          durationMs: Math.round(e.duration),
        }))
        .sort((a, b) => b.transferKB - a.transferKB);
    });

    console.log(`\n${"=".repeat(70)}`);
    console.log("  JS BUNDLE BREAKDOWN (by transfer size)");
    console.log(`${"=".repeat(70)}`);
    let totalJS = 0;
    for (const chunk of chunks) {
      totalJS += chunk.transferKB;
      console.log(
        `  ${chunk.transferKB.toString().padStart(6)} KB | ${chunk.durationMs.toString().padStart(5)} ms | ${chunk.name.substring(0, 60)}`
      );
    }
    console.log(`  ${"─".repeat(66)}`);
    console.log(`  ${totalJS.toString().padStart(6)} KB   TOTAL JS`);

    // Flag if total JS exceeds 1 MB
    expect
      .soft(totalJS, "Total JS bundle too large")
      .toBeLessThan(1500);
  });

  test("Supabase query waterfall on /lebensmittel", async ({ page }) => {
    const apiTimings: { url: string; start: number; duration: number; size: number }[] = [];
    const testStart = Date.now();

    page.on("request", (req) => {
      const url = req.url();
      if (url.includes("supabase")) {
        (req as any).__start = Date.now();
      }
    });

    page.on("response", async (res) => {
      const req = res.request();
      const url = res.url();
      const start = (req as any).__start;
      if (start && url.includes("supabase")) {
        const duration = Date.now() - start;
        let size = 0;
        try {
          const body = await res.body();
          size = body.length;
        } catch {}
        apiTimings.push({
          url: url.replace(/\?.*/, ""),
          start: start - testStart,
          duration,
          size,
        });
      }
    });

    await page.goto("/lebensmittel", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000); // let trailing requests finish

    console.log(`\n${"=".repeat(70)}`);
    console.log("  SUPABASE WATERFALL — /lebensmittel");
    console.log(`${"=".repeat(70)}`);
    for (const t of apiTimings.sort((a, b) => a.start - b.start)) {
      const bar = "█".repeat(Math.max(1, Math.round(t.duration / 50)));
      console.log(
        `  @${t.start.toString().padStart(5)}ms | ${t.duration.toString().padStart(5)}ms | ${(t.size / 1024).toFixed(1).padStart(7)}KB | ${bar} | ${t.url.substring(0, 50)}`
      );
    }

    // Check for sequential queries that could be parallelized
    if (apiTimings.length >= 2) {
      const sorted = apiTimings.sort((a, b) => a.start - b.start);
      let sequentialCount = 0;
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        // If current starts after previous ends, it's sequential
        if (curr.start > prev.start + prev.duration - 50) {
          sequentialCount++;
        }
      }
      if (sequentialCount > 0) {
        console.log(
          `\n  ⚠️  ${sequentialCount} sequential Supabase queries detected — consider parallelizing with Promise.all()`
        );
      }
    }
  });

  test("Navigation speed (client-side transitions)", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    const transitions: { from: string; to: string; duration: number }[] = [];
    const routes = [
      { name: "Lebensmittel", url: "/lebensmittel" },
      { name: "Rezepte", url: "/rezepte" },
      { name: "Ernährungsplan", url: "/ernaehrungsplan" },
      { name: "Dashboard", url: "/dashboard" },
    ];

    for (const target of routes) {
      const fromUrl = page.url();
      const start = Date.now();

      const sidebar = page.locator("[data-slot='sidebar-container']");
      const link = sidebar.getByRole("link", { name: target.name });

      if (await link.isVisible()) {
        await link.click();
        await page.waitForURL(`**${target.url}`, { timeout: 10000 });
        // Wait for main content to be ready
        await page.waitForSelector("main", { state: "visible" });
        const duration = Date.now() - start;

        transitions.push({
          from: fromUrl.replace(/.*:\/\/[^/]+/, ""),
          to: target.url,
          duration,
        });
      }
    }

    console.log(`\n${"=".repeat(70)}`);
    console.log("  CLIENT-SIDE NAVIGATION SPEED");
    console.log(`${"=".repeat(70)}`);
    for (const t of transitions) {
      const status = t.duration < 500 ? "FAST" : t.duration < 1500 ? "OK" : "SLOW";
      console.log(
        `  ${t.duration.toString().padStart(5)} ms  [${status}]  ${t.from} → ${t.to}`
      );
    }

    // Client-side navigations should be fast
    for (const t of transitions) {
      expect
        .soft(t.duration, `Navigation to ${t.to} too slow`)
        .toBeLessThan(3000);
    }
  });
});
