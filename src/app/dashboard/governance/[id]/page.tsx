"use client";

import { use } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { GovernanceDetail } from "@/components/dashboard/governance-detail";

export default function GovernanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <div>
      <PageHeader
        title="Proposal Detail"
        description="Proposal information and validator votes"
        breadcrumbs={[
          { label: "Governance", href: "/dashboard/governance" },
          { label: `#${id}` },
        ]}
      />
      <GovernanceDetail proposalId={id} />
    </div>
  );
}
