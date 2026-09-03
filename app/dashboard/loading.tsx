// Dashboard overview skeleton. Shows immediately while the server
// component fetches the user's plan + primary card + analytics counts.
// Matches the actual layout shape so the page doesn't flash-rearrange
// when real data arrives.

export default function DashboardLoading() {
  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="space-y-3">
        <div className="skeleton h-4 w-32" />
        <div className="skeleton h-10 w-64" />
        <div className="skeleton h-4 w-80" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg p-5 border border-border bg-card space-y-3">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton h-8 w-16" />
          </div>
        ))}
      </div>

      {/* Card preview block */}
      <div className="rounded-lg border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="skeleton h-5 w-24" />
          <div className="skeleton h-4 w-14" />
        </div>
        <div className="skeleton h-64 w-full rounded-xl" />
      </div>

      {/* Quick actions grid */}
      <div>
        <div className="skeleton h-3 w-32 mb-4" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="rounded-lg p-5 border border-border bg-card space-y-3">
              <div className="skeleton h-9 w-9 rounded-xl" />
              <div className="skeleton h-4 w-24" />
              <div className="skeleton h-3 w-32" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
