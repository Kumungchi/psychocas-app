import type { Metadata } from 'next';
import AdminGuide from './AdminGuide';

export const metadata: Metadata = {
  title: 'Nápověda pro správce | Psychočas',
  description: 'Srozumitelný průvodce správou členů, rolí, partnerů a nabídek v aplikaci Psychočas.',
};

export default function DocsPage() {
  return <AdminGuide />;
}
