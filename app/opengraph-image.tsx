import { ImageResponse } from "next/og";
import { siteName, siteDescription } from "@/lib/site";

/**
 * The link preview card, drawn at build time rather than kept as a PNG.
 *
 * Keeping it as code means it cannot drift out of date the way a checked-in
 * image does, and it is one fewer binary in the repo.
 */

export const alt = siteName;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(140deg, #f8fafc 0%, #eef2ff 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", fontSize: 76, fontWeight: 700, color: "#0f172a" }}
        >
          {siteName}
          {/*
            A drawn shape, not the ✦ character. Satori fetches a font per
            glyph, and an ornamental one sends it looking for a font it cannot
            get, which fails the whole image. Nothing here needs a glyph.
          */}
          <div
            style={{
              width: 34,
              height: 34,
              marginLeft: 24,
              background: "#4f46e5",
              transform: "rotate(45deg)",
              borderRadius: 6,
            }}
          />
        </div>
        <div style={{ marginTop: 20, fontSize: 36, color: "#475569" }}>
          {siteDescription}
        </div>
      </div>
    ),
    size,
  );
}
