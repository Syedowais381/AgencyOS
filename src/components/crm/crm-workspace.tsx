"use client";

import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useEffect, useOptimistic, useState, useTransition } from "react";

import {
  addLeadNote,
  getLeadWorkspaceBundle,
  moveLeadToStage,
} from "@/server/actions/crm-leads";
import type { LeadRow } from "@/lib/crm/queries";
import type { LeadStage } from "@/lib/crm/guess-internal-stage";
import { formatUsdFromCents } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type StageColumnDef = {
  id: string;
  label: string;
  internalStage: LeadStage;
  externalStageId?: string | null;
};

const DEFAULT_STAGES: StageColumnDef[] = [
  { id: "new", label: "New", internalStage: "new" },
  { id: "contacted", label: "Contacted", internalStage: "contacted" },
  { id: "qualified", label: "Qualified", internalStage: "qualified" },
  { id: "appointment_set", label: "Appt set", internalStage: "appointment_set" },
  { id: "showed", label: "Showed", internalStage: "showed" },
  { id: "won", label: "Won", internalStage: "won" },
  { id: "lost", label: "Lost", internalStage: "lost" },
];

function DraggableLeadCard({
  lead,
  onOpen,
}: {
  lead: LeadRow;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `lead:${lead.id}`,
    data: { lead },
  });

  const style = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    opacity: isDragging ? 0.55 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "glass flex gap-2 rounded-xl border border-border/60 p-2 shadow-sm transition",
        isDragging && "cursor-grabbing",
      )}
    >
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground cursor-grab px-1"
        aria-label="Drag"
        {...listeners}
        {...attributes}
      >
        <GripVertical className="size-4" />
      </button>
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={onOpen}
      >
        <p className="text-sm font-semibold leading-tight">{lead.name}</p>
        <p className="text-primary mt-1 text-xs font-semibold">
          {formatUsdFromCents(lead.value_cents)}
        </p>
        {lead.external_id ? (
          <Badge variant="outline" className="mt-2 text-[10px]">
            GHL
          </Badge>
        ) : null}
      </button>
    </div>
  );
}

