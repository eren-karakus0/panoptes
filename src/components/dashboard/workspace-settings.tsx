"use client";

import { useState } from "react";
import useSWR from "swr";
import { useWorkspace } from "@/hooks/use-workspace";
import { workspaceSwrConfig } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorState } from "./error-state";
import { timeAgo } from "@/lib/time";
import {
  Building,
  Target,
  Webhook,
  Siren,
  RefreshCw,
  Loader2,
  Copy,
  Check,
  AlertTriangle,
} from "lucide-react";

interface WorkspaceMeResponse {
  workspace: {
    id: string;
    name: string;
    slug: string;
    createdAt: string;
    updatedAt: string;
  };
  resources: {
    slos: number;
    webhooks: number;
    incidents: number;
  };
}

export function WorkspaceSettings() {
  const { token, setToken } = useWorkspace();
  const { data, error, isLoading, mutate } = useSWR<WorkspaceMeResponse>(
    token ? "/api/workspaces/me" : null,
    workspaceSwrConfig(token),
  );

  const [isRotating, setIsRotating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);

  // Editable name
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleRotateToken = async () => {
    if (!token) return;
    setIsRotating(true);
    setRotateError(null);

    try {
      const res = await fetch("/api/workspaces/me/rotate-token", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setRotateError("Failed to rotate token");
        return;
      }
      const body = await res.json();
      setNewToken(body.token);
      setToken(body.token);
      setShowConfirm(false);
    } catch {
      setRotateError("Network error");
    } finally {
      setIsRotating(false);
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveName = async () => {
    if (!token || !editName.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/workspaces/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (res.ok) {
        mutate();
        setIsEditing(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (error) return <ErrorState message="Failed to load workspace" />;

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-soft-violet" />
      </div>
    );
  }

  const { workspace, resources } = data;
  const maskedToken = token
    ? `${token.slice(0, 6)}${"*".repeat(12)}...${token.slice(-4)}`
    : "***";

  return (
    <div className="space-y-6">
      {/* Workspace Info */}
      <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-mist">
            <Building className="size-4 text-soft-violet" />
            Workspace Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-dusty-lavender/50">Name</p>
              {isEditing ? (
                <div className="mt-1 flex items-center gap-2">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-8 rounded border border-slate-DEFAULT/20 bg-slate-dark/50 px-2 text-sm text-mist outline-none focus:border-soft-violet/50"
                    autoFocus
                  />
                  <Button size="sm" variant="ghost" onClick={handleSaveName} disabled={isSaving}>
                    {isSaving ? <Loader2 className="size-3 animate-spin" /> : "Save"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <p
                  className="mt-1 cursor-pointer text-sm text-mist hover:text-soft-violet"
                  onClick={() => {
                    setEditName(workspace.name);
                    setIsEditing(true);
                  }}
                >
                  {workspace.name}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-dusty-lavender/50">Slug</p>
              <p className="mt-1 font-mono text-sm text-mist">{workspace.slug}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-dusty-lavender/50">Created</p>
              <p className="mt-1 text-sm text-mist">{timeAgo(workspace.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-dusty-lavender/50">Last Updated</p>
              <p className="mt-1 text-sm text-mist">{timeAgo(workspace.updatedAt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resources */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex size-10 items-center justify-center rounded-lg bg-teal-DEFAULT/15">
              <Target className="size-5 text-teal-DEFAULT" />
            </div>
            <div>
              <p className="text-2xl font-bold text-mist">{resources.slos}</p>
              <p className="text-xs text-dusty-lavender/50">SLOs</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex size-10 items-center justify-center rounded-lg bg-soft-violet/15">
              <Webhook className="size-5 text-soft-violet" />
            </div>
            <div>
              <p className="text-2xl font-bold text-mist">{resources.webhooks}</p>
              <p className="text-xs text-dusty-lavender/50">Webhooks</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-DEFAULT/15">
              <Siren className="size-5 text-amber-DEFAULT" />
            </div>
            <div>
              <p className="text-2xl font-bold text-mist">{resources.incidents}</p>
              <p className="text-xs text-dusty-lavender/50">Incidents</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Token Management */}
      <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-mist">
            <RefreshCw className="size-4 text-soft-violet" />
            API Token
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current token masked */}
          <div>
            <p className="text-xs font-medium text-dusty-lavender/50">Current Token</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="rounded bg-slate-dark/50 px-2 py-1 font-mono text-xs text-dusty-lavender">
                {maskedToken}
              </code>
            </div>
          </div>

          {/* New token display (after rotation) */}
          {newToken && (
            <div className="rounded-lg border border-teal-DEFAULT/30 bg-teal-DEFAULT/5 p-3">
              <p className="mb-2 flex items-center gap-2 text-xs font-medium text-teal-DEFAULT">
                <Check className="size-3" />
                New token generated — copy it now, it won&apos;t be shown again
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 overflow-hidden text-ellipsis rounded bg-slate-dark/50 px-2 py-1 font-mono text-xs text-mist">
                  {newToken}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCopy(newToken)}
                  className="shrink-0"
                >
                  {copied ? <Check className="size-3.5 text-teal-DEFAULT" /> : <Copy className="size-3.5" />}
                </Button>
              </div>
            </div>
          )}

          {rotateError && (
            <p className="text-xs text-rose-DEFAULT">{rotateError}</p>
          )}

          {/* Rotate button with confirmation */}
          {showConfirm ? (
            <div className="flex items-center gap-3 rounded-lg border border-amber-DEFAULT/30 bg-amber-DEFAULT/5 p-3">
              <AlertTriangle className="size-4 shrink-0 text-amber-DEFAULT" />
              <div className="flex-1">
                <p className="text-xs text-amber-DEFAULT">
                  This will invalidate the current token immediately. All connected clients will lose access.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowConfirm(false)}
                  disabled={isRotating}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleRotateToken}
                  disabled={isRotating}
                  className="bg-amber-DEFAULT text-white hover:bg-amber-DEFAULT/80"
                >
                  {isRotating ? <Loader2 className="size-3 animate-spin" /> : "Confirm Rotate"}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowConfirm(true);
                setNewToken(null);
              }}
              className="border-slate-DEFAULT/20 text-dusty-lavender hover:border-amber-DEFAULT/40 hover:text-amber-DEFAULT"
            >
              <RefreshCw className="size-3.5" />
              Rotate Token
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
