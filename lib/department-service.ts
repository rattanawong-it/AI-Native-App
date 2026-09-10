// lib/department-service.ts
// ตัวช่วยฝั่ง server ของทะเบียนหน่วยงาน — select, ตัวกรองค้นหา และการคำนวณลำดับชั้น
//
// ลำดับชั้นลึกได้ 3 ชั้น (สำนัก/คณะ › ฝ่าย › งาน) ตามรหัสงานสารบรรณของมหาวิทยาลัย
// `level` ไม่รับจาก client — คำนวณจากหน่วยงานแม่ที่นี่ที่เดียว

import type { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { MAX_DEPARTMENT_LEVEL } from "@/lib/department-schema"
import type { DepartmentRow } from "@/lib/department-types"

/// ดึงชื่อแม่ขึ้นไป 2 ชั้น — พอสำหรับลำดับชั้น 3 ชั้นที่ลึกที่สุด
export const departmentSelect = {
    id: true,
    name: true,
    code: true,
    parentId: true,
    level: true,
    active: true,
    parent: {
        select: {
            name: true,
            parent: { select: { name: true } },
        },
    },
    _count: { select: { users: true, tickets: true, assets: true, children: true } },
} satisfies Prisma.DepartmentSelect

type DepartmentPayload = Prisma.DepartmentGetPayload<{ select: typeof departmentSelect }>

export function toDepartmentDto(d: DepartmentPayload): DepartmentRow {
    // ไล่จากบนลงล่าง: ปู่ก่อน แล้วค่อยพ่อ
    const ancestors: string[] = []
    if (d.parent?.parent?.name) ancestors.push(d.parent.parent.name)
    if (d.parent?.name) ancestors.push(d.parent.name)

    return {
        id: d.id,
        name: d.name,
        code: d.code,
        parentId: d.parentId,
        level: d.level,
        active: d.active,
        ancestors,
        counts: {
            users: d._count.users,
            tickets: d._count.tickets,
            assets: d._count.assets,
            children: d._count.children,
        },
    }
}

export function buildDepartmentWhere(options: {
    q?: string
    includeInactive?: boolean
}): Prisma.DepartmentWhereInput {
    const and: Prisma.DepartmentWhereInput[] = []

    if (!options.includeInactive) and.push({ active: true })

    if (options.q) {
        and.push({
            OR: [
                { code: { contains: options.q, mode: "insensitive" } },
                { name: { contains: options.q, mode: "insensitive" } },
            ],
        })
    }

    if (and.length === 0) return {}
    return and.length === 1 ? and[0] : { AND: and }
}

/// ตรวจหน่วยงานแม่แล้วคืน level ที่ลูกควรเป็น
/// คืน `{ ok: false }` เมื่อแม่ไม่มีอยู่จริงหรือจะทำให้ลึกเกินกำหนด
export type ResolveLevelResult = { ok: true; level: number } | { ok: false; error: string }

export async function resolveDepartmentLevel(parentId: string | null): Promise<ResolveLevelResult> {
    if (!parentId) return { ok: true, level: 1 }

    const parent = await prisma.department.findUnique({
        where: { id: parentId },
        select: { level: true },
    })
    if (!parent) return { ok: false, error: "ไม่พบหน่วยงานแม่ที่เลือก" }
    if (parent.level >= MAX_DEPARTMENT_LEVEL) {
        return { ok: false, error: `หน่วยงานซ้อนได้ลึกสุด ${MAX_DEPARTMENT_LEVEL} ชั้น` }
    }
    return { ok: true, level: parent.level + 1 }
}

/// กันการตั้งหน่วยงานแม่เป็นตัวเองหรือลูกหลานของตัวเอง (จะเกิดวงวน)
export async function isDescendantOf(candidateId: string, ancestorId: string): Promise<boolean> {
    let current: string | null = candidateId
    // ลึกสุด 3 ชั้น แต่เผื่อ loop ไว้กันข้อมูลเสียหายทำให้วนไม่รู้จบ
    for (let hop = 0; hop <= MAX_DEPARTMENT_LEVEL && current; hop++) {
        if (current === ancestorId) return true
        const row: { parentId: string | null } | null = await prisma.department.findUnique({
            where: { id: current },
            select: { parentId: true },
        })
        current = row?.parentId ?? null
    }
    return false
}
