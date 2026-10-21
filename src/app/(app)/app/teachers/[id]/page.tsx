import { TeacherDetailView } from "@/components/teachers/TeacherDetailView";

interface Props {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  // Records live in the browser, so every detail page renders on first visit.
  return [];
}

export default async function TeacherDetailPage({ params }: Props) {
  const { id } = await params;
  return <TeacherDetailView teacherId={id} />;
}
