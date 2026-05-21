export default function QRLoading() {
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="space-y-2">
        <div className="skeleton h-7 w-32" />
        <div className="skeleton h-4 w-80" />
      </div>
      <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center gap-6">
        <div className="skeleton w-72 h-72 rounded-2xl" />
        <div className="space-y-2 text-center w-full max-w-xs">
          <div className="skeleton h-4 w-32 mx-auto" />
          <div className="skeleton h-3 w-48 mx-auto" />
        </div>
        <div className="grid grid-cols-3 gap-2 w-full">
          <div className="skeleton h-10 rounded-xl" />
          <div className="skeleton h-10 rounded-xl" />
          <div className="skeleton h-10 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
