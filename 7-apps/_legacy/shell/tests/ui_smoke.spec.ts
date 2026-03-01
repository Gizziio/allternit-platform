import { test, expect } from "@playwright/test";

test("shell loads without fatal errors", async ({ page }) => {
  const allConsole: string[] = [];
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const requestFails: string[] = [];

  page.on("console", (msg) => {
    allConsole.push(`[${msg.type()}] ${msg.text()}`);
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  page.on("requestfailed", (req) => {
    const error = req.failure()?.errorText || "Unknown error";
    requestFails.push(`${req.method()} ${req.url()} :: ${error}`);
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  console.log("=== ALL CONSOLE OUTPUT ===");
  allConsole.forEach(msg => console.log(msg));

  console.log("=== APP ELEMENT ===");
  const appElement = await page.locator("#app").count();
  console.log(`Found #app element: ${appElement > 0 ? 'YES' : 'NO'} (${appElement} elements)`);

  await expect(page.locator("body")).toBeVisible();

  if (pageErrors.length > 0) {
    console.log("=== PAGE ERRORS ===");
    pageErrors.forEach(err => console.log(err));
  }

  if (consoleErrors.length > 0) {
    console.log("=== CONSOLE ERRORS ===");
    consoleErrors.forEach(err => console.log(err));
  }

  if (requestFails.length > 0) {
    console.log("=== FAILED REQUESTS ===");
    requestFails.forEach(req => console.log(req));
  }

  expect(pageErrors).toEqual([]);
  console.log(`Test completed. Console errors: ${consoleErrors.length}, Page errors: ${pageErrors.length}, Failed requests: ${requestFails.length}`);
});
