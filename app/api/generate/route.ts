/**
 * The kitchen.
 *
 * This file never runs in the browser. It runs on the server, which is the
 * only reason GEMINI_API_KEY is safe to read here. The browser sends a
 * destination and a number of days, and gets back an itinerary. It has no
 * idea which AI produced it, or that there is a key involved at all.
 */

const MODEL = "gemini-2.5-flash";

function buildPrompt(destination: string, days: number): string {
  return [
    `Plan a ${days}-day trip to ${destination}.`,
    "For each day give a morning activity, an afternoon activity, an evening",
    "activity, and a restaurant recommendation, with specific real places.",
    'Format: a heading per day like "### Day 1", then 4 short bullet points.',
    "No intro or outro text, start directly with Day 1.",
  ].join(" ");
}

export async function POST(request: Request) {
  // Validate what the caller sent before anything else. A bad request is the
  // caller's problem whether or not the server happens to be configured, and
  // answering 500 to a request that was never valid just sends people hunting
  // for a server fault that does not exist.
  const body = await request.json();
  const destination = String(body.destination ?? "").trim();
  const days = Number(body.days);

  if (!destination) {
    return Response.json({ error: "Tell me where you want to go." }, { status: 400 });
  }
  if (!Number.isInteger(days) || days < 1 || days > 7) {
    return Response.json({ error: "Pick between 1 and 7 days." }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "The server has no AI key configured." },
      { status: 500 },
    );
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  const upstream = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(destination, days) }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000,
        // Thinking is on by default for 2.5 Flash, and it buys nothing here
        // except a long silence before the first word.
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  if (!upstream.ok) {
    return Response.json(
      { error: "The AI could not plan that trip. Try again." },
      { status: 502 },
    );
  }

  const data = await upstream.json();
  const itinerary: string =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  return Response.json({ destination, days, itinerary });
}
