"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { Bot, Brain, Shield } from "lucide-react"

interface SlideData {
    icon: React.ElementType
    title: string
    description: string
    image: string
}

const slides: SlideData[] = [
    {
        icon: Bot,
        title: "AI Chatbot",
        description:
            "Chatbot อัจฉริยะที่ตอบคำถามจากเอกสารองค์กร รองรับทั้ง Web และ LINE Messaging API",
        image:
            "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=1200&h=1600&fit=crop&q=80",
    },
    {
        icon: Brain,
        title: "RAG Knowledge Base",
        description:
            "สร้างฐานความรู้ AI ด้วย pgVector และ OpenAI Embeddings — ค้นหาข้อมูลจากความหมายได้อย่างแม่นยำ",
        image:
            "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&h=1600&fit=crop&q=80",
    },
    {
        icon: Shield,
        title: "Secure Authentication",
        description:
            "Better Auth พร้อม Social Login, MFA, RBAC — ระบบยืนยันตัวตนที่ปลอดภัยระดับ Enterprise",
        image:
            "https://images.unsplash.com/photo-1590065707046-4fde65275b2e?w=1200&h=1600&fit=crop&q=80",
    },
]

const FADE_DURATION = 500 // ms — ต้องตรงกับ duration-500 ใน Tailwind

export function AuthBranding() {
    const [activeIndex, setActiveIndex] = useState(0)
    const [contentVisible, setContentVisible] = useState(true)

    const goToSlide = useCallback((index: number) => {
        setContentVisible(false)
        setTimeout(() => {
            setActiveIndex(index)
            setContentVisible(true)
        }, FADE_DURATION)
    }, [])

    useEffect(() => {
        const interval = setInterval(() => {
            setContentVisible(false)
            setTimeout(() => {
                setActiveIndex((prev) => (prev + 1) % slides.length)
                setContentVisible(true)
            }, FADE_DURATION)
        }, 6000)
        return () => clearInterval(interval)
    }, [])

    const current = slides[activeIndex]
    const Icon = current.icon

    return (
        <div className="relative h-full w-full overflow-hidden">
            {/* Background Images — all rendered, opacity controls fade */}
            <div className="absolute inset-0">
                {slides.map((slide, index) => (
                    <div
                        key={index}
                        className={cn(
                            "absolute inset-0 transition-opacity duration-500 ease-in-out",
                            activeIndex === index ? "opacity-100" : "opacity-0"
                        )}
                    >
                        <Image
                            src={slide.image}
                            alt={slide.title}
                            fill
                            className="object-cover"
                            priority={index === 0}
                            sizes="50vw"
                        />
                    </div>
                ))}
                {/* Dark overlay gradient */}
                <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/50 to-black/30" />
            </div>

            {/* Content — fade in/out on slide change */}
            <div className="relative flex h-full flex-col justify-end p-12">
                <div
                    className={cn(
                        "space-y-6 transition-opacity duration-500 ease-in-out",
                        contentVisible ? "opacity-100" : "opacity-0"
                    )}
                >
                    {/* Feature Icon + Label */}
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm">
                            <Icon className="h-5 w-5 text-purple-300" />
                        </div>
                        <span className="text-lg font-light text-purple-300">
                            AI Native App
                        </span>
                    </div>

                    {/* Title */}
                    <h2 className="text-3xl font-bold leading-tight text-white">
                        {current.title}
                    </h2>

                    {/* Description */}
                    <p className="max-w-md text-lg leading-relaxed text-gray-300">
                        &ldquo;{current.description}&rdquo;
                    </p>

                    {/* Tech Tags */}
                    <div className="flex flex-wrap gap-2 pt-2">
                        {["Next.js 16", "Better Auth", "Prisma v7", "pgVector", "OpenAI"].map(
                            (tech) => (
                                <span
                                    key={tech}
                                    className="rounded-full bg-white/10 px-3 py-1 text-sm text-gray-300 backdrop-blur-sm"
                                >
                                    {tech}
                                </span>
                            )
                        )}
                    </div>
                </div>

                {/* Navigation Dots */}
                <div className="mt-8 flex items-center gap-2">
                    {slides.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => goToSlide(index)}
                            className={cn(
                                "h-2 rounded-full transition-all duration-300",
                                activeIndex === index
                                    ? "w-8 bg-white"
                                    : "w-2 bg-gray-500 hover:bg-gray-400"
                            )}
                            aria-label={`Go to slide ${index + 1}`}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}