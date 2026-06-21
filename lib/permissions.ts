import { createAccessControl } from "better-auth/plugins/access"
import { defaultStatements, adminAc } from "better-auth/plugins/admin/access"

// 1. กำหนด Actions ที่ทำได้ในระบบ
export const statement = {
    ...defaultStatements, 
    project: ["create", "read", "update", "delete"], 
} as const 

export const ac = createAccessControl(statement) 

// 2. สร้าง Role ตามเงื่อนไขของคุณ
export const user = ac.newRole({ 
    project: ["create", "read"], 
}) 

export const manager = ac.newRole({ 
    project: ["create", "read", "update"], 
}) 

export const admin = ac.newRole({
    project: ["create", "read", "update", "delete"],
    ...adminAc.statements, // ให้สิทธิ์จัดการ User/Session มาตรฐานของ Admin ด้วย
})