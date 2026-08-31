/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ClawdHQ primary orange (replacing Twitter blue for primary actions)
        primary: {
          DEFAULT: '#FF6B35',
          light: '#FF8C42',
          dark: '#E55934',
        },
        secondary: {
          DEFAULT: '#FF9F1C',
          light: '#FFB84D',
          dark: '#E58A00',
        },
        // Legacy X.com token names, repointed to ClawdHQ orange — no blue
        // branding remains anywhere in the app.
        twitter: {
          blue: '#FF6B35',
          'blue-hover': '#E55934',
          'blue-active': '#E55934',
        },
        // Background colors
        background: {
          primary: '#000000',
          secondary: '#16181C',
          tertiary: '#202327',
          modal: '#16181C',
        },
        // Border colors
        border: {
          DEFAULT: '#2F3336',
          light: '#38444D',
          hover: '#536471',
        },
        // Text colors
        text: {
          primary: '#E7E9EA',
          secondary: '#71767B',
          tertiary: '#536471',
          link: '#FF6B35',
        },
        // Interaction colors
        interaction: {
          reply: '#FF6B35',
          repost: '#00BA7C',
          like: '#F91880',
          view: '#FF6B35',
        },
        // ClawdHQ brand (lobster red-orange)
        brand: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#F97316',
          600: '#EA580C',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
        },
        // Success / Error
        success: '#00BA7C',
        error: '#F4212E',
        warning: '#FFAD1F',
      },
      fontFamily: {
        sans: [
          'var(--font-inter)',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      fontSize: {
        '2xs': ['11px', { lineHeight: '16px' }],
        xs: ['13px', { lineHeight: '16px' }],
        sm: ['14px', { lineHeight: '20px' }],
        base: ['15px', { lineHeight: '20px' }],
        lg: ['17px', { lineHeight: '24px' }],
        xl: ['20px', { lineHeight: '24px' }],
        '2xl': ['23px', { lineHeight: '28px' }],
        '3xl': ['31px', { lineHeight: '36px' }],
      },
      borderRadius: {
        none: '0',
        sm: '4px',
        DEFAULT: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
        '3xl': '28px',
        full: '9999px',
      },
      spacing: {
        '13': '3.25rem',
        '15': '3.75rem',
        '17': '4.25rem',
        '18': '4.5rem',
        '19': '4.75rem',
        '68': '17rem',
        '84': '21rem',
        '88': '22rem',
        '128': '32rem',
      },
      maxWidth: {
        feed: '600px',
        sidebar: '350px',
        'left-nav': '275px',
        'left-nav-collapsed': '88px',
      },
      minWidth: {
        feed: '600px',
        'left-nav': '68px',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'heart-pop': 'heartPop 0.3s ease-out',
        'spin-slow': 'spin 2s linear infinite',
        'pulse-subtle': 'pulseSubtle 2s ease-in-out infinite',
        shimmer: 'shimmer 1.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        heartPop: {
          '0%': { transform: 'scale(1)' },
          '25%': { transform: 'scale(1.2)' },
          '50%': { transform: 'scale(0.95)' },
          '100%': { transform: 'scale(1)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      boxShadow: {
        'twitter-sm': '0 0 1px rgba(255, 255, 255, 0.2)',
        twitter: 'rgba(255, 255, 255, 0.2) 0px 0px 15px, rgba(255, 255, 255, 0.15) 0px 0px 3px 1px',
        'twitter-lg': 'rgba(136, 153, 166, 0.2) 0px 0px 15px, rgba(136, 153, 166, 0.15) 0px 0px 3px 1px',
        glow: '0 0 20px rgba(255, 107, 53, 0.3)',
      },
      transitionTimingFunction: {
        twitter: 'cubic-bezier(0.17, 0.17, 0, 1)',
      },
      backgroundImage: {
        shimmer: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)',
      },
    },
  },
  plugins: [],
};
