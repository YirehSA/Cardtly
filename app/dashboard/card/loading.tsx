export default function CardEditorLoading() {
  return (
    <div className="flex flex-col xl:flex-row gap-6 max-w-7xl mx-auto">
      <div className="flex-1 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="skeleton h-6 w-24" />
            <div className="skeleton h-4 w-48" />
          </div>
          <div className="skeleton h-10 w-20 rounded-lg" />
        </div>
        <div className="rounded-lg border border-border p-6 space-y-4">
          <div className="skeleton h-4 w-32" />
          <div className="skeleton h-12 w-full rounded-lg" />
          <div className="skeleton h-12 w-full rounded-lg" />
          <div className="skeleton h-12 w-full rounded-lg" />
          <div className="skeleton h-24 w-full rounded-lg" />
        </div>
      </div>
      <div className="xl:w-96">
        <div className="skeleton h-4 w-24 mb-3" />
        <div className="skeleton h-[400px] w-full rounded-lg" />
      </div>
    </div>
  )
}
