import { Sidebar } from '@/components/layout/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#f4f6f9]">
      <Sidebar />
      <div className="ml-[220px] flex-1 min-w-0">
        {children}
      </div>
    </div>
  )
}
