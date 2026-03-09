import { PageHeader } from "@/components/dashboard/page-header";
import { EndpointsList } from "@/components/dashboard/endpoints-list";

export const metadata = {
  title: "Endpoints | Panoptes",
  description: "Republic chain endpoint health monitoring",
};

export default function EndpointsPage() {
  return (
    <div>
      <PageHeader
        title="Endpoint Health"
        description="Monitor RPC, REST, and EVM-RPC endpoint availability and performance"
      />
      <EndpointsList />
    </div>
  );
}
