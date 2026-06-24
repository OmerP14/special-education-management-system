import { mockGuardians } from "@/lib/mock/students";
import { GuardianDetailView } from "@/components/guardians/GuardianDetailView";

export function generateStaticParams() {
  return mockGuardians.map((g) => ({ id: g.id }));
}

export default async function GuardianDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <GuardianDetailView guardianId={id} />;
}
