"use client";

import { useGovernanceProposal } from "@/hooks/use-governance";
import { ErrorState } from "./error-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { timeAgo } from "@/lib/time";
import { Loader2, Vote, CheckCircle, XCircle, MinusCircle, ShieldAlert } from "lucide-react";

export function GovernanceDetail({ proposalId }: { proposalId: string }) {
  const { data, error, isLoading } = useGovernanceProposal(proposalId);

  if (error) return <ErrorState message="Failed to load proposal" />;

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-soft-violet" />
      </div>
    );
  }

  const totalVotes = data.voteSummary.yes + data.voteSummary.no + data.voteSummary.abstain + data.voteSummary.veto;

  return (
    <div className="space-y-6">
      {/* Proposal Info */}
      <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-mist">
            <Vote className="size-4 text-soft-violet" />
            #{data.id} — {data.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-dusty-lavender/50">Status</p>
              <p className="font-mono text-sm text-mist">{data.status.replace("PROPOSAL_STATUS_", "")}</p>
            </div>
            <div>
              <p className="text-xs text-dusty-lavender/50">Submit Time</p>
              <p className="text-sm text-mist">{data.submitTime ? timeAgo(data.submitTime) : "N/A"}</p>
            </div>
            <div>
              <p className="text-xs text-dusty-lavender/50">Voting End</p>
              <p className="text-sm text-mist">{data.votingEndTime ? timeAgo(data.votingEndTime) : "N/A"}</p>
            </div>
          </div>
          {data.description && (
            <div>
              <p className="text-xs text-dusty-lavender/50 mb-1">Description</p>
              <p className="text-sm text-dusty-lavender/70 whitespace-pre-wrap line-clamp-6">{data.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vote Summary */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
          <CardContent className="flex items-center gap-3 pt-6">
            <CheckCircle className="size-5 text-teal-DEFAULT" />
            <div>
              <p className="text-xl font-bold text-mist">{data.voteSummary.yes}</p>
              <p className="text-xs text-dusty-lavender/50">Yes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
          <CardContent className="flex items-center gap-3 pt-6">
            <XCircle className="size-5 text-rose-DEFAULT" />
            <div>
              <p className="text-xl font-bold text-mist">{data.voteSummary.no}</p>
              <p className="text-xs text-dusty-lavender/50">No</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
          <CardContent className="flex items-center gap-3 pt-6">
            <MinusCircle className="size-5 text-dusty-lavender/50" />
            <div>
              <p className="text-xl font-bold text-mist">{data.voteSummary.abstain}</p>
              <p className="text-xs text-dusty-lavender/50">Abstain</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
          <CardContent className="flex items-center gap-3 pt-6">
            <ShieldAlert className="size-5 text-amber-DEFAULT" />
            <div>
              <p className="text-xl font-bold text-mist">{data.voteSummary.veto}</p>
              <p className="text-xs text-dusty-lavender/50">Veto</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Validator Votes */}
      <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
        <CardHeader>
          <CardTitle className="text-sm text-mist">
            Validator Votes ({totalVotes})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.votes.length === 0 ? (
            <p className="text-xs text-dusty-lavender/40">No votes recorded yet</p>
          ) : (
            <div className="space-y-1 max-h-96 overflow-auto">
              {data.votes.map((v) => {
                const optionLabel = v.option.replace("VOTE_OPTION_", "");
                const optionColor =
                  v.option === "VOTE_OPTION_YES" ? "text-teal-DEFAULT" :
                  v.option === "VOTE_OPTION_NO" ? "text-rose-DEFAULT" :
                  v.option === "VOTE_OPTION_NO_WITH_VETO" ? "text-amber-DEFAULT" :
                  "text-dusty-lavender/50";

                return (
                  <div key={v.id} className="flex items-center justify-between rounded bg-slate-dark/20 px-3 py-2 text-xs">
                    <span className="font-mono text-dusty-lavender truncate max-w-[200px]">
                      {v.voter}
                    </span>
                    <span className={`font-medium ${optionColor}`}>{optionLabel}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
