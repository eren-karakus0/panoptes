export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-slate-dark">
      {/* Sidebar placeholder - Phase 3 */}
      <aside className="hidden w-64 border-r border-slate-DEFAULT/20 bg-midnight-plum lg:block">
        <div className="p-6">
          <h2 className="font-display text-lg font-bold text-soft-violet">
            Panoptes
          </h2>
          <nav className="mt-8 space-y-2">
            <a
              href="/dashboard"
              className="block rounded-md px-3 py-2 text-sm text-dusty-lavender hover:bg-deep-iris/20"
            >
              Overview
            </a>
            <a
              href="/dashboard/validators"
              className="block rounded-md px-3 py-2 text-sm text-dusty-lavender/70 hover:bg-deep-iris/20"
            >
              Validators
            </a>
            <a
              href="/dashboard/endpoints"
              className="block rounded-md px-3 py-2 text-sm text-dusty-lavender/70 hover:bg-deep-iris/20"
            >
              Endpoints
            </a>
            <a
              href="/dashboard/network"
              className="block rounded-md px-3 py-2 text-sm text-dusty-lavender/70 hover:bg-deep-iris/20"
            >
              Network
            </a>
          </nav>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 lg:p-8">{children}</main>
    </div>
  );
}
