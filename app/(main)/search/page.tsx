import { Suspense } from "react"
import { Metadata } from "next"
import SearchContent from "@/app/(main)/search/SearchContent"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata: Metadata = {
    title: "ค้นหารวม",
    description: "ค้นหาข้าม Ticket บทความในคลังความรู้ โครงการ และครุภัณฑ์ในครั้งเดียว",
    keywords: ["ค้นหา", "Ticket", "Knowledge Base", "โครงการ", "ครุภัณฑ์"],
}

export default function SearchPage() {
    // useSearchParams ต้องอยู่ใต้ Suspense ตามข้อกำหนดของ Next App Router
    return (
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <SearchContent />
        </Suspense>
    )
}
