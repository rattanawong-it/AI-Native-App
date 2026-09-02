"use client"

// หน้ารายละเอียดคำขออนุมัติ — เนื้อคำขอ ลำดับขั้น เส้นเวลา และปุ่มตัดสินใจของผู้อนุมัติ
// อ้างอิง F7.8, F7.10, F7.11, F7.12, F7.14

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
    ArrowLeft,
    Ban,
    Check,
    FileCheck2,
    Loader2,
    Send,
    Trash2,
    X,
} from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
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
import {
    ApprovalStatusBadge,
    ApprovalStepBadge,
    ApprovalTypeBadge,
} from "@/components/approval/approval-badges"
import { formatAmount, type ApprovalDetailResponse } from "@/lib/approval-types"
import { readError } from "@/lib/ticket-types"

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

export default function RequestDetailContent({ requestId }: { requestId: string }) {
    const router = useRouter()

    const [data, setData] = useState<ApprovalDetailResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState(false)
    const [comment, setComment] = useState("")
    const [confirmCancel, setConfirmCancel] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/approvals/${requestId}`)
            if (!res.ok) {
                toast.error(await readError(res, "ไม่พบคำขอที่ต้องการ"))
                return
            }
            setData((await res.json()) as ApprovalDetailResponse)
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setLoading(false)
        }
    }, [requestId])

    useEffect(() => {
        void load()
    }, [load])

    /// เรียก endpoint ที่เปลี่ยนสถานะแล้วโหลดใบใหม่ — ใช้ร่วมกันทั้งยื่น/ยกเลิก/ตัดสิน
    const act = async (path: string, body: unknown, successMessage: string) => {
        setBusy(true)
        try {
            const res = await fetch(`/api/approvals/${requestId}${path}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body ?? {}),
            })

            if (!res.ok) {
                toast.error(await readError(res, "ดำเนินการไม่สำเร็จ"))
                return
            }

            toast.success(successMessage)
            setComment("")
            await load()
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setBusy(false)
        }
    }

    const decide = async (approved: boolean) => {
        if (!approved && comment.trim() === "") {
            toast.error("กรุณาระบุเหตุผลเมื่อไม่อนุมัติ")
            return
        }
        await act(
            "/decide",
            { approved, comment: comment.trim() || undefined },
            approved ? "บันทึกการอนุมัติแล้ว" : "บันทึกการไม่อนุมัติแล้ว"
        )
    }

    const remove = async () => {
        setBusy(true)
        try {
            const res = await fetch(`/api/approvals/${requestId}`, { method: "DELETE" })
            if (!res.ok) {
                toast.error(await readError(res, "ลบคำขอไม่สำเร็จ"))
                return
            }
            toast.success("ลบคำขอแล้ว")
            router.push("/management/requests")
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setBusy(false)
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

    if (!data) {
        return (
            <div className="p-4 md:p-6">
                <Card>
                    <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                        <FileCheck2 className="size-10 text-muted-foreground" aria-hidden />
                        <p className="font-medium">ไม่พบคำขอที่ต้องการ</p>
                        <Button variant="outline" size="sm" asChild>
                            <Link href="/management/requests">กลับไปหน้ารายการ</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const { request, timeline, canDecide, canEdit } = data
    const canSubmit = request.status === "draft" || request.status === "rejected"
    const canCancel = request.status === "draft" || request.status === "pending"

    return (
        <div className="space-y-6 p-4 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                    <Button variant="ghost" size="sm" asChild className="-ml-2">
                        <Link href="/management/requests">
                            <ArrowLeft className="size-4" aria-hidden />
                            คำขออนุมัติ
                        </Link>
                    </Button>

                    <div className="flex flex-wrap items-center gap-2">
                        <ApprovalStatusBadge status={request.status} />
                        <ApprovalTypeBadge type={request.type} />
                    </div>

                    <h1 className="text-2xl font-semibold">{request.title}</h1>
                    <p className="font-mono text-sm text-muted-foreground">
                        {request.requestNo} · ผู้ขอ {request.requester.name}
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    {canSubmit && canEdit && (
                        <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => void act("/submit", {}, "ยื่นคำขอแล้ว")}
                        >
                            {busy ? (
                                <Loader2 className="size-4 animate-spin" aria-hidden />
                            ) : (
                                <Send className="size-4" aria-hidden />
                            )}
                            ยื่นคำขอ
                        </Button>
                    )}

                    {canCancel && (
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => setConfirmCancel(true)}
                        >
                            <Ban className="size-4" aria-hidden />
                            ยกเลิกคำขอ
                        </Button>
                    )}

                    {request.status === "draft" && canEdit && (
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => setConfirmDelete(true)}
                            className="text-destructive hover:text-destructive"
                        >
                            <Trash2 className="size-4" aria-hidden />
                            ลบ
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-base">รายละเอียด</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-3">
                            <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">จำนวนเงิน</p>
                                <p className="text-sm font-medium">
                                    {formatAmount(request.amount)}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">ยื่นเมื่อ</p>
                                <p className="text-sm">{thaiDateTime(request.createdAt)}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">อัปเดตล่าสุด</p>
                                <p className="text-sm">{thaiDateTime(request.updatedAt)}</p>
                            </div>
                        </div>

                        <Separator />

                        {request.description ? (
                            <p className="text-sm whitespace-pre-wrap">{request.description}</p>
                        ) : (
                            <p className="text-sm text-muted-foreground">ไม่ได้กรอกรายละเอียด</p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">ลำดับการอนุมัติ</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ol className="space-y-3">
                            {request.steps.map((step) => {
                                const isCurrent =
                                    request.status === "pending" &&
                                    step.stepOrder === request.currentStep

                                return (
                                    <li
                                        key={step.id}
                                        className={
                                            isCurrent
                                                ? "rounded-lg border border-primary/50 bg-primary/5 p-3"
                                                : "rounded-lg border p-3"
                                        }
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                                                {step.stepOrder}
                                            </span>
                                            <span className="flex-1 text-sm font-medium">
                                                {step.approver.name}
                                            </span>
                                            <ApprovalStepBadge status={step.status} />
                                        </div>

                                        {step.decidedAt && (
                                            <p className="mt-2 text-xs text-muted-foreground">
                                                {thaiDateTime(step.decidedAt)}
                                            </p>
                                        )}
                                        {step.comment && (
                                            <p className="mt-1 text-sm whitespace-pre-wrap">
                                                {step.comment}
                                            </p>
                                        )}
                                    </li>
                                )
                            })}
                        </ol>
                    </CardContent>
                </Card>
            </div>

            {canDecide && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">พิจารณาคำขอ</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="comment">ความเห็น (บังคับเมื่อไม่อนุมัติ)</Label>
                            <Textarea
                                id="comment"
                                rows={3}
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="เหตุผลประกอบการพิจารณา"
                            />
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Button disabled={busy} onClick={() => void decide(true)}>
                                {busy ? (
                                    <Loader2 className="size-4 animate-spin" aria-hidden />
                                ) : (
                                    <Check className="size-4" aria-hidden />
                                )}
                                อนุมัติ
                            </Button>
                            <Button
                                variant="outline"
                                disabled={busy}
                                onClick={() => void decide(false)}
                                className="text-destructive hover:text-destructive"
                            >
                                <X className="size-4" aria-hidden />
                                ไม่อนุมัติ
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">เส้นเวลา</CardTitle>
                </CardHeader>
                <CardContent>
                    <ol className="space-y-4">
                        {timeline.map((entry, index) => (
                            <li key={`${entry.at}-${index}`} className="flex gap-3">
                                <div
                                    className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                                    aria-hidden
                                />
                                <div className="space-y-1">
                                    <p className="text-sm font-medium">{entry.title}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {thaiDateTime(entry.at)}
                                        {entry.actorName && ` · ${entry.actorName}`}
                                    </p>
                                    {entry.comment && (
                                        <p className="text-sm whitespace-pre-wrap">
                                            {entry.comment}
                                        </p>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ol>
                </CardContent>
            </Card>

            <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>ยกเลิกคำขอนี้?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {request.requestNo} จะถูกปิดเป็น &ldquo;ยกเลิก&rdquo;
                            และจะหายไปจากกล่องรออนุมัติของผู้อนุมัติทุกคน — ใบที่ยกเลิกแล้วยื่นซ้ำไม่ได้
                            ต้องสร้างคำขอใหม่
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>ไม่ยกเลิก</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => void act("/cancel", {}, "ยกเลิกคำขอแล้ว")}
                        >
                            ยกเลิกคำขอ
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>ลบคำขอฉบับร่างนี้?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {request.requestNo} จะถูกลบถาวรพร้อมลำดับขั้นการอนุมัติที่ตั้งไว้
                            การกระทำนี้ย้อนกลับไม่ได้
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void remove()}>ลบคำขอ</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
