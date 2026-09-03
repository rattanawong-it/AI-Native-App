"use client"

// หน้าทีมงานของศูนย์ไอที — สร้าง/แก้ไขทีม, เพิ่ม-ถอดสมาชิก, ตั้งหัวหน้าทีม
// อ้างอิง F5.11 (CRUD Team + TeamMember)
//
// [M7] เดิมไฟล์นี้เป็น mock `SAMPLE_TEAMS` — เขียนใหม่ให้เรียก API จริงในเฟส 5
// โครงหน้าเดิม (การ์ดสรุป → ค้นหา → รายการทีมแบบกางดูสมาชิกได้) ยังคงไว้
//
// ทีมชุดนี้คือทีมเดียวกับที่ Ticket, หมวดหมู่บริการ และโครงการอ้างถึง ไม่ใช่ตารางแยก
// การลบจึงถูกกันไว้เมื่อมีใครอ้างถึงอยู่ — ให้ปิดใช้งานแทน

import { rolesAreManager } from "@/lib/roles"
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
    Plus,
    Search,
    Users,
    UserPlus,
    UserCheck,
    Briefcase,
    Loader2,
    Pencil,
    Trash2,
    ChevronDown,
    ChevronRight,
    Crown,
    X,
    FolderKanban,
} from "lucide-react"
import { toast } from "sonner"
import { useSession } from "@/lib/auth-client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { PersonChip } from "@/components/ticket/ticket-badges"
import { TeamRoleBadge } from "@/components/project/project-badges"
import { TEAM_ROLES, TEAM_ROLE_LABEL, type TeamRole } from "@/lib/task-board"
import { formatThaiDate, readError, type Person } from "@/lib/ticket-types"
import type { TeamListResponse, TeamRow } from "@/lib/project-types"

const STATE_TABS = [
    { key: "active", label: "เปิดใช้งาน" },
    { key: "inactive", label: "ปิดใช้งาน" },
    { key: "all", label: "ทั้งหมด" },
] as const

interface TeamFormState {
    id?: string
    name: string
    description: string
    leaderId: string
    active: boolean
}

const EMPTY_TEAM: TeamFormState = { name: "", description: "", leaderId: "", active: true }

