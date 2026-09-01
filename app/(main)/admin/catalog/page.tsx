import { Metadata } from "next"
import CatalogContent from "@/app/(main)/admin/catalog/CatalogContent"

export const metadata: Metadata = {
    title: "Service Catalog",
    description: "จัดการหมวดหมู่บริการ ผู้รับผิดชอบเริ่มต้น และการมอบหมายอัตโนมัติ",
    keywords: ["Service Catalog", "หมวดหมู่บริการ", "ศูนย์ไอที"],
}

export default function CatalogPage() {
    return <CatalogContent />
}
