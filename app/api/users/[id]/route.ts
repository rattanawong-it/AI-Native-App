import { NextRequest, NextResponse } from "next/server"

// GET /api/users?page=1&limit=10
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const page = searchParams.get("page") || "1"
    const limit = searchParams.get("limit") || "10"

    return NextResponse.json({
        page: parseInt(page),
        limit: parseInt(limit),
        data: [],
    })
}

// DELETE /api/users/:id
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params

    // ตัวอย่าง: ลบ user ใน Prisma
    // await prisma.user.delete({ where: { id } })
    return NextResponse.json({ message: `User ${id} deleted` })
}