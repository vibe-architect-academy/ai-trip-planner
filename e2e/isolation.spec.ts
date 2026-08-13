import { test, expect } from "@playwright/test";

/**
 * The test this whole app exists to pass: user B cannot read user A's trip.
 *
 * It needs two real signed-in accounts, so it is skipped unless the
 * credentials are present. Skipped and honest beats a fake that passes because
 * it never really checked, which is the failure mode that matters here: a test
 * that quietly stops testing the one thing you most need to be true.
 *
 * To run it, set in .env.local:
 *   E2E_USER_A_EMAIL, E2E_USER_A_PASSWORD
 *   E2E_USER_B_EMAIL, E2E_USER_B_PASSWORD
 */

const A = {
  email: process.env.E2E_USER_A_EMAIL,
  password: process.env.E2E_USER_A_PASSWORD,
};
const B = {
  email: process.env.E2E_USER_B_EMAIL,
  password: process.env.E2E_USER_B_PASSWORD,
};

const configured = Boolean(A.email && A.password && B.email && B.password);

test.describe("one user cannot read another's trip", () => {
  test.skip(!configured, "Set E2E_USER_A_* and E2E_USER_B_* to run this.");

  async function signIn(page: import("@playwright/test").Page, who: typeof A) {
    await page.goto("/sign-in");
    await page.getByLabel(/email/i).fill(who.email as string);
    await page.getByRole("button", { name: /continue|sign in/i }).first().click();
    await page.getByLabel(/password/i).fill(who.password as string);
    await page.getByRole("button", { name: /continue|sign in/i }).first().click();
    await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
  }

  test("B gets a 404 on A's trip", async ({ browser }) => {
    // Two separate contexts, which is the point. Same browser, different
    // people, exactly like two real users.
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await signIn(pageA, A);

    await pageA.goto("/");
    await pageA.getByLabel(/where to/i).fill("Kyoto");
    await pageA.getByRole("button", { name: /generate/i }).click();
    await pageA.waitForURL(/\/trips\/.+/, { timeout: 120_000 }).catch(() => {});

    const created = await pageA
      .getByRole("link", { name: /has its own page/i })
      .getAttribute("href");
    expect(created, "A should have created a trip").toBeTruthy();

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await signIn(pageB, B);

    // The moment of truth. Same URL, different person.
    const response = await pageB.goto(created as string);
    expect(response?.status()).toBe(404);

    // And through the API directly, because a UI check alone would not prove
    // the server refuses; it would only prove the page does not render it.
    const api = await pageB.request.get(
      `/api/trips/${(created as string).split("/").pop()}`,
    );
    expect(api.status()).toBe(404);

    await contextA.close();
    await contextB.close();
  });
});
