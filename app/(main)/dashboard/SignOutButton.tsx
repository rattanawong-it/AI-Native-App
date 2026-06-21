"use client"

import { useRouter } from "next/navigation"
import { signOut } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"

export function SignOutButton() {
    const router = useRouter()

    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
                await signOut()
                router.push("/auth/signin")
            }}
            className="gap-2"
        >
            <LogOut className="h-4 w-4" />
            ออกจากระบบ
        </Button>
    )
}