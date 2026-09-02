"use client"

// หน้ารายละเอียดครุภัณฑ์ — ข้อมูลทะเบียน ประวัติการเคลื่อนไหว และ QR Code
// อ้างอิง F7.2, F7.3, F7.4, F7.5

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
    ArrowLeft,
    Loader2,
    Package,
    Pencil,
    Printer,
    QrCode,
    Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { useSession } from "@/lib/auth-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { AssetStatusBadge, AssetTypeBadge, AssetWarrantyBadge } from "@/components/asset/asset-badges"
import AssetFormDialog from "@/app/(main)/management/assets/AssetFormDialog"
import {
    ASSET_HISTORY_ACTIONS,
    ASSET_HISTORY_ACTION_LABEL,
    type AssetHistoryAction,
} from "@/lib/asset-workflow"
import type {
    AssetDetail,
    AssetDetailResponse,
    AssetHistoryEntry,
    AssetHistoryResponse,
    AssetQrResponse,
} from "@/lib/asset-types"
import { readError } from "@/lib/ticket-types"

interface Person {
    id: string
    name: string
}

interface DepartmentOption {
    id: string
    name: string
    code: string
}

const NONE = "__none__"

function thaiDate(iso: string | null): string {
    if (!iso) return "—"
    return new Date(iso).toLocaleDateString("th-TH", {
        timeZone: "Asia/Bangkok",
        day: "numeric",
        month: "long",
        year: "numeric",
    })
}

