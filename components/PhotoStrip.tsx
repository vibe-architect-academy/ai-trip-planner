"use client";

import Image from "next/image";
import { useState } from "react";

type Photo = { id: string; url: string; caption: string | null };

export default function PhotoStrip({
  tripId,
  initialPhotos,
}: {
  tripId: string;
  initialPhotos: Photo[];
}) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  async function upload(files: FileList | null) {
    if (!files?.length) return;

    setIsUploading(true);
    setError("");

    // One at a time, on purpose. Twenty parallel uploads is how you find out
    // what your rate limits are. Lesson 19 is where this becomes a real queue.
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

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-lg font-semibold">Inspiration</h3>
        <label className="focus-ring cursor-pointer rounded-lg px-2.5 py-1.5 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
          {isUploading ? "Uploading..." : "Add photos"}
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
          No photos yet. JPEG or PNG, up to 4MB each.
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((photo) => (
            <li
              key={photo.id}
              className="relative aspect-square overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800"
            >
              <Image
                src={photo.url}
                alt={photo.caption ?? "Trip inspiration photo"}
                fill
                sizes="(min-width: 640px) 25vw, 33vw"
                className="object-cover"
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
