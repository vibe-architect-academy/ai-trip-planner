"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

type Photo = {
  id: string;
  url: string;
  caption: string | null;
  status: string;
};

export type PhotoLabels = {
  heading: string;
  add: string;
  uploading: string;
  empty: string;
};

export default function PhotoStrip({
  tripId,
  initialPhotos,
  labels,
}: {
  tripId: string;
  initialPhotos: Photo[];
  labels: PhotoLabels;
}) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  const pending = photos.filter((photo) => photo.status === "processing").length;
  const ready = photos.filter((photo) => photo.status === "ready").length;

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/trips/${tripId}/photos`);
      if (!response.ok) return;
      const data = await response.json();
      setPhotos(data.photos ?? []);
    } catch {
      // A failed poll is not worth telling anyone about. The next one will
      // either work or the photos will still say "processing", which is true.
    }
  }, [tripId]);

  /**
   * Poll only while something is actually outstanding.
   *
   * The interval is torn down the moment the last photo finishes, so an idle
   * tab left open overnight is not quietly asking the server for updates
   * every two seconds until morning.
   */
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  useEffect(() => {
    if (pending === 0) return;
    const timer = setInterval(() => {
      if (pendingRef.current === 0) return;
      refresh();
    }, 2500);
    return () => clearInterval(timer);
  }, [pending, refresh]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;

    setIsUploading(true);
    setError("");

    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append("file", file);

      try {
        const response = await fetch(`/api/trips/${tripId}/photos`, {
          method: "POST",
          body: form,
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          setError(data.error ?? "That upload did not work.");
          continue;
        }
        setPhotos((current) => [...current, data.photo]);
      } catch {
        setError("We could not reach the server. Check your connection.");
      }
    }

    setIsUploading(false);
  }

  async function retry(photoId: string) {
    setPhotos((current) =>
      current.map((photo) =>
        photo.id === photoId ? { ...photo, status: "processing" } : photo,
      ),
    );
    await fetch(`/api/trips/${tripId}/photos/${photoId}/retry`, { method: "POST" }).catch(
      () => {},
    );
    refresh();
  }

  return (
    <section className="mt-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold">{labels.heading}</h3>
        <div className="flex items-center gap-3">
          {pending > 0 && (
            <span
              role="status"
              aria-live="polite"
              className="text-sm text-slate-500 dark:text-slate-400"
            >
              {ready} of {photos.length} photos ready
            </span>
          )}
          <label className="focus-ring inline-flex min-h-11 cursor-pointer items-center rounded-lg px-2 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            {isUploading ? labels.uploading : labels.add}
            <input
              type="file"
              accept="image/jpeg,image/png"
              multiple
              disabled={isUploading}
              className="sr-only"
              onChange={(event) => {
                upload(event.target.files);
                // Clear it, or picking the same file twice does nothing.
                event.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </p>
      )}

      {photos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          {labels.empty}
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {photos.map((photo) => (
            <li
              key={photo.id}
              className="relative aspect-square overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800"
            >
              <Image
                src={photo.url}
                alt={photo.caption ?? "Trip inspiration photo"}
                fill
                sizes="(min-width: 1024px) 16vw, (min-width: 640px) 25vw, 33vw"
                className={`object-cover transition-opacity ${
                  photo.status === "ready" ? "opacity-100" : "opacity-50"
                }`}
              />

              {photo.status === "processing" && (
                <span className="absolute inset-x-1 bottom-1 rounded bg-slate-900/75 px-1.5 py-0.5 text-center text-[11px] font-medium text-white">
                  Processing...
                </span>
              )}

              {photo.status === "failed" && (
                <button
                  type="button"
                  onClick={() => retry(photo.id)}
                  className="focus-ring absolute inset-x-1 bottom-1 rounded bg-red-600/90 px-1.5 py-0.5 text-center text-[11px] font-medium text-white hover:bg-red-700"
                >
                  Failed, retry
                </button>
              )}

              {photo.status === "ready" && photo.caption && (
                <span className="sr-only">{photo.caption}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
