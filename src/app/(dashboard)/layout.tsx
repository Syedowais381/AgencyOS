import { AppSidebar } from "@/components/layout/app-sidebar";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let email: string | null = null;
  let name: string | null = null;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    email = user?.email ?? null;
    name =
      (typeof user?.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : null) ?? null;
  }

  return (
    <div className="bg-background text-foreground flex min-h-screen">
      <AppSidebar className="hidden md:flex" />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader email={email} name={name} />
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
