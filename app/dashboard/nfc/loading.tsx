export default function NFCLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="skeleton h-7 w-32" />
        <div className="skeleton h-4 w-72" />
      </div>
      <div className="rounded-xl border border-border p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="skeleton h-12 w-12 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-3">
            <div className="skeleton h-5 w-48" />
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-10 w-40 rounded-xl" />
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-border p-6 space-y-4">
        <div className="skeleton h-5 w-40" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton h-32 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
