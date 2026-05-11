"use client";

import { useActionState } from "react";

import type { AgencyActionState } from "@/app/(dashboard)/dashboard/agency-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: AgencyActionState = {};

export function CreateAgencyForm({
  action,
}: {
  action: (
    prev: AgencyActionState,
    formData: FormData,
  ) => Promise<AgencyActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-2">
        <Label htmlFor="agency-name">Agency name</Label>
        <Input
          id="agency-name"
          name="name"
          placeholder="Nova Growth Partners"
          required
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create agency"}
      </Button>
      {state.error ? (
        <p className="text-destructive w-full text-sm sm:order-last" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
