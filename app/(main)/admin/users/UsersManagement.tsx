"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { authClient, useSession } from "@/lib/auth-client"
import {
    Users,
    Plus,
    Shield,
    ShieldAlert,
    Ban,
    Trash2,
    Key,
    Pencil,
    UserCheck,
    UserX,
    Search,
    ChevronLeft,
    ChevronRight,
    MoreHorizontal,
    X,
    Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ============================================================
// Types
// ============================================================
interface User {
    id: string
    name: string
    email: string
    image: string | null
    role: string
    banned: boolean
    banReason: string | null
    banExpires: string | null
    createdAt: string
}

const ALL_ROLES = ["user", "manager", "admin"] as const
type RoleType = (typeof ALL_ROLES)[number]

type ModalType =
    | "create"
    | "editUser"
    | "setRole"
    | "ban"
    | "setPassword"
    | "delete"
    | null

// ============================================================
// Main Component
// ============================================================
export default function UsersManagement() {
    const { data: session } = useSession()

    // ── State ────────────────────────────────────────────────
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [page, setPage] = useState(1)
    const [totalUsers, setTotalUsers] = useState(0)
    const limit = 10

    // Modal
    const [modal, setModal] = useState<ModalType>(null)
    const [selectedUser, setSelectedUser] = useState<User | null>(null)
    const [actionLoading, setActionLoading] = useState(false)
    const [actionError, setActionError] = useState("")
    const [actionSuccess, setActionSuccess] = useState("")

    // Dropdown
    const [openDropdown, setOpenDropdown] = useState<string | null>(null)
    const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
    const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({})

    // Form fields
    const [formName, setFormName] = useState("")
    const [formEmail, setFormEmail] = useState("")
    const [formPassword, setFormPassword] = useState("")
    const [formRoles, setFormRoles] = useState<RoleType[]>(["user"])
    const [formBanReason, setFormBanReason] = useState("")
    const [formBanDuration, setFormBanDuration] = useState<number>(0) // 0 = ถาวร, อื่นๆ = วินาที

    // ── Fetch Users ──────────────────────────────────────────
    const fetchUsers = useCallback(async () => {
        setLoading(true)
        try {
            const res = await authClient.admin.listUsers({
                query: {
                    limit,
                    offset: (page - 1) * limit,
                    ...(search
                        ? {
                              searchField: "email",
                              searchValue: search,
                              searchOperator: "contains" as const,
                          }
                        : {}),
                },
            })

            if (res.data) {
                setUsers(res.data.users as unknown as User[])
                setTotalUsers(res.data.total)
            }
        } catch {
            console.error("Failed to fetch users")
        } finally {
            setLoading(false)
        }
    }, [page, search])

    useEffect(() => {
        fetchUsers()
    }, [fetchUsers])

    const totalPages = Math.ceil(totalUsers / limit)

    // ── Helpers ──────────────────────────────────────────────
    const resetForm = () => {
        setFormName("")
        setFormEmail("")
        setFormPassword("")
        setFormRoles(["user"])
        setFormBanReason("")
        setFormBanDuration(0)
        setActionError("")
        setActionSuccess("")
    }

    const openModal = (type: ModalType, user?: User) => {
        resetForm()
        setModal(type)
        if (user) {
            setSelectedUser(user)
            setFormRoles(user.role.split(",").map((r) => r.trim()) as RoleType[])
            if (type === "editUser") {
                setFormName(user.name)
            }
        }
    }

    const closeModal = () => {
        setModal(null)
        setSelectedUser(null)
        resetForm()
    }

    const showSuccess = (msg: string) => {
        setActionSuccess(msg)
        setTimeout(() => setActionSuccess(""), 3000)
    }

    // ── Actions ──────────────────────────────────────────────
    const handleCreateUser = async () => {
        setActionLoading(true)
        setActionError("")
        try {
            const res = await authClient.admin.createUser({
                name: formName,
                email: formEmail,
                password: formPassword,
                role: formRoles.length === 1 ? formRoles[0] : formRoles,
            })
            if (res.error) throw new Error(res.error.message ?? "Create failed")
            closeModal()
            showSuccess("สร้างผู้ใช้ใหม่สำเร็จ")
            fetchUsers()
        } catch (err: unknown) {
            setActionError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด")
        } finally {
            setActionLoading(false)
        }
    }

    const handleUpdateUser = async () => {
        if (!selectedUser) return
        setActionLoading(true)
        setActionError("")
        try {
            const res = await authClient.admin.updateUser({
                userId: selectedUser.id,
                data: { name: formName },
            })
            if (res.error) throw new Error(res.error.message ?? "Update failed")
            closeModal()
            showSuccess("อัปเดตข้อมูลผู้ใช้สำเร็จ")
            fetchUsers()
        } catch (err: unknown) {
            setActionError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด")
        } finally {
            setActionLoading(false)
        }
    }

    const handleSetRole = async () => {
        if (!selectedUser) return
        setActionLoading(true)
        setActionError("")
        try {
            const res = await authClient.admin.setRole({
                userId: selectedUser.id,
                role: formRoles.length === 1 ? formRoles[0] : formRoles,
            })
            if (res.error) throw new Error(res.error.message ?? "Set role failed")
            closeModal()
            showSuccess(`เปลี่ยน role เป็น "${formRoles.join(", ")}" สำเร็จ`)
            fetchUsers()
        } catch (err: unknown) {
            setActionError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด")
        } finally {
            setActionLoading(false)
        }
    }

    const handleBanUser = async () => {
        if (!selectedUser) return
        setActionLoading(true)
        setActionError("")
        try {
            const res = await authClient.admin.banUser({
                userId: selectedUser.id,
                banReason: formBanReason || undefined,
                ...(formBanDuration > 0 ? { banExpiresIn: formBanDuration } : {}),
            })
            if (res.error) throw new Error(res.error.message ?? "Ban failed")
            closeModal()
            showSuccess("แบนผู้ใช้สำเร็จ")
            fetchUsers()
        } catch (err: unknown) {
            setActionError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด")
        } finally {
            setActionLoading(false)
        }
    }

    const handleUnbanUser = async (user: User) => {
        try {
            const res = await authClient.admin.unbanUser({
                userId: user.id,
            })
            if (res.error) throw new Error(res.error.message ?? "Unban failed")
            showSuccess("ปลดแบนผู้ใช้สำเร็จ")
            fetchUsers()
        } catch {
            console.error("Unban failed")
        }
    }

    const handleSetPassword = async () => {
        if (!selectedUser) return
        setActionLoading(true)
        setActionError("")
        try {
            const res = await authClient.admin.setUserPassword({
                userId: selectedUser.id,
                newPassword: formPassword,
            })
            if (res.error) throw new Error(res.error.message ?? "Set password failed")
            closeModal()
            showSuccess("เปลี่ยนรหัสผ่านสำเร็จ")
        } catch (err: unknown) {
            setActionError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด")
        } finally {
            setActionLoading(false)
        }
    }

    const handleDeleteUser = async () => {
        if (!selectedUser) return
        setActionLoading(true)
        setActionError("")
        try {
            const res = await authClient.admin.removeUser({
                userId: selectedUser.id,
            })
            if (res.error) throw new Error(res.error.message ?? "Delete failed")
            closeModal()
            showSuccess("ลบผู้ใช้สำเร็จ")
            fetchUsers()
        } catch (err: unknown) {
            setActionError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด")
        } finally {
            setActionLoading(false)
        }
    }

    const handleImpersonate = async (user: User) => {
        try {
            const res = await authClient.admin.impersonateUser({
                userId: user.id,
            })
            if (res.error) throw new Error(res.error.message ?? "Impersonate failed")
            window.location.href = "/dashboard"
        } catch {
            console.error("Impersonate failed")
        }
    }

    const handleStopImpersonating = async () => {
        try {
            await authClient.admin.stopImpersonating()
            window.location.href = "/admin/users"
        } catch {
            console.error("Stop impersonating failed")
        }
    }

    // ── Role badge ───────────────────────────────────────────
    const RoleBadge = ({ role }: { role: string }) => {
        const colors: Record<string, string> = {
            admin: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
            manager:
                "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
            user: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
        }
        const iconMap: Record<string, React.ReactNode> = {
            admin: <ShieldAlert className="h-3 w-3" />,
            manager: <Shield className="h-3 w-3" />,
            user: <UserCheck className="h-3 w-3" />,
        }
        const roles = role.split(",").map((r) => r.trim())
        return (
            <div className="flex flex-wrap gap-1">
                {roles.map((r) => (
                    <span
                        key={r}
                        className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                            colors[r] ?? "bg-gray-100 text-gray-700"
                        )}
                    >
                        {iconMap[r]}
                        {r}
                    </span>
                ))}
            </div>
        )
    }

    // ── Role Checkbox Toggle ─────────────────────────────────
    const toggleRole = (role: RoleType) => {
        setFormRoles((prev) => {
            if (prev.includes(role)) {
                // ต้องเหลืออย่างน้อย 1 role
                if (prev.length <= 1) return prev
                return prev.filter((r) => r !== role)
            }
            return [...prev, role]
        })
    }

    const RoleCheckboxes = () => (
        <div className="flex flex-col gap-2">
            {ALL_ROLES.map((role) => (
                <label
                    key={role}
                    className="flex items-center gap-2 cursor-pointer rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                    <input
                        type="checkbox"
                        checked={formRoles.includes(role)}
                        onChange={() => toggleRole(role)}
                        className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-primary accent-primary"
                    />
                    <RoleBadge role={role} />
                </label>
            ))}
        </div>
    )

    // ── Impersonation Banner ─────────────────────────────────
    // impersonatedBy อยู่ใน session object (ไม่ใช่ user)
    const isImpersonating = !!(session?.session as { impersonatedBy?: string } | undefined)?.impersonatedBy

    // ══════════════════════════════════════════════════════════
    // RENDER
    // ══════════════════════════════════════════════════════════
    return (
        <div className="space-y-6">
            {/* Impersonation Banner */}
            {isImpersonating && (
                <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-900/20">
                    <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-300">
                        <UserX className="h-4 w-4" />
                        <span>
                            กำลังเข้าใช้งานในนามผู้ใช้คนอื่น (Impersonating)
                        </span>
                    </div>
                    <button
                        onClick={handleStopImpersonating}
                        className="rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700 transition-colors cursor-pointer"
                    >
                        หยุด Impersonate
                    </button>
                </div>
            )}

            {/* Success Message */}
            {actionSuccess && (
                <div className="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-700 dark:bg-green-900/20 dark:text-green-300">
                    ✅ {actionSuccess}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <Users className="h-6 w-6" />
                        จัดการผู้ใช้
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        ทั้งหมด {totalUsers} คน
                    </p>
                </div>
                <button
                    onClick={() => openModal("create")}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 transition-colors cursor-pointer"
                >
                    <Plus className="h-4 w-4" />
                    สร้างผู้ใช้ใหม่
                </button>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                    type="text"
                    placeholder="ค้นหาด้วยอีเมล..."
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value)
                        setPage(1)
                    }}
                    className="h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/50">
                                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                                    ผู้ใช้
                                </th>
                                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                                    Role
                                </th>
                                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                                    สถานะ
                                </th>
                                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                                    สมัครเมื่อ
                                </th>
                                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                                    จัดการ
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="px-4 py-12 text-center text-muted-foreground"
                                    >
                                        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="px-4 py-12 text-center text-muted-foreground"
                                    >
                                        ไม่พบผู้ใช้
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr
                                        key={user.id}
                                        className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                                    >
                                        {/* User info */}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                {user.image ? (
                                                    <img
                                                        src={user.image}
                                                        alt={user.name}
                                                        className="h-8 w-8 rounded-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-purple-500 to-indigo-600 text-xs font-bold text-white">
                                                        {user.name
                                                            ?.split(" ")
                                                            .map((w) => w[0])
                                                            .join("")
                                                            .toUpperCase()
                                                            .slice(0, 2) || "?"}
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="font-medium text-foreground">
                                                        {user.name}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {user.email}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Role */}
                                        <td className="px-4 py-3">
                                            <RoleBadge role={user.role} />
                                        </td>

                                        {/* Status */}
                                        <td className="px-4 py-3">
                                            {user.banned ? (
                                                <div>
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                                        <Ban className="h-3 w-3" />
                                                        Banned
                                                    </span>
                                                    {user.banExpires && (
                                                        <p className="mt-1 text-[10px] text-muted-foreground">
                                                            หมดเวลา: {new Date(user.banExpires).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
                                                        </p>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                    <UserCheck className="h-3 w-3" />
                                                    Active
                                                </span>
                                            )}
                                        </td>

                                        {/* Created  */}
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {new Date(
                                                user.createdAt
                                            ).toLocaleDateString("th-TH", {
                                                year: "numeric",
                                                month: "short",
                                                day: "numeric",
                                            })}
                                        </td>

                                        {/* Actions dropdown */}
                                        <td className="px-4 py-3 text-right">
                                            <div className="relative inline-block">
                                                <button
                                                    ref={(el) => { btnRefs.current[user.id] = el }}
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        if (openDropdown === user.id) {
                                                            setOpenDropdown(null)
                                                        } else {
                                                            const rect = btnRefs.current[user.id]?.getBoundingClientRect()
                                                            if (rect) {
                                                                setDropdownPos({
                                                                    top: rect.bottom + 4,
                                                                    left: rect.right - 192, // w-48 = 12rem = 192px
                                                                })
                                                            }
                                                            setOpenDropdown(user.id)
                                                        }
                                                    }}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                                                >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-border px-4 py-3">
                        <p className="text-xs text-muted-foreground">
                            หน้า {page} จาก {totalPages}
                        </p>
                        <div className="flex gap-1">
                            <button
                                disabled={page <= 1}
                                onClick={() => setPage(page - 1)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input text-muted-foreground hover:bg-accent disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                                disabled={page >= totalPages}
                                onClick={() => setPage(page + 1)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input text-muted-foreground hover:bg-accent disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Actions Dropdown (rendered outside table to avoid overflow clipping) */}
            {openDropdown && (() => {
                const user = users.find((u) => u.id === openDropdown)
                if (!user) return null
                return (
                    <>
                        {/* Invisible backdrop — click to close */}
                        <div
                            className="fixed inset-0 z-40"
                            onClick={() => setOpenDropdown(null)}
                        />
                        <div
                            className="fixed z-50 w-48 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1 text-left shadow-lg"
                            style={{ top: dropdownPos.top, left: dropdownPos.left }}
                        >
                                                        <DropdownItem
                                                            icon={Pencil}
                                                            label="แก้ไขข้อมูล"
                                                            onClick={() => {
                                                                setOpenDropdown(
                                                                    null
                                                                )
                                                                openModal(
                                                                    "editUser",
                                                                    user
                                                                )
                                                            }}
                                                        />
                                                        <DropdownItem
                                                            icon={Shield}
                                                            label="เปลี่ยน Role"
                                                            onClick={() => {
                                                                setOpenDropdown(
                                                                    null
                                                                )
                                                                openModal(
                                                                    "setRole",
                                                                    user
                                                                )
                                                            }}
                                                        />
                                                        <DropdownItem
                                                            icon={Key}
                                                            label="เปลี่ยนรหัสผ่าน"
                                                            onClick={() => {
                                                                setOpenDropdown(
                                                                    null
                                                                )
                                                                openModal(
                                                                    "setPassword",
                                                                    user
                                                                )
                                                            }}
                                                        />
                                                        {user.banned ? (
                                                            <DropdownItem
                                                                icon={UserCheck}
                                                                label="ปลดแบน"
                                                                onClick={() => {
                                                                    setOpenDropdown(
                                                                        null
                                                                    )
                                                                    handleUnbanUser(
                                                                        user
                                                                    )
                                                                }}
                                                            />
                                                        ) : (
                                                            <DropdownItem
                                                                icon={Ban}
                                                                label="แบนผู้ใช้"
                                                                className="text-amber-600 dark:text-amber-400"
                                                                onClick={() => {
                                                                    setOpenDropdown(
                                                                        null
                                                                    )
                                                                    openModal(
                                                                        "ban",
                                                                        user
                                                                    )
                                                                }}
                                                            />
                                                        )}
                                                        <DropdownItem
                                                            icon={UserX}
                                                            label="Impersonate"
                                                            onClick={() => {
                                                                setOpenDropdown(
                                                                    null
                                                                )
                                                                handleImpersonate(
                                                                    user
                                                                )
                                                            }}
                                                        />
                                                        <div className="my-1 border-t border-border" />
                                                        <DropdownItem
                                                            icon={Trash2}
                                                            label="ลบผู้ใช้"
                                                            className="text-red-600 dark:text-red-400"
                                                            onClick={() => {
                                                                setOpenDropdown(
                                                                    null
                                                                )
                                                                openModal(
                                                                    "delete",
                                                                    user
                                                                )
                                                            }}
                                                        />
                        </div>
                    </>
                )
            })()}

            {/* ═══════ MODALS ═══════ */}

            {/* Create User Modal */}
            {modal === "create" && (
                <Modal title="สร้างผู้ใช้ใหม่" onClose={closeModal}>
                    <div className="space-y-4">
                        <FormField
                            label="ชื่อ"
                            value={formName}
                            onChange={setFormName}
                            placeholder="ชื่อผู้ใช้"
                        />
                        <FormField
                            label="อีเมล"
                            type="email"
                            value={formEmail}
                            onChange={setFormEmail}
                            placeholder="email@example.com"
                        />
                        <FormField
                            label="รหัสผ่าน"
                            type="password"
                            value={formPassword}
                            onChange={setFormPassword}
                            placeholder="อย่างน้อย 8 ตัวอักษร"
                        />
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-foreground">
                                Role (เลือกได้หลาย role)
                            </label>
                            <RoleCheckboxes />
                        </div>
                        {actionError && <ErrorMsg msg={actionError} />}
                        <ModalActions
                            loading={actionLoading}
                            confirmLabel="สร้างผู้ใช้"
                            onCancel={closeModal}
                            onConfirm={handleCreateUser}
                        />
                    </div>
                </Modal>
            )}

            {/* Edit User Modal */}
            {modal === "editUser" && selectedUser && (
                <Modal
                    title={`แก้ไขข้อมูล — ${selectedUser.name}`}
                    onClose={closeModal}
                >
                    <div className="space-y-4">
                        <div className="text-sm text-muted-foreground">
                            อีเมล: <strong>{selectedUser.email}</strong>
                        </div>
                        <FormField
                            label="ชื่อ"
                            value={formName}
                            onChange={setFormName}
                            placeholder="ชื่อผู้ใช้"
                        />
                        {actionError && <ErrorMsg msg={actionError} />}
                        <ModalActions
                            loading={actionLoading}
                            confirmLabel="บันทึก"
                            onCancel={closeModal}
                            onConfirm={handleUpdateUser}
                        />
                    </div>
                </Modal>
            )}

            {/* Set Role Modal */}
            {modal === "setRole" && selectedUser && (
                <Modal
                    title={`เปลี่ยน Role — ${selectedUser.name}`}
                    onClose={closeModal}
                >
                    <div className="space-y-4">
                        <div className="text-sm text-muted-foreground">
                            Role ปัจจุบัน:{" "}
                            <RoleBadge role={selectedUser.role} />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-foreground">
                                Role (เลือกได้หลาย role)
                            </label>
                            <RoleCheckboxes />
                        </div>
                        {actionError && <ErrorMsg msg={actionError} />}
                        <ModalActions
                            loading={actionLoading}
                            confirmLabel="บันทึก"
                            onCancel={closeModal}
                            onConfirm={handleSetRole}
                        />
                    </div>
                </Modal>
            )}

            {/* Ban User Modal */}
            {modal === "ban" && selectedUser && (
                <Modal
                    title={`แบนผู้ใช้ — ${selectedUser.name}`}
                    onClose={closeModal}
                >
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            ผู้ใช้ที่ถูกแบนจะไม่สามารถเข้าสู่ระบบได้
                        </p>
                        <FormField
                            label="เหตุผล (ไม่บังคับ)"
                            value={formBanReason}
                            onChange={setFormBanReason}
                            placeholder="เช่น Spam, ละเมิดกฎ"
                        />
                        <div>
                            <label className="block text-sm font-medium mb-1.5 text-foreground">
                                ระยะเวลาแบน
                            </label>
                            <select
                                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option]:bg-white [&>option]:dark:bg-gray-900 [&>option]:text-gray-900 [&>option]:dark:text-gray-100"
                                value={formBanDuration}
                                onChange={(e) => setFormBanDuration(Number(e.target.value))}
                            >
                                <option value={0}>ถาวร (ไม่มีกำหนด)</option>
                                <option value={3600}>1 ชั่วโมง</option>
                                <option value={86400}>1 วัน</option>
                                <option value={259200}>3 วัน</option>
                                <option value={604800}>7 วัน</option>
                                <option value={2592000}>30 วัน</option>
                                <option value={7776000}>90 วัน</option>
                            </select>
                        </div>
                        {actionError && <ErrorMsg msg={actionError} />}
                        <ModalActions
                            loading={actionLoading}
                            confirmLabel="แบนผู้ใช้"
                            variant="destructive"
                            onCancel={closeModal}
                            onConfirm={handleBanUser}
                        />
                    </div>
                </Modal>
            )}

            {/* Set Password Modal */}
            {modal === "setPassword" && selectedUser && (
                <Modal
                    title={`เปลี่ยนรหัสผ่าน — ${selectedUser.name}`}
                    onClose={closeModal}
                >
                    <div className="space-y-4">
                        <FormField
                            label="รหัสผ่านใหม่"
                            type="password"
                            value={formPassword}
                            onChange={setFormPassword}
                            placeholder="อย่างน้อย 8 ตัวอักษร"
                        />
                        {actionError && <ErrorMsg msg={actionError} />}
                        <ModalActions
                            loading={actionLoading}
                            confirmLabel="เปลี่ยนรหัสผ่าน"
                            onCancel={closeModal}
                            onConfirm={handleSetPassword}
                        />
                    </div>
                </Modal>
            )}

            {/* Delete User Modal */}
            {modal === "delete" && selectedUser && (
                <Modal
                    title={`ลบผู้ใช้ — ${selectedUser.name}`}
                    onClose={closeModal}
                >
                    <div className="space-y-4">
                        <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
                            <p className="text-sm text-red-700 dark:text-red-400">
                                ⚠️ การลบผู้ใช้จะไม่สามารถกู้คืนได้
                                ข้อมูลทั้งหมดของผู้ใช้นี้จะถูกลบถาวร
                            </p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            คุณแน่ใจหรือไม่ที่จะลบ{" "}
                            <strong>{selectedUser.email}</strong>?
                        </p>
                        {actionError && <ErrorMsg msg={actionError} />}
                        <ModalActions
                            loading={actionLoading}
                            confirmLabel="ลบผู้ใช้"
                            variant="destructive"
                            onCancel={closeModal}
                            onConfirm={handleDeleteUser}
                        />
                    </div>
                </Modal>
            )}
        </div>
    )
}

