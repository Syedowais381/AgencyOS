import { Menu } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AgencySwitcher } from "@/components/layout/agency-switcher";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { UserMenu } from "@/components/layout/user-menu";
import type { AgencyMemberRole } from "@/lib/auth/agency-context";
import { cn } from "@/lib/utils";

export async function DashboardHeader({
  email,
  name,
  agencies,
  activeAgencyId,
  sectionTitle,
}: {
  email: string | null;
  name: string | null;
  agencies: { id: string; name: string; role: AgencyMemberRole }[];
  activeAgencyId: string | null;
  sectionTitle?: string;
}) {
  return (
    <header className="border-border/60 bg-background/70 sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b px-4 backdrop-blur-xl md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Sheet>
          <SheetTrigger
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "md:hidden",
            )}
          >
            <Menu className="size-5" />
            <span className="sr-only">Open navigation</span>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <AppSidebar className="w-full border-0" />
          </SheetContent>
        </Sheet>
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-widest">
            Command
          </p>
          <p className="truncate text-sm font-semibold tracking-tight">
            {sectionTitle ?? "Overview"}
          </p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-2">
          <AgencySwitcher agencies={agencies} activeAgencyId={activeAgencyId} />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <UserMenu email={email} name={name} />
      </div>
    </header>
  );
}
