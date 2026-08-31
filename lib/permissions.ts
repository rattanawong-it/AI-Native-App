import { createAccessControl } from "better-auth/plugins/access"
import { defaultStatements, adminAc } from "better-auth/plugins/admin/access"

// 1. กำหนด Actions ที่ทำได้ในระบบ
//    - `project` คือ statement เดิมของแอป (คงไว้ ไม่เปลี่ยนความหมาย)
//    - ที่เหลือเป็น statement ของระบบ ITSM ตาม docs/spec.md §7 (RBAC Matrix)
export const statement = {
    ...defaultStatements,
    project: ["create", "read", "update", "delete"],

    // ── ITSM ──
    // read      = ดูเฉพาะรายการของตัวเอง
    // read-all  = ดูทั้งหมดในระบบ
    // assign    = มอบหมาย / โยกย้ายผู้รับผิดชอบ
    ticket: ["create", "read", "read-all", "update", "assign", "delete"],
    task: ["create", "read", "read-all", "update", "delete"],
    kb: ["create", "read", "update", "publish", "delete"],
    asset: ["create", "read", "update", "delete"],
    approval: ["create", "read", "read-all", "update", "approve", "delete"],
    report: ["read", "read-all", "export"],
    sla: ["read", "update"], // ตั้งค่า SLA / Service Catalog / ปฏิทินวันหยุด
} as const

export const ac = createAccessControl(statement)

// 2. สร้าง Role ตามเงื่อนไขของคุณ

/// นักศึกษา — แจ้งปัญหาและติดตามของตัวเองได้ + อ่าน KB สาธารณะ
export const student = ac.newRole({
    ticket: ["create", "read"],
    kb: ["read"],
})

/// บุคลากรทั่วไป — สิทธิ์เท่านักศึกษา + statement `project` เดิมของแอป
export const user = ac.newRole({
    project: ["create", "read"],
    ticket: ["create", "read"],
    kb: ["read"],
})

/// เจ้าหน้าที่ IT — รับงาน เปลี่ยนสถานะ เขียน KB (ยัง Publish เองไม่ได้)
export const agent = ac.newRole({
    project: ["read"],
    ticket: ["create", "read", "read-all", "update", "assign"],
    task: ["read", "update"],
    kb: ["create", "read", "update"],
    asset: ["read"],
    approval: ["create", "read"],
    report: ["read"],
    sla: ["read"],
})

/// หัวหน้า / ผู้บริหาร — มอบหมายงาน อนุมัติคำขอ Publish KB ดูรายงานรวม
export const manager = ac.newRole({
    project: ["create", "read", "update"],
    ticket: ["create", "read", "read-all", "update", "assign"],
    task: ["create", "read", "read-all", "update", "delete"],
    kb: ["create", "read", "update", "publish", "delete"],
    asset: ["create", "read", "update", "delete"],
    approval: ["create", "read", "read-all", "update", "approve"],
    report: ["read", "read-all", "export"],
    sla: ["read"],
})

/// ผู้ดูแลระบบ — ทุกสิทธิ์ + ตั้งค่า SLA/Catalog/ปฏิทิน + จัดการผู้ใช้
export const admin = ac.newRole({
    project: ["create", "read", "update", "delete"],
    ticket: ["create", "read", "read-all", "update", "assign", "delete"],
    task: ["create", "read", "read-all", "update", "delete"],
    kb: ["create", "read", "update", "publish", "delete"],
    asset: ["create", "read", "update", "delete"],
    approval: ["create", "read", "read-all", "update", "approve", "delete"],
    report: ["read", "read-all", "export"],
    sla: ["read", "update"],
    ...adminAc.statements, // ให้สิทธิ์จัดการ User/Session มาตรฐานของ Admin ด้วย
})
