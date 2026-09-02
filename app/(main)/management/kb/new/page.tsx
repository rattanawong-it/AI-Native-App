import { Metadata } from "next"
import { Suspense } from "react"
import KbNewContent from "@/app/(main)/management/kb/new/KbNewContent"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata: Metadata = {
    title: "เขียนบทความใหม่",
    description: "เขียนบทความคลังความรู้ด้วย Markdown พร้อมดูตัวอย่างก่อนบันทึก",
    keywords: ["Knowledge Base", "เขียนบทความ", "Markdown", "ศูนย์ไอที"],
}

export default function KbNewPage() {
    // KbNewContent ใช้ useSearchParams() เพื่ออ่านค่า prefill จากหน้า Ticket (F6.13)
    // Next.js บังคับให้ต้องมี Suspense ครอบ ไม่งั้น build จะไม่ผ่าน
    return (
        <Suspense fallback={<Skeleton className="m-4 h-[32rem] rounded-xl md:m-6" />}>
            <KbNewContent />
        </Suspense>
    )
}
