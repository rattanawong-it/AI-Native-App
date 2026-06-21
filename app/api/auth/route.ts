// จับทุก request: /api/auth/signin, /api/auth/callback/google, etc.
import { auth } from "@/lib/auth"
import { toNextJsHandler } from "better-auth/next-js"

export const { POST, GET } = toNextJsHandler(auth)