// ============================================================
// Sub-components
// ============================================================

function DropdownItem({
    icon: Icon,
    label,
    onClick,
    className,
}: {
    icon: React.ComponentType<{ className?: string }>
    label: string
    onClick: () => void
    className?: string
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer",
                className
            )}
        >
            <Icon className="h-4 w-4" />
            {label}
        </button>
    )
}

function Modal({
    title,
    onClose,
    children,
}: {
    title: string
    onClose: () => void
    children: React.ReactNode
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
                className="absolute inset-0 bg-black/50"
                onClick={onClose}
            />
            <div className="relative w-full max-w-md rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-6 shadow-2xl mx-4">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {title}
                    </h3>
                    <button
                        onClick={onClose}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                {children}
            </div>
        </div>
    )
}

function FormField({
    label,
    type = "text",
    value,
    onChange,
    placeholder,
}: {
    label: string
    type?: string
    value: string
    onChange: (v: string) => void
    placeholder?: string
}) {
    return (
        <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {label}
            </label>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="h-9 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 text-sm shadow-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
        </div>
    )
}

function ErrorMsg({ msg }: { msg: string }) {
    return (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            {msg}
        </div>
    )
}

function ModalActions({
    loading,
    confirmLabel,
    variant = "default",
    onCancel,
    onConfirm,
}: {
    loading: boolean
    confirmLabel: string
    variant?: "default" | "destructive"
    onCancel: () => void
    onConfirm: () => void
}) {
    return (
        <div className="flex justify-end gap-2 pt-2">
            <button
                onClick={onCancel}
                disabled={loading}
                className="h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 text-sm font-medium shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors cursor-pointer disabled:opacity-50"
            >
                ยกเลิก
            </button>
            <button
                onClick={onConfirm}
                disabled={loading}
                className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-medium text-white shadow transition-colors cursor-pointer disabled:opacity-50",
                    variant === "destructive"
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-blue-600 hover:bg-blue-700"
                )}
            >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {confirmLabel}
            </button>
        </div>
    )
}