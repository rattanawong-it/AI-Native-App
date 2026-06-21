import type { Metadata } from "next"
import { Inter, Anuphan } from "next/font/google"
import "./globals.css"

const inter = Inter({
    variable: "--font-inter",
    subsets: ["latin"],
})

const anuphan = Anuphan({
    variable: "--font-anuphan",
    subsets: ["thai", "latin"],
})

export const metadata: Metadata = {
    title: {
      default: "AI Native App",
      template: "%s | AI Native App",
    },
    description: "AI-Native Application with Next.js 16 & Better Auth",
    keywords: ["Next.js", "AI", "Authentication", "Better Auth", "RAG"],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
          <script
              dangerouslySetInnerHTML={{
                  __html: `
                      (function() {
                          try {
                              var t = localStorage.getItem('theme');
                              if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                                  document.documentElement.classList.add('dark');
                              }
                          } catch(e) {}
                      })();
                  `,
              }}
          />
      </head>
      <body className={`${inter.variable} ${anuphan.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}