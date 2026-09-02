"use client"

// ฟอร์มเพิ่ม/แก้ไขครุภัณฑ์ — ใช้ร่วมกันทั้งหน้ารายการและหน้ารายละเอียด (F7.1, F7.2)
//
// ฟอร์มเดียวทำสองหน้าที่: ไม่ส่ง `asset` มา = เพิ่มใหม่ · ส่งมา = แก้ไขใบเดิม
// รหัสครุภัณฑ์เว้นว่างได้ตอนเพิ่ม ระบบจะออกรหัสรันนิ่งให้เอง

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    ASSET_STATUSES,
    ASSET_STATUS_LABEL,
    ASSET_TYPES,
    ASSET_TYPE_LABEL,
    requiresCustodian,
    type AssetStatus,
    type AssetType,
} from "@/lib/asset-workflow"
import {
    assetFormToPayload,
    assetToForm,
    EMPTY_ASSET_FORM,
    type AssetDetail,
    type AssetFormValues,
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

/// ค่าที่ใช้แทน "ไม่ระบุ" ใน Select — Radix ไม่ยอมรับ value ที่เป็นสตริงว่าง
const NONE = "__none__"

export default function AssetFormDialog({
    open,
    onOpenChange,
    asset,
    people,
    departments,
    onSaved,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    /// ไม่ส่งมา = โหมดเพิ่มใหม่
    asset?: AssetDetail | null
    people: Person[]
    departments: DepartmentOption[]
    onSaved: () => void
}) {
    const [form, setForm] = useState<AssetFormValues>(EMPTY_ASSET_FORM)
    const [saving, setSaving] = useState(false)

    // เปิดกล่องใหม่ทุกครั้งต้องเริ่มจากข้อมูลปัจจุบัน ไม่ใช่ค่าที่ค้างจากการเปิดครั้งก่อน
    useEffect(() => {
        if (!open) return
        setForm(asset ? assetToForm(asset) : EMPTY_ASSET_FORM)
    }, [open, asset])

    const set = <K extends keyof AssetFormValues>(key: K, value: AssetFormValues[K]) =>
        setForm((prev) => ({ ...prev, [key]: value }))

    const save = async () => {
        if (form.name.trim().length < 2) {
            toast.error("กรุณากรอกชื่อครุภัณฑ์")
            return
        }
        if (requiresCustodian(form.status) && !form.custodianId) {
            toast.error('สถานะ "ใช้งาน" ต้องระบุผู้ครอบครอง')
            return
        }

        setSaving(true)
        try {
            const res = await fetch(asset ? `/api/assets/${asset.id}` : "/api/assets", {
                method: asset ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(assetFormToPayload(form)),
            })

            if (!res.ok) {
                toast.error(await readError(res, "บันทึกครุภัณฑ์ไม่สำเร็จ"))
                return
            }

            toast.success(asset ? "บันทึกการแก้ไขแล้ว" : "เพิ่มครุภัณฑ์แล้ว")
            onOpenChange(false)
            onSaved()
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{asset ? "แก้ไขครุภัณฑ์" : "เพิ่มครุภัณฑ์"}</DialogTitle>
                    <DialogDescription>
                        {asset
                            ? "การเปลี่ยนสถานะหรือผู้ครอบครองจะถูกบันทึกลงประวัติอัตโนมัติ"
                            : "เว้นรหัสครุภัณฑ์ว่างไว้ได้ ระบบจะออกรหัสให้อัตโนมัติ"}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="assetCode">รหัสครุภัณฑ์</Label>
                        <Input
                            id="assetCode"
                            value={form.assetCode}
                            onChange={(e) => set("assetCode", e.target.value)}
                            placeholder="เว้นว่างเพื่อให้ระบบออกให้"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="name">ชื่อครุภัณฑ์ *</Label>
                        <Input
                            id="name"
                            value={form.name}
                            onChange={(e) => set("name", e.target.value)}
                            placeholder="เช่น คอมพิวเตอร์สำนักงาน ชั้น 3"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>ประเภท</Label>
                        <Select
                            value={form.type}
                            onValueChange={(v) => set("type", v as AssetType)}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {ASSET_TYPES.map((t) => (
                                    <SelectItem key={t} value={t}>
                                        {ASSET_TYPE_LABEL[t]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>สถานะ</Label>
                        <Select
                            value={form.status}
                            onValueChange={(v) => set("status", v as AssetStatus)}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {ASSET_STATUSES.map((s) => (
                                    <SelectItem key={s} value={s}>
                                        {ASSET_STATUS_LABEL[s]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="brand">ยี่ห้อ</Label>
                        <Input
                            id="brand"
                            value={form.brand}
                            onChange={(e) => set("brand", e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="model">รุ่น</Label>
                        <Input
                            id="model"
                            value={form.model}
                            onChange={(e) => set("model", e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="serialNumber">หมายเลขเครื่อง (S/N)</Label>
                        <Input
                            id="serialNumber"
                            value={form.serialNumber}
                            onChange={(e) => set("serialNumber", e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="location">สถานที่</Label>
                        <Input
                            id="location"
                            value={form.location}
                            onChange={(e) => set("location", e.target.value)}
                            placeholder="เช่น อาคาร 1 ห้อง 305"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="purchaseDate">วันที่ซื้อ</Label>
                        <Input
                            id="purchaseDate"
                            type="date"
                            value={form.purchaseDate}
                            onChange={(e) => set("purchaseDate", e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="warrantyEndDate">วันหมดประกัน</Label>
                        <Input
                            id="warrantyEndDate"
                            type="date"
                            value={form.warrantyEndDate}
                            onChange={(e) => set("warrantyEndDate", e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="price">ราคา (บาท)</Label>
                        <Input
                            id="price"
                            type="number"
                            min={0}
                            step="0.01"
                            value={form.price}
                            onChange={(e) => set("price", e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>ผู้ครอบครอง</Label>
                        <Select
                            value={form.custodianId || NONE}
                            onValueChange={(v) => set("custodianId", v === NONE ? "" : v)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="ยังไม่มีผู้ครอบครอง" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NONE}>ยังไม่มีผู้ครอบครอง</SelectItem>
                                {people.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                        {p.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>หน่วยงาน</Label>
                        <Select
                            value={form.departmentId || NONE}
                            onValueChange={(v) => set("departmentId", v === NONE ? "" : v)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="ไม่ระบุหน่วยงาน" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NONE}>ไม่ระบุหน่วยงาน</SelectItem>
                                {departments.map((d) => (
                                    <SelectItem key={d.id} value={d.id}>
                                        {d.name} ({d.code})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="note">หมายเหตุ</Label>
                        <Textarea
                            id="note"
                            rows={3}
                            value={form.note}
                            onChange={(e) => set("note", e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                        ยกเลิก
                    </Button>
                    <Button onClick={() => void save()} disabled={saving}>
                        {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
                        บันทึก
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
