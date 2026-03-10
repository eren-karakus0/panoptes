import { PageHeader } from "@/components/dashboard/page-header";
import { ValidatorsList } from "@/components/dashboard/validators-list";

export const metadata = {
  title: "Validators | Panoptes",
  description: "Republic chain validator monitoring and analytics",
};

export default function ValidatorsPage() {
  return (
    <div>
      <PageHeader
        title="Validators"
        description="Monitor validator status, staking, and performance"
        breadcrumbs={[{ label: "Validators" }]}
      />
      <ValidatorsList />
    </div>
  );
}
