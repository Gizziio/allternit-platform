import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{tsx,mdx}",
    "./index.html",
  ],
  theme: {
  	extend: {
  		fontFamily: {
  			sans: ['var(--font-sans)'],
  			serif: ['var(--font-serif)'],
  			mono: ['var(--font-mono)'],
			ui: ['var(--font-ui)'],
			research: ['var(--font-research)'],
			code: ['var(--font-code)'],
  		},
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			},
  			// Composer / dropdown surface tokens (theme.css). Classes like
  			// bg-menu-bg and bg-input-bg were previously undefined, which left
  			// the composer and every menu opened from it transparent.
  			'menu-bg': 'var(--shell-menu-bg)',
  			'menu-border': 'var(--shell-menu-border)',
  			'input-bg': 'var(--chat-composer-bg)',
  			'input-border': 'var(--chat-composer-border)',
  			'composer-glass-bg': 'var(--chat-composer-glass-bg)',
  			'composer-glass-border': 'var(--chat-composer-glass-border)',
  			'composer-bg': 'var(--chat-composer-bg)',
  			'composer-border': 'var(--chat-composer-border)',
  			'composer-soft': 'var(--chat-composer-soft)',
  			'composer-hover': 'var(--chat-composer-hover)',
  			hover: 'var(--surface-hover)'
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		keyframes: {
  			// Composer deck trays sliding out from behind the input-bar card
  			'deck-rise': {
  				from: { transform: 'translateY(44px)' },
  				to: { transform: 'translateY(0)' }
  			},
  			'deck-fall': {
  				from: { transform: 'translateY(-44px)' },
  				to: { transform: 'translateY(0)' }
  			},
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'deck-rise': 'deck-rise 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
  			'deck-fall': 'deck-fall 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
