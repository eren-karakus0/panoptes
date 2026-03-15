"use client";

import { useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/hooks/use-workspace";
import { usePolicies, createPolicy } from "@/hooks/use-policies";
import { ErrorState } from "./error-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScrollText, Plus, X, Loader2, Play, Pause } from "lucide-react";

const CONDITION_FIELD_OPTIONS = [
  "anomaly.type",
  "anomaly.severity",
  "anomaly.entityType",
  "endpoint.score",
  "endpoint.uptime",
  "endpoint.latency",
  "endpoint.isHealthy",
  "validator.score",
  "validator.jailed",
  "validator.missedBlocks",
  "validator.commission",
  "slo.isBreaching",
  "slo.budgetConsumed",
  "slo.currentValue",
];

const ACTION_TYPE_OPTIONS = [
  { value: "log", label: "Log" },
  { value: "webhook", label: "Webhook Notify" },
  { value: "routing_exclude", label: "Exclude from Routing" },
  { value: "annotate", label: "Annotate Anomaly" },
  { value: "incident_create", label: "Create Incident" },
];

export function PolicyList() {
  const { token } = useWorkspace();
  const { data, error, isLoading, mutate } = usePolicies(token);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formField, setFormField] = useState(CONDITION_FIELD_OPTIONS[0]);
  const [formOperator, setFormOperator] = useState("eq");
  const [formValue, setFormValue] = useState("");
  const [formActionType, setFormActionType] = useState("log");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!token || !formName.trim() || !formValue.trim()) return;
    setIsCreating(true);
    try {
      let parsedValue: unknown = formValue;
      if (formValue === "true") parsedValue = true;
      else if (formValue === "false") parsedValue = false;
      else if (!isNaN(Number(formValue))) parsedValue = Number(formValue);

      await createPolicy(token, {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        conditions: [{ field: formField, operator: formOperator, value: parsedValue }],
        actions: [{ type: formActionType }],
        dryRun: true,
      });
      mutate();
      setShowForm(false);
      setFormName("");
      setFormDescription("");
      setFormValue("");
    } finally {
      setIsCreating(false);
    }
  };

  if (error) return <ErrorState message="Failed to load policies" />;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-soft-violet" />
      </div>
    );
  }

  const policies = data?.policies ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-dusty-lavender/50">{policies.length} policies</p>
        <Button
          size="sm"
          onClick={() => setShowForm(!showForm)}
          className="bg-soft-violet text-white hover:bg-soft-violet/80"
        >
          {showForm ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
          {showForm ? "Cancel" : "New Policy"}
        </Button>
      </div>

      {showForm && (
        <Card className="border-soft-violet/30 bg-midnight-plum">
          <CardContent className="space-y-3 pt-4">
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Policy name"
              className="h-9 w-full rounded-lg border border-slate-DEFAULT/20 bg-slate-dark/50 px-3 text-sm text-mist placeholder:text-dusty-lavender/30 outline-none focus:border-soft-violet/50"
            />
            <input
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Description (optional)"
              className="h-9 w-full rounded-lg border border-slate-DEFAULT/20 bg-slate-dark/50 px-3 text-sm text-mist placeholder:text-dusty-lavender/30 outline-none focus:border-soft-violet/50"
            />
            <div className="flex gap-2">
              <select
                value={formField}
                onChange={(e) => setFormField(e.target.value)}
                className="h-9 flex-1 rounded-lg border border-slate-DEFAULT/20 bg-slate-dark/50 px-2 text-xs text-mist outline-none"
              >
                {CONDITION_FIELD_OPTIONS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <select
                value={formOperator}
                onChange={(e) => setFormOperator(e.target.value)}
                className="h-9 w-20 rounded-lg border border-slate-DEFAULT/20 bg-slate-dark/50 px-2 text-xs text-mist outline-none"
              >
                {["eq", "neq", "gt", "gte", "lt", "lte", "in"].map((op) => (
                  <option key={op} value={op}>{op}</option>
                ))}
              </select>
              <input
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
                placeholder="Value"
                className="h-9 w-32 rounded-lg border border-slate-DEFAULT/20 bg-slate-dark/50 px-2 text-xs text-mist outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-dusty-lavender/50">Action:</span>
              <select
                value={formActionType}
                onChange={(e) => setFormActionType(e.target.value)}
                className="h-9 flex-1 rounded-lg border border-slate-DEFAULT/20 bg-slate-dark/50 px-2 text-xs text-mist outline-none"
              >
                {ACTION_TYPE_OPTIONS.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
            <Button
              onClick={handleCreate}
              disabled={isCreating || !formName.trim() || !formValue.trim()}
              className="w-full bg-soft-violet text-white hover:bg-soft-violet/80"
            >
              {isCreating ? <Loader2 className="size-4 animate-spin" /> : "Create Policy (Dry Run)"}
            </Button>
          </CardContent>
        </Card>
      )}

      {policies.length === 0 && !showForm ? (
        <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
          <CardContent className="flex flex-col items-center py-12">
            <ScrollText className="mb-3 size-8 text-dusty-lavender/30" />
            <p className="text-sm text-dusty-lavender/50">No policies configured yet</p>
          </CardContent>
        </Card>
      ) : (
        policies.map((policy) => (
          <Link key={policy.id} href={`/dashboard/settings/policies/${policy.id}`}>
            <Card className="border-slate-DEFAULT/20 bg-midnight-plum transition-colors hover:border-soft-violet/30">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex size-9 items-center justify-center rounded-lg bg-soft-violet/15">
                  <ScrollText className="size-4 text-soft-violet" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-mist">{policy.name}</p>
                    {policy.dryRun && (
                      <span className="rounded bg-amber-DEFAULT/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-DEFAULT">
                        DRY RUN
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-dusty-lavender/50">
                    {policy.conditions.length} condition{policy.conditions.length !== 1 ? "s" : ""} &middot;{" "}
                    {policy.actions.length} action{policy.actions.length !== 1 ? "s" : ""} &middot;{" "}
                    Priority {policy.priority}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {policy.isActive ? (
                    <Play className="size-3.5 text-teal-DEFAULT" />
                  ) : (
                    <Pause className="size-3.5 text-dusty-lavender/40" />
                  )}
                  <span className={cn(
                    "text-xs",
                    policy.isActive ? "text-teal-DEFAULT" : "text-dusty-lavender/40",
                  )}>
                    {policy.isActive ? "Active" : "Paused"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))
      )}
    </div>
  );
}