function StageColumn({
  stage,
  label,
  count,
  children,
}: {
  stage: string;
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `stage:${stage}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[480px] w-[260px] shrink-0 transition",
        isOver && "ring-primary/50 rounded-2xl ring-2",
      )}
    >
      <Card className="glass-panel border-border/50 h-full">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold tracking-tight">
              {label}
            </CardTitle>
            <Badge variant="outline" className="text-[10px]">
              {count}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <ScrollArea className="h-[420px] pr-2">
            <div className="space-y-3">{children}</div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

export function CrmWorkspace({
  agencyId,
  pipelineId,
  initialLeads,
  stageColumns,
}: {
  agencyId: string;
  pipelineId: string;
  initialLeads: LeadRow[];
  stageColumns?: StageColumnDef[];
}) {
  const stages = stageColumns?.length ? stageColumns : DEFAULT_STAGES;
  const leadsInPipeline = initialLeads.filter((l) => l.pipeline_id === pipelineId);
  const [optimisticLeads, addOptimistic] = useOptimistic(
    leadsInPipeline,
    (state, action: { leadId: string; toStage: LeadStage }) =>
      state.map((l) =>
        l.id === action.leadId ? { ...l, stage: action.toStage } : l,
      ),
  );

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [bundle, setBundle] = useState<Awaited<
    ReturnType<typeof getLeadWorkspaceBundle>
  > | null>(null);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!selectedLeadId) {
      setBundle(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const b = await getLeadWorkspaceBundle({
        agencyId,
        leadId: selectedLeadId,
      });
      if (!cancelled) setBundle(b);
    })();
    return () => {
      cancelled = true;
    };
  }, [agencyId, selectedLeadId]);

  function leadColumnId(lead: LeadRow) {
    const ghlMeta = (lead.metadata as { ghl?: { pipelineStageId?: string } } | null)?.ghl;
    const externalStageId = ghlMeta?.pipelineStageId;
    if (externalStageId) {
      const externalColumn = stages.find((s) => s.externalStageId === externalStageId);
      if (externalColumn) return externalColumn.id;
    }
    const fallback = stages.find((s) => s.internalStage === lead.stage);
    return fallback?.id ?? lead.stage;
  }

  function onDragEnd(event: DragEndEvent) {
    const active = String(event.active.id);
    const over = event.over?.id ? String(event.over.id) : null;
    if (!active.startsWith("lead:") || !over?.startsWith("stage:")) return;
    const leadId = active.slice("lead:".length);
    const columnId = over.slice("stage:".length);
    const targetColumn = stages.find((s) => s.id === columnId);
    if (!targetColumn) return;
    const toStage = targetColumn.internalStage;
    const lead = optimisticLeads.find((l) => l.id === leadId);
    if (!lead || lead.stage === toStage) return;

    addOptimistic({ leadId, toStage });
    startTransition(async () => {
      const fd = new FormData();
      fd.set("agencyId", agencyId);
      fd.set("leadId", leadId);
      fd.set("toStage", toStage);
      if (targetColumn.externalStageId) {
        fd.set("toExternalStageId", targetColumn.externalStageId);
      }
      await moveLeadToStage(fd);
    });
  }

  function submitNote() {
    if (!selectedLeadId || !note.trim()) return;
    const fd = new FormData();
    fd.set("agencyId", agencyId);
    fd.set("leadId", selectedLeadId);
    fd.set("body", note.trim());
    startTransition(async () => {
      await addLeadNote(fd);
      setNote("");
      const b = await getLeadWorkspaceBundle({
        agencyId,
        leadId: selectedLeadId,
      });
      setBundle(b);
    });
  }

  if (!mounted) {
    return (
      <div className="text-muted-foreground rounded-xl border border-border/50 p-4 text-sm">
        Loading CRM workspace...
      </div>
    );
  }

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {stages.map((col) => {
            const cards = optimisticLeads.filter((l) => leadColumnId(l) === col.id);
            return (
              <StageColumn
                key={col.id}
                stage={col.id}
                label={col.label}
                count={cards.length}
              >
                {cards.map((lead) => (
                  <DraggableLeadCard
                    key={lead.id}
                    lead={lead}
                    onOpen={() => setSelectedLeadId(lead.id)}
                  />
                ))}
              </StageColumn>
            );
          })}
        </div>
      </DndContext>

      <Sheet open={Boolean(selectedLeadId)} onOpenChange={(o) => !o && setSelectedLeadId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{bundle?.lead?.name ?? "Lead"}</SheetTitle>
          </SheetHeader>
          {bundle?.lead ? (
            <div className="mt-4 space-y-4 text-sm">
              <div className="text-muted-foreground space-y-1">
                <p>
                  Value:{" "}
                  <span className="text-foreground font-medium">
                    {formatUsdFromCents(bundle.lead.value_cents)}
                  </span>
                </p>
                <p>Stage: {String(bundle.lead.stage)}</p>
                {bundle.lead.email ? <p>Email: {bundle.lead.email}</p> : null}
                {bundle.lead.phone ? <p>Phone: {bundle.lead.phone}</p> : null}
              </div>

              <div>
                <p className="mb-2 font-medium">Add note</p>
                <div className="flex gap-2">
                  <Input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Call outcome, objections, next step…"
                  />
                  <Button type="button" disabled={pending} onClick={submitNote}>
                    Save
                  </Button>
                </div>
              </div>

              <div>
                <p className="mb-2 font-medium">Notes</p>
                <ul className="text-muted-foreground space-y-2">
                  {(bundle.notes ?? []).map((n) => (
                    <li key={n.id} className="rounded-lg border border-border/50 p-2">
                      {n.body}
                    </li>
                  ))}
                  {(bundle.notes ?? []).length === 0 ? (
                    <li className="text-xs">No notes yet.</li>
                  ) : null}
                </ul>
              </div>

              <div>
                <p className="mb-2 font-medium">Activity</p>
                <ul className="text-muted-foreground space-y-2 text-xs">
                  {(bundle.activities ?? []).map((a) => (
                    <li key={a.id} className="rounded-lg border border-border/50 p-2">
                      <span className="text-foreground font-medium">{a.kind}</span> ·{" "}
                      {new Date(a.created_at).toLocaleString()}
                      <pre className="text-muted-foreground mt-1 max-h-24 overflow-auto whitespace-pre-wrap">
                        {JSON.stringify(a.payload, null, 2)}
                      </pre>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground mt-4 text-sm">Loading…</p>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
