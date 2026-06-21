import { Metadata } from "next"
import Navbar from "@/app/(landing)/Navbar"
import Hero from "@/app/(landing)/Hero"
import Features from "@/app/(landing)/Features"
import About from "@/app/(landing)/About"
import TechStack from "@/app/(landing)/TechStack"
import Team from "@/app/(landing)/Team"
import Testimonial from "@/app/(landing)/Testimonial"
import Footer from "@/app/(landing)/Footer"
import LeadForm from "@/app/(landing)/LeadForm"
import ChatButton from "@/components/chat/ChatButton"
import ContactForm from "@/app/(landing)/ContactForm"
export const metadata: Metadata = {
  title: "AI Native App",
  description:
    "AI-Native Application ครบวงจร — Authentication, RAG Chatbot, Knowledge Base, LINE Integration และ Production Deployment ด้วย Next.js 16, Better Auth, Prisma v7 และ OpenAI",
  keywords: [
    "AI Native App",
    "Next.js 16",
    "Better Auth",
    "RAG Chatbot",
    "Knowledge Base",
    "LINE Integration",
    "Prisma v7",
    "pgVector",
    "OpenAI",
    "AI Application",
  ],
}

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <Features />
      <About />
      <TechStack />
      <Team />
      <Testimonial />
      <LeadForm />
      <ContactForm/>
      <Footer />
      <ChatButton />
    </div>
  )
}