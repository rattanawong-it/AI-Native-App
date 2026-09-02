import { Metadata } from "next"
import AssetLabelContent from "@/app/(main)/management/assets/[id]/label/AssetLabelContent"

export const metadata: Metadata = {
    title: "พิมพ์ป้ายครุภัณฑ์",
    description: "ป้ายติดครุภัณฑ์พร้อม QR Code สำหรับสแกนเปิดประวัติจากหน้างาน",
}

export default async function AssetLabelPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    return <AssetLabelContent assetId={id} />
}
