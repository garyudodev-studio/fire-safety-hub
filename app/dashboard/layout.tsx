export const dynamic = 'force-dynamic';

import Sidebar from '../components/Sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-ink-950 text-ink-200">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto pb-20 md:pb-0">
        {children}
      </main>
    </div>
  );
}
