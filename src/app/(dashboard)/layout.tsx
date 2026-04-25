import { Sidebar } from '@/components/layout/Sidebar'
import { getSidebarData } from '@/app/actions/sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sidebarData = await getSidebarData()
  return (
    <div className="flex min-h-screen bg-[#f4f6f9]">
      <Sidebar data={sidebarData} />
      <div className="ml-[220px] flex-1 min-w-0">
        {children}
      </div>
    </div>
  )
}
