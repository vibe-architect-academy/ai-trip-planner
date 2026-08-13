import { test, expect } from "@playwright/test";

/**
 * The tests that need no account and no configured services.
 *
 * These run everywhere, including in CI on a machine that has never seen a
 * credential, which is the point: a suite that only works when six
 * third-party services are configured is a suite that gets skipped, and a
 * skipped test protects nothing.
 *
 * They are all API-level, and that is not a limitation to apologise for. It
 * is where the security promises actually live. A page test proves the UI
 * does not show something; an API test proves the server does not send it.
 */

test("the health endpoint reports honestly", async ({ request }) => {
  const response = await request.get("/api/health");
  const body = await response.json();

  // Either it is healthy and says 200, or it is degraded and says 503. What
  // it must never do is claim to be fine while answering an error.
  expect([200, 503]).toContain(response.status());
  expect(body.status).toBe(response.status() === 200 ? "ok" : "degraded");
  expect(Array.isArray(body.checks)).toBe(true);
});

test("robots keeps crawlers out of the private areas", async ({ request }) => {
  const body = await (await request.get("/robots.txt")).text();
  for (const path of ["/admin", "/trips", "/api/", "/share"]) {
    expect(body).toContain(`Disallow: ${path}`);
  }
});

test("the public destinations list is cacheable and needs no session", async ({ request }) => {
  const response = await request.get("/api/destinations");
  expect(response.status()).toBe(200);
  // The header is the whole reason this endpoint is separate from the rest.
  expect(response.headers()["cache-control"]).toContain("s-maxage");
});

test("your own trips are never cacheable", async ({ request }) => {
  const response = await request.get("/api/trips");
  // Signed out this is a 401, and that is fine. What must never appear is a
  // shared-cache header on a personal endpoint.
  expect(response.headers()["cache-control"] ?? "").not.toContain("public");
});

test("the background worker refuses anything without a queue signature", async ({
  request,
}) => {
  const response = await request.post("/api/jobs/process-photos", {
    data: { photoId: "pho_whatever" },
  });
  expect(response.status()).toBe(401);
});

test("the payment webhook refuses an unsigned event", async ({ request }) => {
  // The one that matters most. This endpoint is the only thing that grants
  // paid access, so it must never act on a request it cannot verify.
  const response = await request.post("/api/billing/webhook", {
    data: {
      id: "evt_forged",
      type: "checkout.session.completed",
      data: { object: { client_reference_id: "somebody_else" } },
    },
  });
  expect(response.status()).toBe(400);
});

test("the payment webhook refuses a forged signature", async ({ request }) => {
  const response = await request.post("/api/billing/webhook", {
    headers: { "stripe-signature": "t=1,v1=deadbeef" },
    data: { id: "evt_forged2", type: "checkout.session.completed", data: { object: {} } },
  });
  expect(response.status()).toBe(400);
});
