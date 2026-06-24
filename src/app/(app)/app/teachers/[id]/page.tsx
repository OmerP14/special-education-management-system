import { TeacherDetailView } from "@/components/teachers/TeacherDetailView";
import { mockTeachers } from "@/lib/mock/teachers";

interface Props {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return mockTeachers.map((t) => ({ id: t.id }));
}

export default async function TeacherDetailPage({ params }: Props) {
  const { id } = await params;
  return <TeacherDetailView teacherId={id} />;
}
