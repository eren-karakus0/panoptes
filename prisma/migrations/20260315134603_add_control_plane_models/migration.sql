-- CreateTable
CREATE TABLE "Policy" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "dryRun" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "conditions" TEXT NOT NULL,
    "actions" TEXT NOT NULL,
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 15,
    "lastTriggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyExecution" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "triggerEntity" TEXT NOT NULL,
    "conditionsMet" TEXT NOT NULL,
    "actionsTaken" TEXT NOT NULL,
    "actionsResults" TEXT NOT NULL,
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionRecord" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "policyId" TEXT,
    "actionType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "rollbackData" TEXT,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "rolledBackAt" TIMESTAMP(3),

    CONSTRAINT "ActionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernanceProposal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL,
    "proposer" TEXT,
    "submitTime" TIMESTAMP(3),
    "votingStartTime" TIMESTAMP(3),
    "votingEndTime" TIMESTAMP(3),
    "yesVotes" TEXT NOT NULL DEFAULT '0',
    "noVotes" TEXT NOT NULL DEFAULT '0',
    "abstainVotes" TEXT NOT NULL DEFAULT '0',
    "vetoVotes" TEXT NOT NULL DEFAULT '0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernanceProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernanceVote" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "voter" TEXT NOT NULL,
    "option" TEXT NOT NULL,
    "votedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GovernanceVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DelegationEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "delegator" TEXT NOT NULL,
    "validatorFrom" TEXT,
    "validatorTo" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "txHash" TEXT,
    "blockHeight" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DelegationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DelegationSnapshot" (
    "id" TEXT NOT NULL,
    "validatorId" TEXT NOT NULL,
    "totalDelegators" INTEGER NOT NULL,
    "totalDelegated" TEXT NOT NULL,
    "topDelegators" TEXT NOT NULL,
    "churnRate" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DelegationSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Policy_workspaceId_idx" ON "Policy"("workspaceId");

-- CreateIndex
CREATE INDEX "Policy_isActive_priority_idx" ON "Policy"("isActive", "priority");

-- CreateIndex
CREATE INDEX "PolicyExecution_policyId_timestamp_idx" ON "PolicyExecution"("policyId", "timestamp");

-- CreateIndex
CREATE INDEX "ActionRecord_workspaceId_appliedAt_idx" ON "ActionRecord"("workspaceId", "appliedAt");

-- CreateIndex
CREATE INDEX "ActionRecord_expiresAt_rolledBackAt_idx" ON "ActionRecord"("expiresAt", "rolledBackAt");

-- CreateIndex
CREATE INDEX "ActionRecord_entityType_entityId_idx" ON "ActionRecord"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "GovernanceProposal_status_idx" ON "GovernanceProposal"("status");

-- CreateIndex
CREATE INDEX "GovernanceProposal_votingEndTime_idx" ON "GovernanceProposal"("votingEndTime");

-- CreateIndex
CREATE INDEX "GovernanceVote_voter_idx" ON "GovernanceVote"("voter");

-- CreateIndex
CREATE UNIQUE INDEX "GovernanceVote_proposalId_voter_key" ON "GovernanceVote"("proposalId", "voter");

-- CreateIndex
CREATE INDEX "DelegationEvent_validatorTo_timestamp_idx" ON "DelegationEvent"("validatorTo", "timestamp");

-- CreateIndex
CREATE INDEX "DelegationEvent_validatorFrom_timestamp_idx" ON "DelegationEvent"("validatorFrom", "timestamp");

-- CreateIndex
CREATE INDEX "DelegationEvent_delegator_idx" ON "DelegationEvent"("delegator");

-- CreateIndex
CREATE INDEX "DelegationEvent_type_timestamp_idx" ON "DelegationEvent"("type", "timestamp");

-- CreateIndex
CREATE INDEX "DelegationSnapshot_validatorId_timestamp_idx" ON "DelegationSnapshot"("validatorId", "timestamp");

-- AddForeignKey
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyExecution" ADD CONSTRAINT "PolicyExecution_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernanceVote" ADD CONSTRAINT "GovernanceVote_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "GovernanceProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
