import { after } from "next/server";
import { NextResponse } from "next/server";

import { assertWebhookNotReplayed, verifyGhlWebhookSignature } from "@/lib/webhooks/ghl-signature";
import { processGhlWebhookDelivery } from "@/lib/webhooks/process-ghl-webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();

  const verified = verifyGhlWebhookSignature(rawBody, request.headers);
  if (!verified.ok) {
    return NextResponse.json(
      { error: "invalid_signature", reason: verified.reason },
      { status: 401 },
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const replay = assertWebhookNotReplayed({
    timestamp:
      typeof payload.timestamp === "string" ? payload.timestamp : undefined,
    webhookId:
      typeof payload.webhookId === "string" ? payload.webhookId : undefined,
  });
  if (!replay.ok) {
    return NextResponse.json({ error: replay.reason }, { status: 400 });
  }

  after(async () => {
    try {
      await processGhlWebhookDelivery({ rawBody, payload });
    } catch (e) {
      console.error("[ghl-webhook]", e);
    }
  });

  return NextResponse.json({ received: true });
}
