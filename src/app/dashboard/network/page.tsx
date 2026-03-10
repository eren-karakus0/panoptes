import { PageHeader } from "@/components/dashboard/page-header";
import { NetworkOverview } from "@/components/dashboard/network-overview";

export const metadata = {
  title: "Network | Panoptes",
  description: "Republic chain network statistics and trend analysis",
};

export default function NetworkPage() {
  return (
    <div>
      <PageHeader
        title="Network"
        description="Chain statistics, validator trends, and staking analytics"
        breadcrumbs={[{ label: "Network" }]}
      />
      <NetworkOverview />
    </div>
  );
}