function thaiDateTime(iso: string): string {
    return new Date(iso).toLocaleString("th-TH", {
        timeZone: "Asia/Bangkok",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

/// แถวข้อมูลหนึ่งบรรทัดในการ์ดรายละเอียด
function Field({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            <div className="text-sm">{value || "—"}</div>
        </div>
    )
}

export default function AssetDetailContent({ assetId }: { assetId: string }) {
    const router = useRouter()
    const { data: session } = useSession()
    const roles = useMemo(
        () => ((session?.user as { role?: string })?.role || "user").split(",").map((r) => r.trim()),
        [session]
    )
    const canManage = roles.some((r) => ["manager", "admin"].includes(r))

    const [asset, setAsset] = useState<AssetDetail | null>(null)
    const [histories, setHistories] = useState<AssetHistoryEntry[]>([])
    const [qr, setQr] = useState<AssetQrResponse | null>(null)
    const [loading, setLoading] = useState(true)

    const [people, setPeople] = useState<Person[]>([])
    const [departments, setDepartments] = useState<DepartmentOption[]>([])

    const [editOpen, setEditOpen] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)

    // ฟอร์มบันทึกการเคลื่อนไหว (F7.4)
    const [action, setAction] = useState<AssetHistoryAction>("assign")
    const [toUserId, setToUserId] = useState("")
    const [note, setNote] = useState("")
    const [saving, setSaving] = useState(false)

    const needsRecipient = action === "assign" || action === "transfer"

    const fetchAll = useCallback(async () => {
        setLoading(true)
        try {
            const [assetRes, historyRes] = await Promise.all([
                fetch(`/api/assets/${assetId}`),
                fetch(`/api/assets/${assetId}/history`),
            ])

            if (!assetRes.ok) {
                toast.error(await readError(assetRes, "ไม่พบครุภัณฑ์ที่ต้องการ"))
                return
            }

            const data = (await assetRes.json()) as AssetDetailResponse
            setAsset(data.asset)

            if (historyRes.ok) {
                const history = (await historyRes.json()) as AssetHistoryResponse
                setHistories(history.histories)
            }
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setLoading(false)
        }
    }, [assetId])

    useEffect(() => {
        void fetchAll()
    }, [fetchAll])

    useEffect(() => {
        const load = async () => {
            try {
                const [dirRes, deptRes, qrRes] = await Promise.all([
                    fetch("/api/directory?scope=agents"),
                    fetch("/api/departments"),
                    fetch(`/api/assets/${assetId}/qrcode?format=dataurl`),
                ])
                if (dirRes.ok) {
                    const data = (await dirRes.json()) as { agents: Person[] }
                    setPeople(data.agents)
                }
                if (deptRes.ok) {
                    const data = (await deptRes.json()) as { departments: DepartmentOption[] }
                    setDepartments(data.departments)
                }
                if (qrRes.ok) setQr((await qrRes.json()) as AssetQrResponse)
            } catch {
                // ข้อมูลประกอบไม่ครบไม่ควรทำให้หน้ารายละเอียดใช้ไม่ได้
            }
        }
        void load()
    }, [assetId])

    const recordMovement = async () => {
        if (needsRecipient && !toUserId) {
            toast.error("กรุณาระบุผู้รับครุภัณฑ์")
            return
        }

        setSaving(true)
        try {
            const res = await fetch(`/api/assets/${assetId}/history`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action,
                    toUserId: toUserId || null,
                    note: note.trim() || null,
                }),
            })

            if (!res.ok) {
                toast.error(await readError(res, "บันทึกการเคลื่อนไหวไม่สำเร็จ"))
                return
            }

            toast.success(`บันทึก "${ASSET_HISTORY_ACTION_LABEL[action]}" แล้ว`)
            setToUserId("")
            setNote("")
            await fetchAll()
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setSaving(false)
        }
    }

    const deleteAsset = async () => {
        try {
            const res = await fetch(`/api/assets/${assetId}`, { method: "DELETE" })
            if (!res.ok) {
                toast.error(await readError(res, "ลบครุภัณฑ์ไม่สำเร็จ"))
                return
            }
            toast.success("ลบครุภัณฑ์แล้ว")
            router.push("/management/assets")
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        }
    }

    if (loading) {
        return (
            <div className="space-y-4 p-4 md:p-6">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-64 w-full rounded-xl" />
                <Skeleton className="h-48 w-full rounded-xl" />
            </div>
        )
    }

    if (!asset) {
        return (
            <div className="p-4 md:p-6">
                <Card>
                    <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                        <Package className="size-10 text-muted-foreground" aria-hidden />
                        <p className="font-medium">ไม่พบครุภัณฑ์ที่ต้องการ</p>
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
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                    <Button variant="ghost" size="sm" asChild className="-ml-2">
                        <Link href="/management/assets">
                            <ArrowLeft className="size-4" aria-hidden />
                            ทะเบียนครุภัณฑ์
                        </Link>
                    </Button>

                    <div className="flex flex-wrap items-center gap-2">
                        <AssetStatusBadge status={asset.status} />
                        <AssetTypeBadge type={asset.type} />
                        <AssetWarrantyBadge warrantyEndDate={asset.warrantyEndDate} />
                    </div>

                    <h1 className="text-2xl font-semibold">{asset.name}</h1>
                    <p className="font-mono text-sm text-muted-foreground">{asset.assetCode}</p>
                </div>

                {canManage && (
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" asChild>
                            <Link href={`/management/assets/${asset.id}/label`}>
                                <Printer className="size-4" aria-hidden />
                                พิมพ์ป้าย
                            </Link>
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                            <Pencil className="size-4" aria-hidden />
                            แก้ไข
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setConfirmDelete(true)}
                            className="text-destructive hover:text-destructive"
                        >
                            <Trash2 className="size-4" aria-hidden />
                            ลบ
                        </Button>
                    </div>
                )}
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-base">ข้อมูลทะเบียน</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        <Field label="ยี่ห้อ" value={asset.brand} />
                        <Field label="รุ่น" value={asset.model} />
                        <Field label="หมายเลขเครื่อง (S/N)" value={asset.serialNumber} />
                        <Field label="สถานที่" value={asset.location} />
                        <Field label="ผู้ครอบครอง" value={asset.custodian?.name} />
                        <Field
                            label="หน่วยงาน"
                            value={
                                asset.department
                                    ? `${asset.department.name} (${asset.department.code})`
                                    : null
                            }
                        />
                        <Field label="วันที่ซื้อ" value={thaiDate(asset.purchaseDate)} />
                        <Field
                            label="ราคา"
                            value={
                                asset.price === null
                                    ? null
                                    : `${asset.price.toLocaleString("th-TH", {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                      })} บาท`
                            }
                        />
                        <Field label="วันหมดประกัน" value={thaiDate(asset.warrantyEndDate)} />

                        {asset.note && (
                            <div className="sm:col-span-2 lg:col-span-3">
                                <Separator className="mb-4" />
                                <Field
                                    label="หมายเหตุ"
                                    value={<p className="whitespace-pre-wrap">{asset.note}</p>}
                                />
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <QrCode className="size-4" aria-hidden />
                            QR Code
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center gap-3">
                        {qr ? (
                            <>
                                <Image
                                    src={qr.dataUrl}
                                    alt={`QR Code ของ ${asset.assetCode}`}
                                    width={180}
                                    height={180}
                                    unoptimized
                                    className="rounded-lg border bg-white p-2"
                                />
                                <p className="text-center text-xs text-muted-foreground">
                                    สแกนแล้วเปิดหน้านี้ — ติดที่ตัวเครื่องเพื่อให้เช็กประวัติได้จากหน้างาน
                                </p>
                            </>
                        ) : (
                            <Skeleton className="size-44 rounded-lg" />
                        )}
                    </CardContent>
                </Card>
            </div>

            {canManage && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">บันทึกการเคลื่อนไหว</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="space-y-2">
                            <Label>การกระทำ</Label>
                            <Select
                                value={action}
                                onValueChange={(v) => setAction(v as AssetHistoryAction)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {ASSET_HISTORY_ACTIONS.map((a) => (
                                        <SelectItem key={a} value={a}>
                                            {ASSET_HISTORY_ACTION_LABEL[a]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>ผู้รับ{needsRecipient && " *"}</Label>
                            <Select
                                value={toUserId || NONE}
                                onValueChange={(v) => setToUserId(v === NONE ? "" : v)}
                                disabled={!needsRecipient}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="ไม่ระบุ" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={NONE}>ไม่ระบุ</SelectItem>
                                    {people.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>
                                            {p.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="movementNote">หมายเหตุ</Label>
                            <Textarea
                                id="movementNote"
                                rows={2}
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="เช่น ส่งซ่อมที่ร้าน ABC ใบรับเลขที่ 123"
                            />
                        </div>

                        <div className="sm:col-span-2 lg:col-span-4">
                            <Button onClick={() => void recordMovement()} disabled={saving}>
                                {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
                                บันทึกการเคลื่อนไหว
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">ประวัติครุภัณฑ์</CardTitle>
                </CardHeader>
                <CardContent>
                    {histories.length === 0 ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">
                            ยังไม่มีประวัติการเคลื่อนไหว
                        </p>
                    ) : (
                        <ol className="space-y-4">
                            {histories.map((entry) => (
                                <li key={entry.id} className="flex gap-3">
                                    <div
                                        className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                                        aria-hidden
                                    />
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium">{entry.actionLabel}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {thaiDateTime(entry.createdAt)}
                                            {entry.actorName && ` · โดย ${entry.actorName}`}
                                            {entry.fromUserName && ` · จาก ${entry.fromUserName}`}
                                            {entry.toUserName && ` · ถึง ${entry.toUserName}`}
                                        </p>
                                        {entry.note && (
                                            <p className="text-sm whitespace-pre-wrap">
                                                {entry.note}
                                            </p>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ol>
                    )}
                </CardContent>
            </Card>

            <AssetFormDialog
                open={editOpen}
                onOpenChange={setEditOpen}
                asset={asset}
                people={people}
                departments={departments}
                onSaved={() => void fetchAll()}
            />

            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>ลบครุภัณฑ์นี้?</AlertDialogTitle>
                        <AlertDialogDescription>
                            &ldquo;{asset.assetCode} · {asset.name}&rdquo; จะถูกลบถาวร
                            พร้อมประวัติการเคลื่อนไหวทั้งหมด การกระทำนี้ย้อนกลับไม่ได้ —
                            ถ้าเพียงต้องการเลิกใช้งาน ให้เปลี่ยนสถานะเป็น &ldquo;จำหน่ายแล้ว&rdquo; แทน
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void deleteAsset()}>
                            ลบครุภัณฑ์
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
