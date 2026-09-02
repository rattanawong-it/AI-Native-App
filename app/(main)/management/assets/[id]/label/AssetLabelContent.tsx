"use client"

// หน้าพิมพ์ป้ายครุภัณฑ์ (F7.5)
//
// เลือกจำนวนป้ายต่อแผ่นได้ แล้วสั่งพิมพ์จากเบราว์เซอร์ — คลาส `print:` ของ Tailwind
// ซ่อนแถบเครื่องมือและกรอบการ์ดตอนพิมพ์ เหลือเฉพาะตัวป้าย

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Printer } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { readError } from "@/lib/ticket-types"
import type { AssetDetailResponse, AssetQrResponse } from "@/lib/asset-types"

const COPY_OPTIONS = [1, 2, 4, 8, 12]

export default function AssetLabelContent({ assetId }: { assetId: string }) {
    const [qr, setQr] = useState<AssetQrResponse | null>(null)
    const [location, setLocation] = useState<string | null>(null)
    const [copies, setCopies] = useState(4)
    const [loading, setLoading] = useState(true)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const [qrRes, assetRes] = await Promise.all([
                fetch(`/api/assets/${assetId}/qrcode?format=dataurl`),
                fetch(`/api/assets/${assetId}`),
            ])

            if (!qrRes.ok) {
                toast.error(await readError(qrRes, "สร้าง QR Code ไม่สำเร็จ"))
                return
            }

            setQr((await qrRes.json()) as AssetQrResponse)

            if (assetRes.ok) {
                const data = (await assetRes.json()) as AssetDetailResponse
                setLocation(data.asset.location)
            }
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setLoading(false)
        }
    }, [assetId])

    useEffect(() => {
        void load()
    }, [load])

    if (loading) {
        return (
            <div className="space-y-4 p-4 md:p-6">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-72 w-full rounded-xl" />
            </div>
        )
    }

    if (!qr) {
        return (
            <div className="p-4 md:p-6">
                <Card>
                    <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                        <p className="font-medium">สร้างป้ายไม่สำเร็จ</p>
                        <Button variant="outline" size="sm" asChild>
                            <Link href="/management/assets">กลับไปหน้าทะเบียน</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="space-y-6 p-4 md:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
                <div className="space-y-2">
                    <Button variant="ghost" size="sm" asChild className="-ml-2">
                        <Link href={`/management/assets/${assetId}`}>
                            <ArrowLeft className="size-4" aria-hidden />
                            กลับไปหน้ารายละเอียด
                        </Link>
                    </Button>
                    <h1 className="text-2xl font-semibold">พิมพ์ป้ายครุภัณฑ์</h1>
                    <p className="text-sm text-muted-foreground">
                        ป้ายขนาดประมาณ 5×5 ซม. — ตรวจให้แน่ใจว่าตั้งค่าเครื่องพิมพ์เป็นขนาดจริง 100%
                    </p>
                </div>

                <div className="flex items-end gap-3">
                    <div className="space-y-2">
                        <Label>จำนวนป้าย</Label>
                        <Select value={String(copies)} onValueChange={(v) => setCopies(Number(v))}>
                            <SelectTrigger className="w-28">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {COPY_OPTIONS.map((n) => (
                                    <SelectItem key={n} value={String(n)}>
                                        {n} ป้าย
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <Button onClick={() => window.print()}>
                        <Printer className="size-4" aria-hidden />
                        สั่งพิมพ์
                    </Button>
                </div>
            </div>

            <div className="flex flex-wrap gap-4">
                {Array.from({ length: copies }).map((_, i) => (
                    <div
                        key={i}
                        className="flex w-48 flex-col items-center gap-2 rounded-lg border border-dashed p-3 print:border-solid"
                    >
                        <Image
                            src={qr.dataUrl}
                            alt={`QR Code ของ ${qr.assetCode}`}
                            width={120}
                            height={120}
                            unoptimized
                            className="bg-white"
                        />
                        <p className="text-center font-mono text-xs font-semibold">
                            {qr.assetCode}
                        </p>
                        <p className="line-clamp-2 text-center text-[11px] leading-tight">
                            {qr.name}
                        </p>
                        {location && (
                            <p className="text-center text-[10px] text-muted-foreground">
                                {location}
                            </p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
