import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.env.MOCKUP_URL || "http://127.0.0.1:4173";
const OUT = process.env.VIDEO_DIR || "/tmp/cuciin-video";
const CHROME = process.env.CHROME_PATH || "/usr/bin/google-chrome";

mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
  });
  const context = await browser.newContext({
    viewport: { width: 430, height: 920 },
    deviceScaleFactor: 2,
    recordVideo: { dir: OUT, size: { width: 430, height: 920 } },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  await page.goto(`${BASE}/?film=1&role=kasir&screen=login`, { waitUntil: "networkidle" });
  await sleep(1400);

  await page.click('button.btn.primary[data-go="home"]');
  await sleep(1800);

  await page.click('[data-pick-customer="c1"]');
  await sleep(1400);

  await page.click('[data-open-qty="cuci"]');
  await sleep(800);
  await page.click('[data-qty="1"]');
  await sleep(500);
  await page.click("[data-add-cart]");
  await sleep(900);

  await page.click('[data-open-qty="do"]');
  await sleep(800);
  await page.click("[data-add-cart]");
  await sleep(900);

  await page.click('[data-open-qty="sabun"]');
  await sleep(700);
  await page.click("[data-add-cart]");
  await sleep(1200);

  await page.click('button[data-go="bayar"]');
  await sleep(1600);
  await page.click("button[data-paid]:has-text('Lunas')");
  await sleep(1800);
  await page.click('button[data-go="nota"]');
  await sleep(2200);

  await page.click("button[data-wa]");
  await sleep(2200);
  await page.click("button[data-wa-send]");
  await sleep(3600);

  const video = page.video();
  await page.close();
  const webm = await video.path();
  await context.close();
  await browser.close();
  console.log(webm);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
