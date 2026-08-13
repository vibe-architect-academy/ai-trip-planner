/**
 * Photos for one trip.
 *
 * The file goes to Vercel Blob and only its URL goes in the database. Storing
 * images in Postgres works right up until it does not: rows get enormous, every
 * query that touches the table drags megabytes around, and backups balloon.
 * Files belong in a file store.
 */

import { put } from "@vercel/blob";
import { logError, logInfo } from "@/lib/log";
import { getViewer, unauthorized, forbidden } from "@/lib/auth";
import { addPhoto, listPhotos, countPhotos, ownsTrip } from "@/lib/db/photos";
import { isDatabaseConfigured } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

/**
 * 4MB. A serverless function can only receive about 4.5MB in a request, so
 * anything larger has to go from the browser straight to Blob instead of
 * passing through here. This limit keeps uploads on the simple path.
 */
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_PHOTOS_PER_TRIP = 20;

/** Only these two. An "image/*" check trusts a header the browser chose. */
const ALLOWED = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
]);

/**
 * Reads the real type from the file's first bytes.
 *
 * The Content-Type on an upload is whatever the client says it is, so a
 * script renamed to .jpg arrives claiming to be an image. These are the magic
 * numbers for JPEG and PNG, and they are the file actually telling you.
 */
function sniff(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  return null;
}

export async function GET(_request: Request, { params }: Params) {
  const viewer = await getViewer();
  if (!viewer) return unauthorized();
  if (viewer.banned) return forbidden("This account has been suspended.");
  if (!isDatabaseConfigured()) {
    return Response.json({ error: "The database is not configured." }, { status: 500 });
  }

  const { id } = await params;

  try {
    if (!(await ownsTrip(id, viewer.userId))) {
      return Response.json({ error: "No such trip." }, { status: 404 });
    }
    return Response.json({ photos: await listPhotos(id, viewer.userId) });
  } catch (error) {
    logError("photos.list_failed", error, { userId: viewer.userId, tripId: id });
    return Response.json({ error: "We could not load those photos." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: Params) {
  const viewer = await getViewer();
  if (!viewer) return unauthorized();
  if (viewer.banned) return forbidden("This account has been suspended.");

  const { id } = await params;

  if (!process.env.BLOB_READ_WRITE_TOKEN || !isDatabaseConfigured()) {
    logError("photos.misconfigured", new Error("Blob or database not configured"));
    return Response.json({ error: "Uploads are unavailable right now." }, { status: 500 });
  }

  try {
    // Own the trip first. Everything below costs storage, so this is the check
    // that has to happen before any of it.
    if (!(await ownsTrip(id, viewer.userId))) {
      return Response.json({ error: "No such trip." }, { status: 404 });
    }

    if ((await countPhotos(id, viewer.userId)) >= MAX_PHOTOS_PER_TRIP) {
      return Response.json(
        { error: `That trip already has ${MAX_PHOTOS_PER_TRIP} photos.` },
        { status: 409 },
      );
    }

    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return Response.json({ error: "No file was attached." }, { status: 400 });
    }
    if (file.size === 0) {
      return Response.json({ error: "That file is empty." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return Response.json({ error: "Photos have to be under 4MB." }, { status: 413 });
    }

    const buffer = await file.arrayBuffer();
    const actualType = sniff(new Uint8Array(buffer));

    if (!actualType || !ALLOWED.has(actualType)) {
      // Worth logging: a mismatch between the claimed and actual type is
      // either a confused browser or somebody trying something.
      logInfo("photos.rejected_type", {
        userId: viewer.userId,
        tripId: id,
        claimed: file.type,
        actual: actualType ?? "unrecognised",
      });
      return Response.json({ error: "Only JPEG and PNG images." }, { status: 415 });
    }

    const blob = await put(
      `trips/${id}/${crypto.randomUUID()}.${ALLOWED.get(actualType)}`,
      buffer,
      {
        access: "public",
        contentType: actualType,
        // Blob would otherwise reuse a name and quietly overwrite.
        addRandomSuffix: false,
      },
    );

    const photo = await addPhoto({
      tripId: id,
      userId: viewer.userId,
      url: blob.url,
      pathname: blob.pathname,
    });

    logInfo("photos.uploaded", { userId: viewer.userId, tripId: id, bytes: file.size });
    return Response.json({ photo }, { status: 201 });
  } catch (error) {
    logError("photos.upload_failed", error, { userId: viewer.userId, tripId: id });
    return Response.json({ error: "That upload did not work. Try again." }, { status: 500 });
  }
}
