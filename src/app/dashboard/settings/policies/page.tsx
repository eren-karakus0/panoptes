"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { WorkspaceGuard } from "@/components/dashboard/workspace-guard";
import { PolicyList } from "@/components/dashboard/policy-list";

export default function PoliciesPage() {
  return (
    <div>
      <PageHeader
        title="Policies"
        description="Declarative rules for automated responses"
        breadcrumbs={[
          { label: "Settings" },
          { label: "Policies" },
        ]}
      />
      <WorkspaceGuard>
        <PolicyList />
      </WorkspaceGuard>
    </div>
  );
}
