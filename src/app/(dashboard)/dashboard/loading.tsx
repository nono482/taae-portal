export default function DashboardLoading() {
  return (
    <div className="animate-pulse">
      {/* Topbar */}
      <div className="bg-white border-b border-[#e2e6ec] px-8 h-[54px] flex items-center justify-between">
        <div className="h-5 bg-slate-100 rounded w-28" />
        <div className="h-4 bg-slate-100 rounded w-24" />
      </div>

      <div className="p-8">
        {/* Quick actions */}
        <div className="flex gap-3 mb-7">
          {[140, 110, 110].map((w, i) => (
            <div key={i} className="h-9 bg-slate-100 rounded-lg" style={{ width: w }} />
          ))}
        </div>

        {/* Section label */}
        <div className="h-3 bg-slate-100 rounded w-36 mb-3" />

        {/* KPI cards */}
        <div className="grid grid-cols-4 gap-4 mb-7">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white border border-[#e2e6ec] rounded-lg p-5 shadow-sm space-y-3">
              <div className="h-3 bg-slate-100 rounded w-24" />
              <div className="h-7 bg-slate-100 rounded w-20" />
              <div className="h-3 bg-slate-100 rounded w-full" />
              <div className="h-1 bg-slate-100 rounded-full w-full mt-2" />
            </div>
          ))}
        </div>

        {/* Section label */}
        <div className="h-3 bg-slate-100 rounded w-24 mb-3" />

        {/* Main 2-col grid */}
        <div className="grid grid-cols-[1fr_360px] gap-5">
          {/* Left */}
          <div className="flex flex-col gap-5">
            <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm p-5 h-52" />
            <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#e2e6ec]">
                <div className="h-4 bg-slate-100 rounded w-32 mb-2" />
                <div className="h-3 bg-slate-100 rounded w-20" />
              </div>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3 border-b border-[#e2e6ec] last:border-0">
                  <div className="h-4 bg-slate-100 rounded flex-1" />
                  <div className="h-4 bg-slate-100 rounded w-16" />
                  <div className="h-4 bg-slate-100 rounded w-12" />
                  <div className="h-6 bg-slate-100 rounded-full w-16" />
                </div>
              ))}
            </div>
          </div>

          {/* Right */}
          <div className="flex flex-col gap-5">
            {[120, 160, 100].map((h, i) => (
              <div key={i} className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm" style={{ height: h }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
