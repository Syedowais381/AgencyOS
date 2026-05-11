import { Menu } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { UserMenu } from "@/components/layout/user-menu";
import { cn } from "@/lib/utils";

export async function DashboardHeader({
  email,
  name,
}: {
  email: string | null;
  name: string | null;
}) {
  return (
    <header className="border-border/60 bg-background/70 sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b px-4 backdrop-blur-xl md:px-6">
      <div className="flex items-center gap-2">
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
        <div>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-widest">
            Command
          </p>
          <p className="text-sm font-semibold tracking-tight">Overview</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <UserMenu email={email} name={name} />
      </div>
    </header>
  );
}
