import { Metadata } from "next"
import AssetDetailContent from "@/app/(main)/management/assets/[id]/AssetDetailContent"

export const metadata: Metadata = {
    title: "รายละเอียดครุภัณฑ์",
    description: "ข้อมูลครุภัณฑ์ ประวัติการโอน/ซ่อม/คืน/จำหน่าย และ QR Code สำหรับติดป้าย",
}

export default async function AssetDetailPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    return <AssetDetailContent assetId={id} />
}
