import { AppSidebar } from "@/components/layout/app-sidebar";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { listMemberAgencies, resolveActiveAgencyId } from "@/lib/auth/agency-context";
import { getSessionOptional } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let email: string | null = null;
  let name: string | null = null;
  let agencies: {
    id: string;
    name: string;
    role: import("@/lib/auth/agency-context").AgencyMemberRole;
  }[] = [];
  let activeAgencyId: string | null = null;

  if (isSupabaseConfigured()) {
    const session = await getSessionOptional();
    if (session) {
      email = session.user.email ?? null;
      name =
        (typeof session.user.user_metadata?.full_name === "string"
          ? session.user.user_metadata.full_name
          : null) ?? null;
      agencies = await listMemberAgencies(session.supabase, session.user.id);
      activeAgencyId = await resolveActiveAgencyId(
        session.supabase,
        session.user.id,
      );
    }
  }

  return (
    <div className="bg-background text-foreground flex min-h-screen">
      <AppSidebar className="hidden md:flex" />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader
          email={email}
          name={name}
          agencies={agencies}
          activeAgencyId={activeAgencyId}
        />
        <main className="relative flex-1 overflow-x-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-20%,oklch(0.55_0.22_250_/0.12),transparent)]" />
          <div className="relative z-10 mx-auto max-w-[1600px] space-y-6 p-4 md:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
