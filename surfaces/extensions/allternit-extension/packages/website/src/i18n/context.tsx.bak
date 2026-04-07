import { ReactNode, createContext, useContext, useState } from 'react'

type Lang = 'en-US' | 'zh-CN'

const LanguageContext = createContext<{
	language: Lang
	isZh: boolean
	setLanguage: (lang: Lang) => void
} | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
	const [language, setLang] = useState<Lang>(() => {
		const stored = localStorage.getItem('language') as Lang
		if (stored === 'zh-CN' || stored === 'en-US') return stored
		return navigator.language.startsWith('zh') ? 'zh-CN' : 'en-US'
	})

	const setLanguage = (lang: Lang) => {
		setLang(lang)
		localStorage.setItem('language', lang)
	}

	return (
		<LanguageContext.Provider value={{ language, isZh: language === 'zh-CN', setLanguage }}>
			{children}
		</LanguageContext.Provider>
	)
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage() {
	const ctx = useContext(LanguageContext)
	if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
	return ctx
}
