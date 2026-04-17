import Link from 'next/link'

export default function NotFoundPage() {
  return (
    <div>
      <div className="bg-white border-b border-[#e2e6ec] px-8 h-[54px] flex items-center sticky top-0 z-40">
        <h1 className="text-[16px] font-bold text-[#1a2332]">ページが見つかりません</h1>
      </div>
      <div className="p-8 flex flex-col items-center justify-center mt-20 text-center">
        <div className="text-[64px] font-bold text-[#e2e6ec] mb-4">404</div>
        <div className="text-[18px] font-bold text-[#1a2332] mb-2">ページが見つかりません</div>
        <div className="text-[13px] text-[#8f9db0] mb-8">
          お探しのページは存在しないか、移動した可能性があります。
        </div>
        <Link
          href="/dashboard"
          className="px-5 py-2.5 bg-[#1e3a5f] hover:bg-[#16304f] text-white text-[13px] font-semibold rounded-lg transition-colors shadow-sm"
        >
          ダッシュボードへ戻る
        </Link>
      </div>
    </div>
  )
}
