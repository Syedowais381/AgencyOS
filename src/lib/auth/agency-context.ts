import "server-only";

import { redirect } from "next/navigation";

import type { SessionContext } from "@/lib/auth/session";

export type AgencyMemberRole = "owner" | "admin" | "member";

export type AgencyRow = {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
};

export type AgencyContext = SessionContext & {
  agencyId: string;
  agency: AgencyRow;
  memberRole: AgencyMemberRole;
};

export async function resolveActiveAgencyId(
  supabase: SessionContext["supabase"],
  userId: string,
): Promise<string | null> {
  const { data: pref } = await supabase
    .from("user_preferences")
    .select("active_agency_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (pref?.active_agency_id) {
    const { data: membership } = await supabase
      .from("agency_members")
      .select("agency_id")
      .eq("user_id", userId)
      .eq("agency_id", pref.active_agency_id)
      .maybeSingle();
    if (membership) {
      return pref.active_agency_id;
    }
  }

  const { data: first } = await supabase
    .from("agency_members")
    .select("agency_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return first?.agency_id ?? null;
}

export async function listMemberAgencies(
  supabase: SessionContext["supabase"],
  userId: string,
): Promise<
  { id: string; name: string; slug: string; role: AgencyMemberRole }[]
> {
  const { data, error } = await supabase
    .from("agency_members")
    .select("role, agencies ( id, name, slug )")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data
    .map((row) => {
      const raw = row.agencies as unknown;
      const a = (Array.isArray(raw) ? raw[0] : raw) as
        | { id: string; name: string; slug: string }
        | null
        | undefined;
      if (!a?.id) return null;
      return {
        id: a.id,
        name: a.name,
        slug: a.slug,
        role: row.role as AgencyMemberRole,
      };
    })
    .filter(Boolean) as {
    id: string;
    name: string;
    slug: string;
    role: AgencyMemberRole;
  }[];
}

export async function getActiveAgency(
  ctx: SessionContext,
): Promise<AgencyContext | null> {
  const agencyId = await resolveActiveAgencyId(ctx.supabase, ctx.user.id);
  if (!agencyId) return null;

  const { data: agency, error: aErr } = await ctx.supabase
    .from("agencies")
    .select("*")
    .eq("id", agencyId)
    .single();

  if (aErr || !agency) return null;

  const { data: mem, error: mErr } = await ctx.supabase
    .from("agency_members")
    .select("role")
    .eq("agency_id", agencyId)
    .eq("user_id", ctx.user.id)
    .single();

  if (mErr || !mem) return null;

  return {
    ...ctx,
    agencyId,
    agency,
    memberRole: mem.role as AgencyMemberRole,
  };
}

export async function requireAgencyMember(
  ctx: SessionContext,
  agencyId: string,
): Promise<{ memberRole: AgencyMemberRole }> {
  const { data, error } = await ctx.supabase
    .from("agency_members")
    .select("role")
    .eq("agency_id", agencyId)
    .eq("user_id", ctx.user.id)
    .maybeSingle();

  if (error || !data) {
    redirect("/dashboard?forbidden=1");
  }

  return { memberRole: data.role as AgencyMemberRole };
}

export async function requireAgencyAdmin(
  ctx: SessionContext,
  agencyId: string,
) {
  const { memberRole } = await requireAgencyMember(ctx, agencyId);
  if (memberRole !== "owner" && memberRole !== "admin") {
    redirect("/dashboard?forbidden=1");
  }
}
