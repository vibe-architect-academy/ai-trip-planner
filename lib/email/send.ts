import { Resend } from "resend";
import { logError, logInfo } from "@/lib/log";
import { siteUrl } from "@/lib/site";

/**
 * Transactional email.
 *
 * Two kinds of message live here and they want opposite handling.
 *
 * A **share invite** is sent while the person is standing there watching. If
 * it fails they need to know now, so that one is sent inline and its failure
 * reaches the UI.
 *
 * A **welcome** or **your itinerary is ready** is nobody's blocking concern.
 * Those go through the queue, because making someone wait on an SMTP
 * handshake to see their own trip is a strange thing to do to them.
 */

let cached: Resend | null = null;

function resend(): Resend {
  if (cached) return cached;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set.");
  cached = new Resend(key);
  return cached;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/** Escapes anything a person typed before it goes near an HTML email. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout(heading: string, body: string, action?: { label: string; url: string }) {
  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1e293b">
  <h1 style="font-size:22px;margin:0 0 16px">${heading}</h1>
  <div style="font-size:15px;line-height:1.6;color:#475569">${body}</div>
  ${
    action
      ? `<p style="margin:28px 0 0"><a href="${action.url}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 20px;border-radius:9px;font-weight:600">${action.label}</a></p>`
      : ""
  }
  <p style="margin:32px 0 0;font-size:13px;color:#94a3b8">AI Trip Planner</p>
</div>`.trim();
}

type SendResult = { sent: boolean; error?: string };

async function send(to: string, subject: string, html: string): Promise<SendResult> {
  if (!isEmailConfigured()) return { sent: false, error: "Email is not configured." };

  try {
    const { error } = await resend().emails.send({
      from: process.env.EMAIL_FROM as string,
      to,
      subject,
      html,
    });

    if (error) {
      logError("email.rejected", new Error(error.message), { subject });
      return { sent: false, error: "That email could not be sent." };
    }

    logInfo("email.sent", { subject });
    return { sent: true };
  } catch (error) {
    logError("email.failed", error, { subject });
    return { sent: false, error: "That email could not be sent." };
  }
}

/** Sent while the sharer waits, so its failure is theirs to see. */
export function sendShareInvite(input: {
  to: string;
  fromName: string;
  tripTitle: string;
  shareUrl: string;
}): Promise<SendResult> {
  const who = escapeHtml(input.fromName);
  const title = escapeHtml(input.tripTitle);

  return send(
    input.to,
    `${who} shared a trip with you`,
    layout(
      `${who} shared a trip with you`,
      `<p><strong>${title}</strong> is ready to look at. Nothing to install and no account needed.</p>`,
      { label: "Open the itinerary", url: input.shareUrl },
    ),
  );
}

export function sendWelcome(to: string): Promise<SendResult> {
  return send(
    to,
    "Welcome to AI Trip Planner",
    layout(
      "Describe a trip, get a real plan",
      "<p>Type where you want to go and how long for, and an itinerary appears day by day. Your trips are saved, so you can come back to them.</p>",
      { label: "Plan a trip", url: siteUrl },
    ),
  );
}

export function sendItineraryReady(input: {
  to: string;
  tripTitle: string;
  tripUrl: string;
}): Promise<SendResult> {
  return send(
    input.to,
    "Your itinerary is ready",
    layout(
      "Your itinerary is ready",
      `<p><strong>${escapeHtml(input.tripTitle)}</strong> is finished and waiting.</p>`,
      { label: "See the plan", url: input.tripUrl },
    ),
  );
}
