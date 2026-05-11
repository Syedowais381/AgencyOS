"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAgencyMember } from "@/lib/auth/agency-context";
import { requireSession } from "@/lib/auth/session";

const schema = z.object({
  agencyId: z.string().uuid(),
});

export async function switchActiveAgency(formData: FormData) {
  const parsed = schema.safeParse({
    agencyId: String(formData.get("agencyId") ?? ""),
  });
  if (!parsed.success) {
    throw new Error("Invalid agency");
  }

  const ctx = await requireSession();
  await requireAgencyMember(ctx, parsed.data.agencyId);

  const { error } = await ctx.supabase.from("user_preferences").upsert({
    user_id: ctx.user.id,
    active_agency_id: parsed.data.agencyId,
    updated_at: new Date().toISOString(),
  });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard", "layout");
}
