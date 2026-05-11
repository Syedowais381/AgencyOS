"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { insertActivityEvent } from "@/lib/activity/events";
import { encryptJson } from "@/lib/crypto/integration-secrets";
import { requireAgencyAdmin } from "@/lib/auth/agency-context";
import { requireSession } from "@/lib/auth/session";
import { GhlClient } from "@/lib/integrations/gohighlevel/client";
import type { GhlStoredCredential } from "@/lib/integrations/gohighlevel/types";
import { getServerEnv, isIntegrationEncryptionConfigured } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";

const connectSchema = z.object({
  agencyId: z.string().uuid(),
  locationId: z.string().min(3),
  accessToken: z.string().min(10),
  tokenKind: z.enum(["pit", "oauth"]).default("pit"),
  refreshToken: z.string().optional(),
  expiresAt: z.string().optional(),
});

export type GhlConnectState = { error?: string; success?: boolean };

export async function connectGoHighLevel(
  _prev: GhlConnectState,
  formData: FormData,
): Promise<GhlConnectState> {
  const parsed = connectSchema.safeParse({
    agencyId: String(formData.get("agencyId") ?? ""),
    locationId: String(formData.get("locationId") ?? "").trim(),
    accessToken: String(formData.get("accessToken") ?? "").trim(),
    tokenKind: (String(formData.get("tokenKind") ?? "pit") || "pit") as "pit" | "oauth",
    refreshToken: String(formData.get("refreshToken") ?? "").trim() || undefined,
    expiresAt: String(formData.get("expiresAt") ?? "").trim() || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  if (!isIntegrationEncryptionConfigured()) {
    return {
      error:
        "Server misconfiguration: set INTEGRATION_ENCRYPTION_KEY (32-byte hex or base64) in the server environment.",
    };
  }

  const ctx = await requireSession();
  await requireAgencyAdmin(ctx, parsed.data.agencyId);

  const cred: GhlStoredCredential =
    parsed.data.tokenKind === "oauth"
      ? {
          kind: "oauth",
          accessToken: parsed.data.accessToken,
          refreshToken: parsed.data.refreshToken,
          expiresAt: parsed.data.expiresAt,
          locationId: parsed.data.locationId,
        }
      : {
          kind: "pit",
          accessToken: parsed.data.accessToken,
          locationId: parsed.data.locationId,
        };

  const testClient = new GhlClient({
    credential: cred,
    clientId: getServerEnv().GHL_OAUTH_CLIENT_ID,
    clientSecret: getServerEnv().GHL_OAUTH_CLIENT_SECRET,
  });

  try {
    await testClient.getPipelines();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Token validation failed";
    return { error: msg };
  }

  const { data: integration, error: intErr } = await ctx.supabase
    .from("integrations")
    .upsert(
      {
        agency_id: parsed.data.agencyId,
        provider: "gohighlevel",
        status: "connected",
        health_status: "healthy",
        external_location_id: parsed.data.locationId,
        config: {
          locationId: parsed.data.locationId,
          tokenType: parsed.data.tokenKind,
        },
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "agency_id,provider" },
    )
    .select("id")
    .single();

  if (intErr || !integration) {
    return { error: intErr?.message ?? "Failed to save integration row" };
  }

  const enc = encryptJson(cred);
  const admin = createAdminClient();
  const { error: credErr } = await admin.from("integration_credentials").upsert({
    integration_id: integration.id,
    ciphertext: enc.ciphertext,
    iv: enc.iv,
    auth_tag: enc.authTag,
    key_version: enc.keyVersion,
    updated_at: new Date().toISOString(),
  });

  if (credErr) {
    return { error: credErr.message };
  }

  await insertActivityEvent(ctx.supabase, {
    agency_id: parsed.data.agencyId,
    actor_id: ctx.user.id,
    type: "integration_connected",
    title: "GoHighLevel connected",
    body: `Location ${parsed.data.locationId}`,
    metadata: { integrationId: integration.id },
    entity_type: "integration",
    entity_id: integration.id,
  });

  revalidatePath("/dashboard/integrations");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function disconnectGoHighLevel(formData: FormData) {
  const agencyId = String(formData.get("agencyId") ?? "");
  const integrationId = String(formData.get("integrationId") ?? "");
  if (!agencyId || !integrationId) throw new Error("Missing fields");

  const ctx = await requireSession();
  await requireAgencyAdmin(ctx, agencyId);

  const admin = createAdminClient();
  await admin.from("integration_credentials").delete().eq("integration_id", integrationId);

  const { error } = await ctx.supabase
    .from("integrations")
    .update({
      status: "disconnected",
      health_status: "unknown",
      external_location_id: null,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", integrationId)
    .eq("agency_id", agencyId);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/integrations");
}
