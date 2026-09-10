// lib/department-types.ts
// ชนิดข้อมูลฝั่ง client ของทะเบียนหน่วยงาน — ให้หน้าจอกับ API พูดภาษาเดียวกัน
//
// แยกจาก `lib/department-service.ts` เพราะไฟล์นั้น import prisma — client component นำเข้าไม่ได้

export interface DepartmentRef {
    id: string
    name: string
    code: string
}

export interface DepartmentRow extends DepartmentRef {
    parentId: string | null
    level: number
    active: boolean
    /// ชื่อหน่วยงานแม่ไล่จากบนลงล่าง เช่น ["สำนักอธิการบดี", "ฝ่ายบริหารทั่วไป"]
    /// จำเป็นเพราะชื่อหน่วยงานซ้ำกันได้ — มี "สำนักงานธุรการและประสานงาน" ถึง 13 แห่ง
    ancestors: string[]
    /// จำนวนสิ่งที่อ้างถึงหน่วยงานนี้ — ใช้บอกผู้ใช้ว่าลบจริงได้หรือได้แค่ปิดใช้งาน
    counts: {
        users: number
        tickets: number
        assets: number
        children: number
    }
}

export interface DepartmentListResponse {
    departments: DepartmentRow[]
    total: number
    page: number
    pageSize: number
    totalPages: number
}

/// เส้นทางหน่วยงานแบบอ่านง่าย เช่น "สำนักอธิการบดี › ฝ่ายบริหารทั่วไป"
export function departmentPath(row: Pick<DepartmentRow, "ancestors">): string {
    return row.ancestors.join(" › ")
}
