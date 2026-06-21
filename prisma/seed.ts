// Seed script: สร้าง Admin เริ่มต้น
// ใช้: pnpx tsx --env-file=.env prisma/seed.ts

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../app/generated/prisma/client"

const connectionString = process.env.DATABASE_URL!

async function main() {
    const adapter = new PrismaPg({ connectionString })
    const prisma = new PrismaClient({ adapter })

    const adminEmail = process.env.ADMIN_EMAIL || "rattana.wong@krirk.ac.th"

    console.log(`\n🔍 Looking for user with email: ${adminEmail}`)

    // ค้นหา user ที่มีอีเมลตรงกัน
    const existingUser = await prisma.user.findUnique({
        where: { email: adminEmail },
    })

    if (existingUser) {
        // ถ้า user มีอยู่แล้ว → อัปเดต role เป็น admin
        if (existingUser.role === "admin") {
            console.log(`✅ User "${existingUser.name}" is already an admin.`)
        } else {
            const updated = await prisma.user.update({
                where: { email: adminEmail },
                data: { role: "admin" },
            })
            console.log(`✅ Updated "${updated.name}" (${updated.email}) role to "admin"`)
        }
    } else {
        console.log(`⚠️  No user found with email: ${adminEmail}`)
        console.log(``)
        console.log(`   Please do one of the following:`)
        console.log(`   1. Sign up at http://localhost:3000/auth/signup with this email`)
        console.log(`   2. Or set ADMIN_EMAIL in .env to an existing user's email`)
        console.log(`   Then run this seed script again: npx tsx prisma/seed.ts`)
    }

    await prisma.$disconnect()
}

main().catch((e) => {
    console.error("❌ Seed failed:", e)
    process.exit(1)
})