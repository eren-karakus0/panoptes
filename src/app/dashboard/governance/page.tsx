"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { GovernanceList } from "@/components/dashboard/governance-list";

export default function GovernancePage() {
  return (
    <div>
      <PageHeader
        title="Governance"
        description="Track proposals and validator voting participation"
        breadcrumbs={[{ label: "Governance" }]}
      />
      <GovernanceList />
    </div>
  );
}
