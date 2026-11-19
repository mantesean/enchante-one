import { expect, test } from "@playwright/test";

test("honest manual onboarding, validation, correction and reset", async ({ page }, testInfo) => {
  const externalRequests: string[] = [];
  const pageErrors: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).hostname !== "127.0.0.1") externalRequests.push(request.url());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await expect(page.getByText("Website analysis is unavailable in this pilot.")).toBeVisible();
  const input = page.getByRole("textbox", { name: "Company domain" });
  const submit = page.getByRole("button", { name: "Prepare manual checklist" });
  await submit.click();
  await expect(page.locator("form").getByRole("alert")).toContainText("Enter a public domain");
  await expect(input).toBeFocused();
  for (const invalid of ["https://user:secret@example.com", "https://example.com:443", "127.1", "company.local", "ftp://example.com"]) {
    await input.fill(invalid);
    await input.press("Enter");
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("form").getByRole("alert")).toBeVisible();
  }
  await input.fill(" HTTPS://Example.COM/about ");
  await input.press("Enter");
  await expect(page.getByRole("heading", { name: "Your manual starting point" })).toBeFocused();
  await expect(page.getByText("No website fetched. No company analysis performed.")).toBeVisible();
  await expect(page.getByText("Domain you entered: example.com", { exact: true })).toBeVisible();
  await expect(page.getByText("General prompts, not findings or tailored recommendations.")).toBeVisible();
  await expect(page.getByText("Confidence for every step:", { exact: false })).toBeVisible();
  await expect(page.getByText("Limitations:", { exact: false })).toBeVisible();
  await expect(page.getByText(/Analyzing|Founding Access|\$990/)).toHaveCount(0);
  await page.getByRole("checkbox").first().check();
  await expect(page.getByRole("checkbox").first()).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await testInfo.attach("manual-checklist", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  await page.getByRole("button", { name: "Change domain" }).click();
  await expect(input).toBeFocused();
  await input.fill("another.org");
  await submit.click();
  await expect(page.getByText("Domain you entered: another.org", { exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox").first()).not.toBeChecked();
  await page.reload();
  await expect(input).toHaveValue("");
  expect(externalRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
});
