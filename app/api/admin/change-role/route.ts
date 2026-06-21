import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
    // 1. ตรวจสอบว่าผู้ใช้ล็อกอินอยู่
    const session = await auth.api.getSession({
        headers: await headers(),
    })

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2. ตรวจสอบว่าเป็น Admin
    if (session.user.role !== "admin") {
        return NextResponse.json(
            { error: "Forbidden: Admin access required" },
            { status: 403 }
        )
    }

    // 3. อ่านข้อมูลจาก request body
    const { userId, newRole } = await request.json()

    if (!userId || !newRole) {
        return NextResponse.json(
            { error: "Missing userId or newRole" },
            { status: 400 }
        )
    }

    // 4. ตรวจสอบว่า role ที่ส่งมาถูกต้อง
    const validRoles = ["user", "manager", "admin"]
    if (!validRoles.includes(newRole)) {
        return NextResponse.json(
            { error: "Invalid role. Must be 'user', 'manager', or 'admin'" },
            { status: 400 }
        )
    }

    // 5. อัปเดต role ใน database
    try {
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { role: newRole },
        })

        return NextResponse.json({
            message: `Role updated to ${newRole}`,
            user: {
                id: updatedUser.id,
                name: updatedUser.name,
                email: updatedUser.email,
                role: updatedUser.role,
            },
        })
    } catch {
        return NextResponse.json(
            { error: "User not found or update failed" },
            { status: 404 }
        )
    }
}