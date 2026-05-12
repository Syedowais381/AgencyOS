"use client";

import { useRef, useTransition } from "react";
import { LogOut, User } from "lucide-react";

import { signOut } from "@/app/(dashboard)/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function initials(name: string | null, email: string | null) {
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "U";
}

export function UserMenu({
  email,
  name,
}: {
  email: string | null;
  name: string | null;
}) {
  const label = name || email || "Account";
  const signoutFormRef = useRef<HTMLFormElement | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "relative size-9 overflow-hidden rounded-full p-0 ring-1 ring-border/80",
        )}
      >
        <Avatar className="size-9">
          <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
            {initials(name, email)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{label}</p>
            {email ? (
              <p className="text-muted-foreground text-xs leading-none">
                {email}
              </p>
            ) : null}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="gap-2">
          <User className="size-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form ref={signoutFormRef} action={signOut} />
        <DropdownMenuItem
          disabled={pending}
          className="gap-2 text-destructive focus:text-destructive"
          onSelect={(e) => {
            e.preventDefault();
            startTransition(() => {
              signoutFormRef.current?.requestSubmit();
            });
          }}
        >
          <LogOut className="size-4" />
          {pending ? "Signing out..." : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
