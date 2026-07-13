import { notFound } from 'next/navigation';
import DemoRolePreview, { type DemoRole } from '@/components/DemoRolePreview';

export default async function DemoRolePage({ params }: { params: Promise<{ role?: string }> }) {
  const { role } = await params;
  if (role !== 'member' && role !== 'manager' && role !== 'board') {
    notFound();
  }

  return <DemoRolePreview role={role as DemoRole} />;
}
