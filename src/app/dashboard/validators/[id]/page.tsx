import { PageHeader } from "@/components/dashboard/page-header";
import { ValidatorDetail } from "@/components/dashboard/validator-detail";

export default async function ValidatorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div>
      <PageHeader
        title="Validator Detail"
        breadcrumbs={[
          { label: "Validators", href: "/dashboard/validators" },
          { label: id.slice(0, 12) + "..." },
        ]}
      />
      <ValidatorDetail validatorId={id} />
    </div>
  );
}
