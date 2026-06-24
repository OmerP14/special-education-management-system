import { StudentDetailView } from "@/components/students/StudentDetailView";
import { mockStudents } from "@/lib/mock/students";

interface Props {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return mockStudents.map((s) => ({ id: s.id }));
}

export default async function StudentDetailPage({ params }: Props) {
  const { id } = await params;
  return <StudentDetailView studentId={id} />;
}
