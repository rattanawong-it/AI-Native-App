// app/(main)/management/teams/layout.tsx
// วางตัวแสดง toast ไว้เฉพาะกลุ่มหน้าทีมงาน — แบบเดียวกับ service/, admin/ และ reports/

import { Toaster } from "@/components/ui/sonner"

export default function TeamsLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            <Toaster position="top-right" richColors closeButton />
        </>
    )
}
