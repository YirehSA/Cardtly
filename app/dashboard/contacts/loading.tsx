export default function ContactsLoading() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-7 w-32" />
      <div className="space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl p-4 border border-border bg-card flex items-center gap-4">
            <div className="skeleton h-10 w-10 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-40" />
              <div className="skeleton h-3 w-32" />
            </div>
            <div className="skeleton h-8 w-20 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}
