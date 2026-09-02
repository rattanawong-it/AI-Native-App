"use client"

// นำเข้าทะเบียนครุภัณฑ์จากไฟล์ CSV (F7.7)
//
// บังคับให้ตรวจก่อนเสมอ: เลือกไฟล์ → ระบบตรวจแบบไม่บันทึก (dry run) → เห็นผลแล้วจึงยืนยัน
// ป้องกันการเทข้อมูลผิดพันแถวลงทะเบียนจริงโดยไม่มีใครทันเห็น

import { useState } from "react"
import { FileUp, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { readError } from "@/lib/ticket-types"
import type { AssetImportResponse } from "@/lib/asset-types"

/// เพดานขนาดไฟล์ฝั่งหน้าจอ — ตรงกับที่ `importAssetSchema` ยอมรับ
const MAX_BYTES = 2_000_000

export default function AssetImportDialog({
    open,
    onOpenChange,
    onImported,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    onImported: () => void
}) {
    const [csv, setCsv] = useState("")
    const [fileName, setFileName] = useState("")
    const [preview, setPreview] = useState<AssetImportResponse | null>(null)
    const [busy, setBusy] = useState(false)

    const reset = () => {
        setCsv("")
        setFileName("")
        setPreview(null)
    }

    const pickFile = async (file: File | undefined) => {
        setPreview(null)
        if (!file) {
            reset()
            return
        }
        if (file.size > MAX_BYTES) {
            toast.error("ไฟล์ใหญ่เกิน 2 MB — กรุณาแบ่งนำเข้าเป็นรอบ")
            return
        }

        setFileName(file.name)
        setCsv(await file.text())
    }

    const send = async (dryRun: boolean) => {
        if (!csv) {
            toast.error("กรุณาเลือกไฟล์ CSV ก่อน")
            return
        }

        setBusy(true)
        try {
            const res = await fetch("/api/assets/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ csv, dryRun }),
            })

            if (!res.ok) {
                toast.error(await readError(res, "นำเข้าข้อมูลไม่สำเร็จ"))
                return
            }

            const data = (await res.json()) as AssetImportResponse
            setPreview(data)

            if (dryRun) {
                toast.info(`ตรวจแล้ว ${data.total} แถว — เพิ่มใหม่ ${data.created} · อัปเดต ${data.updated} · ผิดพลาด ${data.failed}`)
                return
            }

            toast.success(`นำเข้าสำเร็จ — เพิ่มใหม่ ${data.created} · อัปเดต ${data.updated}`)
            onImported()
            onOpenChange(false)
            reset()
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setBusy(false)
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                onOpenChange(next)
                if (!next) reset()
            }}
        >
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>นำเข้าครุภัณฑ์จากไฟล์ CSV</DialogTitle>
                    <DialogDescription>
                        หัวตารางรับได้ทั้งภาษาไทย (รหัสครุภัณฑ์, ชื่อครุภัณฑ์, ประเภท, …)
                        และชื่อฟิลด์ภาษาอังกฤษจากไฟล์ที่ส่งออกไป · แถวที่มีรหัสซ้ำกับของเดิมจะถูกอัปเดตทับ
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="csvFile">ไฟล์ CSV</Label>
                        <Input
                            id="csvFile"
                            type="file"
                            accept=".csv,text/csv"
                            onChange={(e) => void pickFile(e.target.files?.[0])}
                        />
                        {fileName && (
                            <p className="text-xs text-muted-foreground">เลือกไว้: {fileName}</p>
                        )}
                    </div>

                    {preview && (
                        <div className="space-y-2 rounded-lg border p-4 text-sm">
                            <p className="font-medium">
                                ผลการตรวจ {preview.total} แถว — เพิ่มใหม่ {preview.created} ·
                                อัปเดต {preview.updated} · ผิดพลาด {preview.failed}
                            </p>

                            {preview.errors.length > 0 && (
                                <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-destructive">
                                    {preview.errors.map((err) => (
                                        <li key={err.line}>
                                            บรรทัด {err.line}: {err.message}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                        ยกเลิก
                    </Button>
                    <Button variant="outline" onClick={() => void send(true)} disabled={busy || !csv}>
                        {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
                        ตรวจก่อน
                    </Button>
                    <Button
                        onClick={() => void send(false)}
                        // บังคับให้ตรวจก่อนอย่างน้อยหนึ่งรอบ จึงจะกดนำเข้าจริงได้
                        disabled={busy || !csv || preview === null || !preview.dryRun}
                    >
                        <FileUp className="size-4" aria-hidden />
                        นำเข้าจริง
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