export default function TeamContent() {
    const { data: session } = useSession()
    const roles = useMemo(
        () => ((session?.user as { role?: string })?.role || "user").split(",").map((r) => r.trim()),
        [session]
    )
    const canManage = rolesAreManager(roles)

    const [teams, setTeams] = useState<TeamRow[]>([])
    const [agents, setAgents] = useState<Person[]>([])
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState(false)

    const [search, setSearch] = useState("")
    const [debouncedSearch, setDebouncedSearch] = useState("")
    const [state, setState] = useState<(typeof STATE_TABS)[number]["key"]>("active")
    const [expanded, setExpanded] = useState<string | null>(null)

    const [teamForm, setTeamForm] = useState<TeamFormState | null>(null)
    const [deleting, setDeleting] = useState<TeamRow | null>(null)
    const [memberTarget, setMemberTarget] = useState<TeamRow | null>(null)
    const [memberForm, setMemberForm] = useState<{ userId: string; roleInTeam: TeamRole }>({
        userId: "",
        roleInTeam: "member",
    })

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 350)
        return () => clearTimeout(timer)
    }, [search])

    const fetchTeams = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({ state })
            if (debouncedSearch) params.set("q", debouncedSearch)
            const res = await fetch(`/api/teams?${params.toString()}`)
            if (!res.ok) {
                toast.error(await readError(res, "ไม่สามารถโหลดรายชื่อทีมได้"))
                return
            }
            const data = (await res.json()) as TeamListResponse
            setTeams(data.teams)
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setLoading(false)
        }
    }, [state, debouncedSearch])

    useEffect(() => {
        void fetchTeams()
    }, [fetchTeams])

    useEffect(() => {
        void (async () => {
            const res = await fetch("/api/directory?scope=agents")
            if (res.ok) {
                const data = (await res.json()) as { agents: Person[] }
                setAgents(data.agents)
            }
        })()
    }, [])

    // ── สรุปตัวเลขด้านบน ──
    const stats = useMemo(() => {
        const members = new Set<string>()
        let projects = 0
        for (const t of teams) {
            projects += t._count.projects
            for (const m of t.members) members.add(m.userId)
        }
        return {
            teams: teams.length,
            active: teams.filter((t) => t.active).length,
            members: members.size,
            projects,
        }
    }, [teams])

    /// แทนที่ทีมหนึ่งใบด้วยข้อมูลใหม่จาก API — ทุกเส้นของสมาชิกคืนทีมทั้งใบกลับมาให้แล้ว
    const replaceTeam = (updated: TeamRow) => {
        setTeams((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    }

    const saveTeam = async () => {
        if (!teamForm) return
        setBusy(true)
        try {
            const payload = {
                name: teamForm.name,
                description: teamForm.description.trim() || null,
                leaderId: teamForm.leaderId || null,
                active: teamForm.active,
            }
            const res = await fetch(teamForm.id ? `/api/teams/${teamForm.id}` : "/api/teams", {
                method: teamForm.id ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
            if (!res.ok) {
                toast.error(await readError(res, "บันทึกทีมไม่สำเร็จ"))
                return
            }
            toast.success(teamForm.id ? "บันทึกการแก้ไขแล้ว" : "สร้างทีมเรียบร้อย")
            setTeamForm(null)
            await fetchTeams()
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setBusy(false)
        }
    }

    const removeTeam = async () => {
        if (!deleting) return
        setBusy(true)
        try {
            const res = await fetch(`/api/teams/${deleting.id}`, { method: "DELETE" })
            if (!res.ok) {
                toast.error(await readError(res, "ลบทีมไม่สำเร็จ"))
                return
            }
            toast.success("ลบทีมแล้ว")
            setDeleting(null)
            await fetchTeams()
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setBusy(false)
        }
    }

    const addMember = async () => {
        if (!memberTarget || !memberForm.userId) return
        setBusy(true)
        try {
            const res = await fetch(`/api/teams/${memberTarget.id}/members`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(memberForm),
            })
            if (!res.ok) {
                toast.error(await readError(res, "เพิ่มสมาชิกไม่สำเร็จ"))
                return
            }
            const data = (await res.json()) as { team: TeamRow }
            replaceTeam(data.team)
            toast.success("เพิ่มสมาชิกเรียบร้อย")
            setMemberTarget(null)
            setMemberForm({ userId: "", roleInTeam: "member" })
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setBusy(false)
        }
    }

    const changeMemberRole = async (team: TeamRow, userId: string, roleInTeam: TeamRole) => {
        setBusy(true)
        try {
            const res = await fetch(`/api/teams/${team.id}/members/${userId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ roleInTeam }),
            })
            if (!res.ok) {
                toast.error(await readError(res, "เปลี่ยนบทบาทไม่สำเร็จ"))
                return
            }
            const data = (await res.json()) as { team: TeamRow }
            replaceTeam(data.team)
            toast.success(`เปลี่ยนเป็น${TEAM_ROLE_LABEL[roleInTeam]}แล้ว`)
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setBusy(false)
        }
    }

    const removeMember = async (team: TeamRow, userId: string) => {
        setBusy(true)
        try {
            const res = await fetch(`/api/teams/${team.id}/members/${userId}`, {
                method: "DELETE",
            })
            if (!res.ok) {
                toast.error(await readError(res, "ถอดสมาชิกไม่สำเร็จ"))
                return
            }
            const data = (await res.json()) as { team: TeamRow }
            replaceTeam(data.team)
            toast.success("ถอดสมาชิกออกจากทีมแล้ว")
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* หัวข้อหน้า */}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">ทีมงาน</h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        จัดการทีมของศูนย์ไอทีและสมาชิกในแต่ละทีม — ทีมเดียวกันนี้ใช้มอบหมาย Ticket
                        และผูกกับโครงการพัฒนา
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" asChild>
                        <Link href="/management/projects">
                            <FolderKanban className="size-4" />
                            โครงการพัฒนา
                        </Link>
                    </Button>
                    {canManage && (
                        <Button onClick={() => setTeamForm({ ...EMPTY_TEAM })}>
                            <Plus className="size-4" />
                            สร้างทีม
                        </Button>
                    )}
                </div>
            </div>

            {/* การ์ดสรุป */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    icon={<Users className="size-5" />}
                    label="ทีมที่แสดง"
                    value={stats.teams}
                    tone="bg-brand-tint text-brand"
                />
                <StatCard
                    icon={<UserCheck className="size-5" />}
                    label="ทีมที่เปิดใช้งาน"
                    value={stats.active}
                    tone="bg-status-resolved-bg text-status-resolved-fg"
                />
                <StatCard
                    icon={<UserPlus className="size-5" />}
                    label="สมาชิกทั้งหมด (ไม่นับซ้ำ)"
                    value={stats.members}
                    tone="bg-status-assigned-bg text-status-assigned-fg"
                />
                <StatCard
                    icon={<Briefcase className="size-5" />}
                    label="โครงการที่ดูแล"
                    value={stats.projects}
                    tone="bg-status-progress-bg text-status-progress-fg"
                />
            </div>

            {/* ค้นหา + ตัวกรอง */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-[240px] flex-1">
                    <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="ค้นหาชื่อทีมหรือรายละเอียด..."
                        className="pl-9"
                    />
                </div>
                <div className="flex flex-wrap gap-2">
                    {STATE_TABS.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setState(t.key)}
                            className={
                                state === t.key
                                    ? "bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium"
                                    : "border-input hover:bg-accent rounded-md border px-3 py-1.5 text-sm"
                            }
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* รายการทีม */}
            {loading ? (
                <div className="grid gap-4 lg:grid-cols-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-40 w-full" />
                    ))}
                </div>
            ) : teams.length === 0 ? (
                <Card>
                    <CardContent className="text-muted-foreground py-16 text-center text-sm">
                        <Users className="mx-auto mb-3 size-8 opacity-40" />
                        ยังไม่มีทีมตามเงื่อนไขที่เลือก
                    </CardContent>
                </Card>
            ) : (
                <div className="grid items-start gap-4 lg:grid-cols-2">
                    {teams.map((team) => {
                        const open = expanded === team.id
                        return (
                            <Card key={team.id}>
                                <CardContent className="space-y-4">
                                    <div className="flex items-start justify-between gap-2">
                                        <button
                                            onClick={() => setExpanded(open ? null : team.id)}
                                            className="flex min-w-0 flex-1 items-start gap-2 text-left"
                                        >
                                            {open ? (
                                                <ChevronDown className="text-muted-foreground mt-1 size-4 shrink-0" />
                                            ) : (
                                                <ChevronRight className="text-muted-foreground mt-1 size-4 shrink-0" />
                                            )}
                                            <span className="min-w-0">
                                                <span className="flex flex-wrap items-center gap-2">
                                                    <span className="text-base font-semibold">
                                                        {team.name}
                                                    </span>
                                                    {!team.active && (
                                                        <span className="bg-status-closed-bg text-status-closed-fg rounded-full px-2.5 py-1 text-xs font-medium">
                                                            ปิดใช้งาน
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="text-muted-foreground mt-0.5 block text-sm">
                                                    {team.description || "ยังไม่มีคำอธิบายทีม"}
                                                </span>
                                            </span>
                                        </button>
                                        {canManage && (
                                            <div className="flex shrink-0 gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() =>
                                                        setTeamForm({
                                                            id: team.id,
                                                            name: team.name,
                                                            description: team.description ?? "",
                                                            leaderId: team.leaderId ?? "",
                                                            active: team.active,
                                                        })
                                                    }
                                                >
                                                    <Pencil className="size-4" />
                                                    <span className="sr-only">แก้ไขทีม</span>
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setDeleting(team)}
                                                >
                                                    <Trash2 className="text-priority-critical size-4" />
                                                    <span className="sr-only">ลบทีม</span>
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                                        <span className="inline-flex items-center gap-1.5">
                                            <Users className="size-4" />
                                            {team._count.members} สมาชิก
                                        </span>
                                        <span className="inline-flex items-center gap-1.5">
                                            <Briefcase className="size-4" />
                                            {team._count.projects} โครงการ
                                        </span>
                                        <span className="inline-flex items-center gap-1.5">
                                            <FolderKanban className="size-4" />
                                            {team._count.tickets} Ticket
                                        </span>
                                    </div>

                                    <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                                        <span className="flex items-center gap-2">
                                            <Crown className="text-priority-medium size-4" />
                                            {team.leader ? (
                                                <PersonChip person={team.leader} size={24} />
                                            ) : (
                                                <span className="text-muted-foreground text-sm">
                                                    ยังไม่มีหัวหน้าทีม
                                                </span>
                                            )}
                                        </span>
                                        {canManage && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setMemberTarget(team)
                                                    setMemberForm({
                                                        userId: "",
                                                        roleInTeam: "member",
                                                    })
                                                }}
                                            >
                                                <UserPlus className="size-4" />
                                                เพิ่มสมาชิก
                                            </Button>
                                        )}
                                    </div>

                                    {/* รายชื่อสมาชิก — กางเมื่อกดที่หัวการ์ด */}
                                    {open && (
                                        <ul className="space-y-2 border-t pt-3">
                                            {team.members.length === 0 && (
                                                <li className="text-muted-foreground text-sm">
                                                    ยังไม่มีสมาชิกในทีมนี้
                                                </li>
                                            )}
                                            {team.members.map((m) => (
                                                <li
                                                    key={m.id}
                                                    className="flex flex-wrap items-center justify-between gap-2"
                                                >
                                                    <span className="flex min-w-0 items-center gap-2">
                                                        <PersonChip person={m.user} size={28} />
                                                        {m.user.position && (
                                                            <span className="text-muted-foreground truncate text-xs">
                                                                {m.user.position}
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="flex shrink-0 items-center gap-2">
                                                        <TeamRoleBadge role={m.roleInTeam} />
                                                        <span className="text-muted-foreground text-xs">
                                                            เข้าร่วม {formatThaiDate(m.joinedAt)}
                                                        </span>
                                                        {canManage && (
                                                            <>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    disabled={busy}
                                                                    onClick={() =>
                                                                        void changeMemberRole(
                                                                            team,
                                                                            m.userId,
                                                                            m.roleInTeam === "leader"
                                                                                ? "member"
                                                                                : "leader"
                                                                        )
                                                                    }
                                                                >
                                                                    {m.roleInTeam === "leader"
                                                                        ? "ลดเป็นสมาชิก"
                                                                        : "ตั้งเป็นหัวหน้า"}
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    disabled={busy}
                                                                    onClick={() =>
                                                                        void removeMember(
                                                                            team,
                                                                            m.userId
                                                                        )
                                                                    }
                                                                >
                                                                    <X className="size-4" />
                                                                    <span className="sr-only">
                                                                        ถอดออกจากทีม
                                                                    </span>
                                                                </Button>
                                                            </>
                                                        )}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}

            {/* ฟอร์มสร้าง/แก้ไขทีม */}
            <Dialog open={teamForm !== null} onOpenChange={(v) => !v && setTeamForm(null)}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{teamForm?.id ? "แก้ไขทีม" : "สร้างทีมใหม่"}</DialogTitle>
                        <DialogDescription>
                            ทีมนี้จะปรากฏในช่องเลือกทีมของ Ticket หมวดหมู่บริการ และโครงการพัฒนา
                        </DialogDescription>
                    </DialogHeader>

                    {teamForm && (
                        <div className="space-y-4">
                            <div>
                                <Label className="mb-1.5">ชื่อทีม</Label>
                                <Input
                                    value={teamForm.name}
                                    onChange={(e) =>
                                        setTeamForm({ ...teamForm, name: e.target.value })
                                    }
                                    placeholder="เช่น ทีมพัฒนาระบบสารสนเทศ"
                                />
                            </div>
                            <div>
                                <Label className="mb-1.5">รายละเอียด (ไม่บังคับ)</Label>
                                <Textarea
                                    value={teamForm.description}
                                    onChange={(e) =>
                                        setTeamForm({ ...teamForm, description: e.target.value })
                                    }
                                    rows={3}
                                    placeholder="ขอบเขตงานที่ทีมนี้รับผิดชอบ..."
                                />
                            </div>
                            <div>
                                <Label className="mb-1.5">หัวหน้าทีม</Label>
                                <select
                                    value={teamForm.leaderId}
                                    onChange={(e) =>
                                        setTeamForm({ ...teamForm, leaderId: e.target.value })
                                    }
                                    className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                                >
                                    <option value="">ยังไม่ระบุหัวหน้าทีม</option>
                                    {agents.map((a) => (
                                        <option key={a.id} value={a.id}>
                                            {a.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-muted-foreground mt-1.5 text-xs">
                                    หัวหน้าทีมจะถูกเพิ่มเป็นสมาชิกของทีมโดยอัตโนมัติ
                                </p>
                            </div>
                            <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5">
                                <div>
                                    <Label className="mb-0.5">เปิดใช้งาน</Label>
                                    <p className="text-muted-foreground text-xs">
                                        ทีมที่ปิดใช้งานจะไม่ขึ้นในช่องเลือกทีมของหน้าอื่น
                                    </p>
                                </div>
                                <Switch
                                    checked={teamForm.active}
                                    onCheckedChange={(v) =>
                                        setTeamForm({ ...teamForm, active: v })
                                    }
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setTeamForm(null)}>
                            ยกเลิก
                        </Button>
                        <Button
                            onClick={() => void saveTeam()}
                            disabled={busy || !teamForm || teamForm.name.trim().length < 2}
                        >
                            {busy && <Loader2 className="size-4 animate-spin" />}
                            บันทึก
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* เพิ่มสมาชิก */}
            <Dialog open={memberTarget !== null} onOpenChange={(v) => !v && setMemberTarget(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>เพิ่มสมาชิกเข้าทีม</DialogTitle>
                        <DialogDescription>
                            เลือกเจ้าหน้าที่ที่จะเข้าร่วมทีม &ldquo;{memberTarget?.name}&rdquo;
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <Label className="mb-1.5">เจ้าหน้าที่</Label>
                            <select
                                value={memberForm.userId}
                                onChange={(e) =>
                                    setMemberForm({ ...memberForm, userId: e.target.value })
                                }
                                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                            >
                                <option value="">เลือกเจ้าหน้าที่</option>
                                {agents
                                    .filter(
                                        (a) =>
                                            !memberTarget?.members.some((m) => m.userId === a.id)
                                    )
                                    .map((a) => (
                                        <option key={a.id} value={a.id}>
                                            {a.name}
                                        </option>
                                    ))}
                            </select>
                        </div>
                        <div>
                            <Label className="mb-1.5">บทบาทในทีม</Label>
                            <select
                                value={memberForm.roleInTeam}
                                onChange={(e) =>
                                    setMemberForm({
                                        ...memberForm,
                                        roleInTeam: e.target.value as TeamRole,
                                    })
                                }
                                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                            >
                                {TEAM_ROLES.map((r) => (
                                    <option key={r} value={r}>
                                        {TEAM_ROLE_LABEL[r]}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setMemberTarget(null)}>
                            ยกเลิก
                        </Button>
                        <Button onClick={() => void addMember()} disabled={busy || !memberForm.userId}>
                            {busy && <Loader2 className="size-4 animate-spin" />}
                            เพิ่มสมาชิก
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ยืนยันการลบทีม */}
            <AlertDialog open={deleting !== null} onOpenChange={(v) => !v && setDeleting(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>ลบทีมนี้?</AlertDialogTitle>
                        <AlertDialogDescription>
                            &ldquo;{deleting?.name}&rdquo; จะถูกลบพร้อมรายชื่อสมาชิก
                            หากทีมนี้ถูกอ้างถึงจาก Ticket โครงการ หรือหมวดหมู่บริการ
                            ระบบจะไม่ยอมให้ลบ — ให้ปิดใช้งานแทน
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={busy}>ยกเลิก</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void removeTeam()} disabled={busy}>
                            {busy && <Loader2 className="size-4 animate-spin" />}
                            ลบทีม
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

// ── ชิ้นส่วนย่อย ─────────────────────────────────────────────────────

function StatCard({
    icon,
    label,
    value,
    tone,
}: {
    icon: React.ReactNode
    label: string
    value: number
    tone: string
}) {
    return (
        <Card>
            <CardContent className="flex items-center gap-4">
                <div className={`flex size-10 items-center justify-center rounded-lg ${tone}`}>
                    {icon}
                </div>
                <div className="min-w-0">
                    <p className="text-muted-foreground truncate text-sm">{label}</p>
                    <p className="text-2xl font-semibold">{value}</p>
                </div>
            </CardContent>
        </Card>
    )
}
