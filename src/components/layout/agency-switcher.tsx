"use client";

import { switchActiveAgency } from "@/server/actions/agency";
import type { AgencyMemberRole } from "@/lib/auth/agency-context";
import { cn } from "@/lib/utils";

export function AgencySwitcher({
  agencies,
  activeAgencyId,
}: {
  agencies: { id: string; name: string; role: AgencyMemberRole }[];
  activeAgencyId: string | null;
}) {
  if (agencies.length <= 1) {
    const only = agencies[0];
    if (!only) return null;
    return (
      <div className="text-muted-foreground hidden max-w-[200px] truncate text-xs sm:block">
        {only.name}
      </div>
    );
  }

  return (
    <form action={switchActiveAgency} className="hidden sm:block">
      <label htmlFor="agency-switch" className="sr-only">
        Active workspace
      </label>
      <select
        id="agency-switch"
        name="agencyId"
        defaultValue={activeAgencyId ?? ""}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className={cn(
          "border-border/60 bg-background/80 text-foreground focus-visible:ring-ring h-8 max-w-[220px] truncate rounded-md border px-2 text-xs outline-none focus-visible:ring-2",
        )}
      >
        {agencies.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} ({a.role})
          </option>
        ))}
      </select>
    </form>
  );
}
