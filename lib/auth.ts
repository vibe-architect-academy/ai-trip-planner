import { auth, currentUser } from "@clerk/nextjs/server";

/**
 * Who is asking, and what they are allowed to do.
 *
 * Every server route asks here rather than trusting anything the browser
 * sent. The browser can claim to be anyone; the session token cannot.
 */

export type Role = "user" | "admin";

export type Viewer = {
  userId: string;
  role: Role;
  banned: boolean;
};

/** The signed-in user, or null. Never throws, so callers decide the answer. */
export async function getViewer(): Promise<Viewer | null> {
  const { userId, sessionClaims } = await auth();
  if (!userId) return null;

  const metadata = (sessionClaims?.publicMetadata ?? {}) as {
    role?: string;
    banned?: boolean;
  };

  return {
    userId,
    role: metadata.role === "admin" ? "admin" : "user",
    banned: metadata.banned === true,
  };
}

/**
 * The signed-in user, or a thrown 401/403 response.
 *
 * Used by API routes, where the honest answer to "who are you" being "nobody"
 * has to stop the request rather than return an empty list.
 */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw unauthorized();
  if (viewer.banned) throw forbidden("This account has been suspended.");
  return viewer;
}

export async function requireAdmin(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (viewer.role !== "admin") throw forbidden("Admins only.");
  return viewer;
}

export function unauthorized() {
  return Response.json({ error: "You need to be signed in." }, { status: 401 });
}

export function forbidden(message = "This is not yours.") {
  return Response.json({ error: message }, { status: 403 });
}

/** Display name for the admin table. Falls back rather than showing nothing. */
export async function viewerLabel(): Promise<string> {
  const user = await currentUser();
  if (!user) return "Unknown";
  return (
    user.primaryEmailAddress?.emailAddress ??
    user.username ??
    [user.firstName, user.lastName].filter(Boolean).join(" ") ??
    user.id
  );
}
