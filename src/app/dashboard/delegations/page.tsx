"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { DelegationList } from "@/components/dashboard/delegation-list";
import { DelegationFlow } from "@/components/dashboard/delegation-flow";

export default function DelegationsPage() {
  return (
    <div>
      <PageHeader
        title="Delegations"
        description="Stake movements, delegation flow, and whale detection"
        breadcrumbs={[{ label: "Delegations" }]}
      />
      <div className="space-y-6">
        <DelegationFlow />
        <DelegationList />
      </div>
    </div>
  );
}
