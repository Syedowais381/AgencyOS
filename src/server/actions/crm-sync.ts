"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { encryptJson } from "@/lib/crypto/integration-secrets";
import { requireAgencyMember } from "@/lib/auth/agency-context";
import { requireSession } from "@/lib/auth/session";
import { getServerEnv, isIntegrationEncryptionConfigured } from "@/lib/env.server";
import { GhlApiError } from "@/lib/integrations/gohighlevel/errors";
import { runGhlCrmSync } from "@/lib/integrations/gohighlevel/sync";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  agencyId: z.string().uuid(),
  integrationId: z.string().uuid(),
  mode: z.enum(["full", "incremental"]).default("full"),
});

export type CrmSyncState = { error?: string; success?: boolean; stats?: string };

function getActionErrorMessage(e: unknown): string {
  if (e instanceof GhlApiError) {
    const body = e.body?.trim();
    return body ? `${e.message}: ${body}` : e.message;
  }
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "Sync failed";
}

export async function triggerGhlCrmSync(
  _prev: CrmSyncState,
  formData: FormData,
): Promise<CrmSyncState> {
  const parsed = schema.safeParse({
    agencyId: String(formData.get("agencyId") ?? ""),
    integrationId: String(formData.get("integrationId") ?? ""),
    mode: (String(formData.get("mode") ?? "full") || "full") as "full" | "incremental",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  if (!isIntegrationEncryptionConfigured()) {
    return { error: "INTEGRATION_ENCRYPTION_KEY is not configured on the server." };
  }

  const ctx = await requireSession();
  await requireAgencyMember(ctx, parsed.data.agencyId);

  const { data: integ, error: intErr } = await ctx.supabase
    .from("integrations")
    .select("id, agency_id, provider")
    .eq("id", parsed.data.integrationId)
    .maybeSingle();

  if (intErr || !integ || integ.agency_id !== parsed.data.agencyId) {
    return { error: "Integration not found for this workspace." };
  }
  if (integ.provider !== "gohighlevel") {
    return { error: "Only GoHighLevel is supported for this sync action." };
  }

  const env = getServerEnv();
  const admin = createAdminClient();

  try {
    const stats = await runGhlCrmSync({
      supabaseUser: ctx.supabase,
      admin,
      integrationId: integ.id,
      agencyId: parsed.data.agencyId,
      actorUserId: ctx.user.id,
      mode: parsed.data.mode,
      encryptForPersist: (c) => encryptJson(c),
      oauthClientId: env.GHL_OAUTH_CLIENT_ID,
      oauthClientSecret: env.GHL_OAUTH_CLIENT_SECRET,
    });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/crm");
    revalidatePath("/dashboard/integrations");
    return {
      success: true,
      stats: `${stats.pipelinesUpserted} pipelines · ${stats.leadsUpserted} leads`,
    };
  } catch (e) {
    const msg = getActionErrorMessage(e);
    return { error: msg };
  }
}
