-- CreateTable
CREATE TABLE "Slo" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "indicator" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "windowDays" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isBreaching" BOOLEAN NOT NULL DEFAULT false,
    "currentValue" DOUBLE PRECISION,
    "budgetConsumed" DOUBLE PRECISION,
    "burnRate" DOUBLE PRECISION,
    "lastEvaluatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Slo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SloEvaluation" (
    "id" TEXT NOT NULL,
    "sloId" TEXT NOT NULL,
    "sliValue" DOUBLE PRECISION NOT NULL,
    "budgetConsumed" DOUBLE PRECISION NOT NULL,
    "budgetRemaining" DOUBLE PRECISION NOT NULL,
    "burnRate" DOUBLE PRECISION NOT NULL,
    "isBreaching" BOOLEAN NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SloEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Slo_workspaceId_idx" ON "Slo"("workspaceId");

-- CreateIndex
CREATE INDEX "Slo_isActive_idx" ON "Slo"("isActive");

-- CreateIndex
CREATE INDEX "Slo_entityType_entityId_idx" ON "Slo"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "SloEvaluation_sloId_evaluatedAt_idx" ON "SloEvaluation"("sloId", "evaluatedAt");

-- CreateIndex
CREATE INDEX "SloEvaluation_evaluatedAt_idx" ON "SloEvaluation"("evaluatedAt");

-- AddForeignKey
ALTER TABLE "Slo" ADD CONSTRAINT "Slo_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SloEvaluation" ADD CONSTRAINT "SloEvaluation_sloId_fkey" FOREIGN KEY ("sloId") REFERENCES "Slo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
