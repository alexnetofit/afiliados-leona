import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        // Primary - Purple (slightly desaturated for enterprise feel)
        primary: {
          50: '#F9F7FF',
          100: '#F1EEFF',
          200: '#E4DBFF',
          300: '#CEBDFC',
          400: '#B196F7',
          500: '#9771ED',
          600: '#7C4DDB',
          700: '#6940C7',
          800: '#5835A3',
          900: '#492D85',
          DEFAULT: '#7C4DDB',
        },
        // Neutral - Zinc palette
        zinc: {
          50: '#FAFAFA',
          100: '#F4F4F5',
          200: '#E4E4E7',
          300: '#D4D4D8',
          400: '#A1A1AA',
          500: '#71717A',
          600: '#52525B',
          700: '#3F3F46',
          800: '#27272A',
          900: '#18181B',
          950: '#09090B',
        },
        // Status colors
        success: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          300: '#86EFAC',
          400: '#4ADE80',
          500: '#22C55E',
          600: '#16A34A',
          DEFAULT: '#22C55E',
        },
        warning: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          DEFAULT: '#F59E0B',
        },
        error: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          300: '#FCA5A5',
          400: '#F87171',
          500: '#EF4444',
          600: '#DC2626',
          DEFAULT: '#EF4444',
        },
        info: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          DEFAULT: '#3B82F6',
        },
      },
      // Reduced border radius (40-60% reduction)
      borderRadius: {
        'xs': '2px',
        'sm': '3px',
        'md': '4px',
        'lg': '6px',
        'xl': '8px',
        '2xl': '10px',
        '3xl': '12px',
      },
      // Subtler shadows - less glow, more elevation
      boxShadow: {
        'xs': '0 1px 2px rgba(0, 0, 0, 0.04)',
        'sm': '0 1px 2px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04)',
        'md': '0 2px 4px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)',
        'lg': '0 4px 8px rgba(0, 0, 0, 0.04), 0 2px 4px rgba(0, 0, 0, 0.06)',
        'xl': '0 8px 16px rgba(0, 0, 0, 0.06), 0 2px 4px rgba(0, 0, 0, 0.04)',
        '2xl': '0 12px 24px rgba(0, 0, 0, 0.08)',
        'inner': 'inset 0 1px 2px rgba(0, 0, 0, 0.04)',
        // Subtle colored shadows (reduced opacity)
        'primary': '0 1px 3px rgba(124, 77, 219, 0.12)',
        'primary-lg': '0 2px 6px rgba(124, 77, 219, 0.16)',
        'success': '0 1px 3px rgba(34, 197, 94, 0.12)',
        'error': '0 1px 3px rgba(239, 68, 68, 0.12)',
        'card': '0 1px 2px rgba(0, 0, 0, 0.04)',
        'card-hover': '0 2px 8px rgba(0, 0, 0, 0.06)',
      },
      // Tighter typography scale
      fontSize: {
        'xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.01em' }],
        'sm': ['0.8125rem', { lineHeight: '1.25rem', letterSpacing: '0' }],
        'base': ['0.875rem', { lineHeight: '1.375rem', letterSpacing: '-0.006em' }],
        'lg': ['1rem', { lineHeight: '1.5rem', letterSpacing: '-0.011em' }],
        'xl': ['1.125rem', { lineHeight: '1.625rem', letterSpacing: '-0.014em' }],
        '2xl': ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.017em' }],
        '3xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.019em' }],
        '4xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.021em' }],
        '5xl': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.022em' }],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '30': '7.5rem',
      },
      animation: {
        'fade-in': 'fadeIn 150ms ease-out',
        'fade-in-up': 'fadeInUp 200ms ease-out',
        'fade-in-down': 'fadeInDown 200ms ease-out',
        'scale-in': 'scaleIn 150ms ease-out',
        'slide-in-right': 'slideInRight 200ms ease-out',
        'shimmer': 'shimmer 1.5s ease-in-out infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-primary': 'linear-gradient(135deg, #7C4DDB 0%, #6940C7 100%)',
        'gradient-primary-hover': 'linear-gradient(135deg, #9771ED 0%, #7C4DDB 100%)',
        'gradient-subtle': 'linear-gradient(135deg, rgba(124, 77, 219, 0.04) 0%, rgba(105, 64, 199, 0.02) 100%)',
      },
      transitionTimingFunction: {
        'bounce-in': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
    },
  },
  plugins: [],
};

export default config;
