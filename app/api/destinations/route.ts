/**
 * Popular destinations. The same answer for everybody, so it should be
 * computed as close to nobody as possible.
 *
 * This is the shape of response that belongs on a CDN: identical for every
 * visitor, changes rarely, and is needed on first paint. A visitor in Tokyo
 * gets it from a machine in Tokyo instead of a round trip to wherever this
 * function happens to run.
 *
 * The contrast worth holding on to is /api/trips, which must never be cached
 * anywhere. Caching a personal response at the edge is how one person's data
 * gets served to the next person who asks.
 */

const DESTINATIONS = [
  { slug: "kyoto", name: "Kyoto", country: "Japan" },
  { slug: "lisbon", name: "Lisbon", country: "Portugal" },
  { slug: "barcelona", name: "Barcelona", country: "Spain" },
  { slug: "rome", name: "Rome", country: "Italy" },
  { slug: "reykjavik", name: "Reykjavik", country: "Iceland" },
  { slug: "mexico-city", name: "Mexico City", country: "Mexico" },
  { slug: "marrakesh", name: "Marrakesh", country: "Morocco" },
  { slug: "queenstown", name: "Queenstown", country: "New Zealand" },
];

export async function GET() {
  return Response.json(
    { destinations: DESTINATIONS },
    {
      headers: {
        /*
         * Cached at the edge for a day. stale-while-revalidate means the next
         * visitor after it expires still gets an instant answer from the cache
         * while it refreshes behind them, so nobody ever waits for the refresh.
         */
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}
