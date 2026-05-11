"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48);
}

export type AgencyActionState = { error?: string; success?: boolean };

export async function createAgency(
  _prev: AgencyActionState,
  formData: FormData,
): Promise<AgencyActionState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "Agency name is required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." };
  }

  const base = slugify(name);
  const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;

  const { data: agency, error } = await supabase
    .from("agencies")
    .insert({
      name,
      slug,
      owner_id: user.id,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  if (agency?.id) {
    await supabase.from("user_preferences").upsert({
      user_id: user.id,
      active_agency_id: agency.id,
      updated_at: new Date().toISOString(),
    });
  }

  revalidatePath("/dashboard");
  return { success: true };
}
