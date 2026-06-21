// app/api/users/route.ts
import { NextRequest, NextResponse } from "next/server"

// GET /api/users
export async function GET() {
    // ตัวอย่าง: ดึงข้อมูลจาก Prisma
    // const users = await prisma.user.findMany()
    return NextResponse.json({
        users: [
            { id: 1, name: "John", email: "john@example.com" },
            { id: 2, name: "Jane", email: "jane@example.com" },
        ],
    })
}

// POST /api/users
export async function POST(request: NextRequest) {
    const body = await request.json()
    const { name, email } = body

    if (!name || !email) {
        return NextResponse.json(
            { error: "Name and email are required" },
            { status: 400 }
        )
    }

    // ตัวอย่าง: สร้าง user ใน Prisma
    // const user = await prisma.user.create({ data: { name, email } })
    return NextResponse.json(
        { message: "User created", user: { name, email } },
        { status: 200 }
    )
}