// app/api/assets/[id]/qrcode/route.ts
// GET — QR Code ของครุภัณฑ์หนึ่งชิ้น สำหรับติดป้ายที่ตัวเครื่อง (F7.5)
//
// สแกนแล้วเปิดหน้ารายละเอียดของครุภัณฑ์ชิ้นนั้นในระบบ เจ้าหน้าที่จึงเช็กประวัติ
// และผู้ครอบครองได้จากหน้างานโดยไม่ต้องเปิดคอมพิวเตอร์
//
// `?format=dataurl` คืน data URL ให้หน้าเว็บฝังใน <img> ได้ตรงๆ · ค่าเริ่มต้นคืนไฟล์ PNG

import { NextRequest, NextResponse } from "next/server"
import QRCode from "qrcode"
import { prisma } from "@/lib/prisma"
import { requireRole, notFound, badRequest } from "@/lib/rbac"
import { appBaseUrl } from "@/lib/notification-templates"

/// ขนาดด้านละกี่พิกเซล — ใหญ่พอให้พิมพ์ป้ายขนาด 3 ซม. แล้วยังสแกนติด
const QR_SIZE = 512

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const guard = await requireRole(["agent", "manager", "admin"])
    if (!guard.ok) return guard.response

    const { id } = await params
    const format = new URL(request.url).searchParams.get("format") ?? "png"
    if (format !== "png" && format !== "dataurl") {
        return badRequest('รูปแบบต้องเป็น "png" หรือ "dataurl"')
    }

    try {
        const asset = await prisma.asset.findFirst({
            where: { OR: [{ id }, { assetCode: id }] },
            select: { id: true, assetCode: true, name: true },
        })
        if (!asset) return notFound("ไม่พบครุภัณฑ์ที่ต้องการ")

        const target = `${appBaseUrl()}/management/assets/${asset.id}`

        if (format === "dataurl") {
            const dataUrl = await QRCode.toDataURL(target, {
                width: QR_SIZE,
                margin: 1,
                errorCorrectionLevel: "M",
            })
            return NextResponse.json({
                dataUrl,
                target,
                assetCode: asset.assetCode,
                name: asset.name,
            })
        }

        const png = await QRCode.toBuffer(target, {
            width: QR_SIZE,
            margin: 1,
            errorCorrectionLevel: "M",
        })

        return new NextResponse(new Uint8Array(png), {
            headers: {
                "Content-Type": "image/png",
                // ป้ายของครุภัณฑ์ชิ้นหนึ่งไม่เปลี่ยนอีก จึงให้เบราว์เซอร์เก็บไว้ได้ยาว
                "Cache-Control": "private, max-age=86400",
                "Content-Disposition": `inline; filename="${asset.assetCode}.png"`,
            },
        })
    } catch (error) {
        console.error("Asset QR GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถสร้าง QR Code ได้" }, { status: 500 })
    }
}
