import { StudentDetailView } from "@/components/students/StudentDetailView";

interface Props {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  // Records live in the browser, so every detail page renders on first visit.
  return [];
}

export default async function StudentDetailPage({ params }: Props) {
  const { id } = await params;
  return <StudentDetailView studentId={id} />;
}
