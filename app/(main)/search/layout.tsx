// app/(main)/search/layout.tsx
// วางตัวแสดง toast ไว้เฉพาะหน้าค้นหารวม — แบบเดียวกับ service/, admin/ และ reports/

import { Toaster } from "@/components/ui/sonner"

export default function SearchLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            <Toaster position="top-right" richColors closeButton />
        </>
    )
}
