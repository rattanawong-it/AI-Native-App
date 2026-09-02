import { Metadata } from "next"
import AssetContent from "@/app/(main)/management/assets/AssetContent"

export const metadata: Metadata = {
    title: "ทะเบียนครุภัณฑ์ IT",
    description: "ทะเบียนครุภัณฑ์และทรัพย์สินไอทีของศูนย์ — สถานะ ผู้ครอบครอง และวันหมดประกัน",
    keywords: ["ครุภัณฑ์", "ทรัพย์สิน IT", "ทะเบียนครุภัณฑ์", "ศูนย์ไอที"],
}

export default function AssetsPage() {
    return <AssetContent />
}
