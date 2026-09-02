import { Metadata } from "next"
import RequestDetailContent from "@/app/(main)/management/requests/[id]/RequestDetailContent"

export const metadata: Metadata = {
    title: "รายละเอียดคำขออนุมัติ",
    description: "รายละเอียดคำขอ ลำดับขั้นการอนุมัติ และเส้นเวลาการพิจารณา",
}

export default async function RequestDetailPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    return <RequestDetailContent requestId={id} />
}
