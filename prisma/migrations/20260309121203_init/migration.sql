-- CreateTable
CREATE TABLE "Validator" (
    "id" TEXT NOT NULL,
    "moniker" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "tokens" TEXT NOT NULL,
    "commission" DOUBLE PRECISION NOT NULL,
    "jailed" BOOLEAN NOT NULL DEFAULT false,
    "uptime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "votingPower" TEXT NOT NULL,
    "missedBlocks" INTEGER NOT NULL DEFAULT 0,
    "jailCount" INTEGER NOT NULL DEFAULT 0,
    "lastJailedAt" TIMESTAMP(3),
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Validator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidatorSnapshot" (
    "id" TEXT NOT NULL,
    "validatorId" TEXT NOT NULL,
    "tokens" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "commission" DOUBLE PRECISION NOT NULL,
    "jailed" BOOLEAN NOT NULL,
    "votingPower" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValidatorSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Endpoint" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT,
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Endpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EndpointHealth" (
    "id" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "isHealthy" BOOLEAN NOT NULL,
    "blockHeight" BIGINT,
    "error" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EndpointHealth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetworkStats" (
    "id" TEXT NOT NULL,
    "totalValidators" INTEGER NOT NULL,
    "activeValidators" INTEGER NOT NULL,
    "totalStaked" TEXT NOT NULL,
    "bondedRatio" DOUBLE PRECISION,
    "blockHeight" BIGINT NOT NULL,
    "avgBlockTime" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NetworkStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Validator_status_idx" ON "Validator"("status");

-- CreateIndex
CREATE INDEX "Validator_jailed_idx" ON "Validator"("jailed");

-- CreateIndex
CREATE INDEX "ValidatorSnapshot_validatorId_timestamp_idx" ON "ValidatorSnapshot"("validatorId", "timestamp");

-- CreateIndex
CREATE INDEX "ValidatorSnapshot_timestamp_idx" ON "ValidatorSnapshot"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "Endpoint_url_key" ON "Endpoint"("url");

-- CreateIndex
CREATE INDEX "Endpoint_type_idx" ON "Endpoint"("type");

-- CreateIndex
CREATE INDEX "Endpoint_isActive_idx" ON "Endpoint"("isActive");

-- CreateIndex
CREATE INDEX "EndpointHealth_endpointId_timestamp_idx" ON "EndpointHealth"("endpointId", "timestamp");

-- CreateIndex
CREATE INDEX "EndpointHealth_timestamp_idx" ON "EndpointHealth"("timestamp");

-- CreateIndex
CREATE INDEX "NetworkStats_timestamp_idx" ON "NetworkStats"("timestamp");

-- AddForeignKey
ALTER TABLE "ValidatorSnapshot" ADD CONSTRAINT "ValidatorSnapshot_validatorId_fkey" FOREIGN KEY ("validatorId") REFERENCES "Validator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EndpointHealth" ADD CONSTRAINT "EndpointHealth_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "Endpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
