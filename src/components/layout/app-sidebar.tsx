"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

import { accentNav, mainNav } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const listVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0 },
};

export function AppSidebar({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "border-border/60 bg-sidebar/80 flex h-full w-64 shrink-0 flex-col border-r backdrop-blur-xl",
        className,
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b border-border/60 px-4">
        <div className="bg-primary/20 text-primary flex size-8 items-center justify-center rounded-lg text-xs font-bold tracking-widest ring-1 ring-primary/40">
          AI
        </div>
        <div className="leading-tight">
          <p className="text-sidebar-foreground text-sm font-semibold tracking-tight">
            AOS
          </p>
          <p className="text-muted-foreground text-[11px]">Agency OS</p>
        </div>
      </div>
      <ScrollArea className="flex-1 px-2 py-3">
        <motion.nav
          className="space-y-1"
          initial="hidden"
          animate="show"
          variants={listVariants}
        >
          {mainNav.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <motion.div key={item.href} variants={itemVariants}>
                <Link
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  )}
                >
                  <item.icon className="size-4 shrink-0 opacity-80 group-hover:opacity-100" />
                  <span className="truncate">{item.title}</span>
                  {item.phase && item.phase > 1 ? (
                    <Badge
                      variant="outline"
                      className="ml-auto border-primary/30 text-[10px] font-normal text-primary/90"
                    >
                      P{item.phase}
                    </Badge>
                  ) : null}
                </Link>
              </motion.div>
            );
          })}
        </motion.nav>
        <Separator className="my-3 bg-border/60" />
        <p className="text-muted-foreground mb-2 px-2 text-[11px] font-medium uppercase tracking-wider">
          Labs
        </p>
        <motion.nav className="space-y-1" initial="hidden" animate="show" variants={listVariants}>
          {accentNav.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <motion.div key={item.href} variants={itemVariants}>
                <Link
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary/15 text-primary ring-1 ring-primary/25"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  )}
                >
                  <item.icon className="size-4 shrink-0" />
                  <span className="truncate">{item.title}</span>
                  {item.phase ? (
                    <Badge
                      variant="outline"
                      className="ml-auto border-primary/30 text-[10px] font-normal text-primary/90"
                    >
                      P{item.phase}
                    </Badge>
                  ) : null}
                </Link>
              </motion.div>
            );
          })}
        </motion.nav>
      </ScrollArea>
    </aside>
  );
}
