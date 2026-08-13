import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * The bouncer at the door.
 *
 * A check that lives in a component runs in the browser, and anything that runs
 * in the browser can be walked straight past. This runs before any of that, so
 * "you must be signed in" is a fact rather than a suggestion.
 *
 * It is deliberately not the only check. Next's own docs say this layer suits
 * optimistic checks and is "not intended for ... full session management or
 * authorization", so every route handler asks again before doing real work.
 * This keeps people out of pages. The handlers keep them out of data.
 *
 * The file is proxy.ts rather than middleware.ts because Next 16 renamed the
 * convention. Same thing, new name.
 */

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/suspended",
  // The same answer for everyone, and cached at the edge. Putting a session
  // check in front of a cacheable response defeats the caching, because the
  // CDN can no longer answer without asking us who is calling.
  "/api/destinations",
  /*
   * Background workers. QStash is not a person and has no session, so a
   * sign-in check here would redirect every job to a login page and nothing
   * would ever be processed.
   *
   * "Public" here means only that Clerk does not guard it. These routes are
   * not unguarded: each one verifies QStash's signature and refuses anything
   * it cannot prove came from the queue.
   */
  "/api/jobs/(.*)",
]);

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

/**
 * An API route answers a program, not a person.
 *
 * Sending it to a sign-in page produces a 307 to some HTML, which a fetch()
 * follows and then fails to parse as JSON, so the caller sees a parse error
 * instead of "you are not signed in". Say 401 and let the client decide what
 * to do about it.
 */
const isApiRoute = createRouteMatcher(["/api/(.*)"]);

function unauthorizedJson() {
  return Response.json({ error: "You need to be signed in." }, { status: 401 });
}

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) return;

  const { userId, sessionClaims, redirectToSignIn } = await auth();

  if (!userId) {
    return isApiRoute(request)
      ? unauthorizedJson()
      : redirectToSignIn({ returnBackUrl: request.url });
  }

  const metadata = (sessionClaims?.publicMetadata ?? {}) as {
    role?: string;
    banned?: boolean;
  };

  // A banned account still has a valid session. Being signed in and being
  // allowed in are different questions, and this is the one that matters.
  if (metadata.banned) {
    return isApiRoute(request)
      ? Response.json({ error: "This account has been suspended." }, { status: 403 })
      : NextResponse.redirect(new URL("/suspended", request.url));
  }

  // Regular users do not get told that /admin exists. They just go home.
  if (isAdminRoute(request) && metadata.role !== "admin") {
    return NextResponse.redirect(new URL("/", request.url));
  }
});

export const config = {
  matcher: [
    // Everything except Next's internals and static files, plus every API route.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
