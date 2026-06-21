export const themeStore = {
    getSnapshot: (): boolean => {
        if (typeof window === 'undefined') return false
        return document.documentElement.classList.contains('dark')
    },
    getServerSnapshot: (): boolean => false,
    subscribe: (callback: () => void): (() => void) => {
        const observer = new MutationObserver(callback)
        if (typeof window !== 'undefined') {
            observer.observe(document.documentElement, {
                attributes: true,
                attributeFilter: ['class']
            })
        }
        return () => observer.disconnect()
    },
    setTheme: (isDark: boolean): void => {
        if (isDark) {
            document.documentElement.classList.add('dark')
            localStorage.setItem('theme', 'dark')
        } else {
            document.documentElement.classList.remove('dark')
            localStorage.setItem('theme', 'light')
        }
    },
    initTheme: (): void => {
        if (typeof window === 'undefined') return
        const savedTheme = localStorage.getItem('theme')
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
            document.documentElement.classList.add('dark')
        } else {
            document.documentElement.classList.remove('dark')
        }
    }
}