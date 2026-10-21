import { GuardianDetailView } from "@/components/guardians/GuardianDetailView";

export function generateStaticParams() {
  // Records live in the browser, so every detail page renders on first visit.
  return [];
}

export default async function GuardianDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <GuardianDetailView guardianId={id} />;
}
