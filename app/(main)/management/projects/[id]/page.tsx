import { Suspense } from "react"
import { Metadata } from "next"
import ProjectBoardContent from "@/app/(main)/management/projects/[id]/ProjectBoardContent"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata: Metadata = {
    title: "กระดานงานโครงการ",
    description:
        "ภาพรวมโครงการ รอบพัฒนา (Sprint) และกระดาน Kanban 5 คอลัมน์ พร้อมลากย้ายงานข้ามคอลัมน์",
    keywords: ["Kanban", "Sprint", "Backlog", "โครงการพัฒนา", "งานพัฒนา", "ศูนย์ไอที"],
}

export default async function ProjectBoardPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params

    // useSearchParams ของหน้ากระดาน (อ่าน ?task=) ต้องอยู่ใต้ Suspense ตามข้อกำหนดของ Next
    return (
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <ProjectBoardContent projectId={id} />
        </Suspense>
    )
}
