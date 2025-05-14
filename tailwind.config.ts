import type { Config } from "tailwindcss";
import defaultTheme from 'tailwindcss/defaultTheme'
import flowbitePlugin from 'flowbite/plugin';

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/flowbite/**/*.js",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          50: '#E6F0EB',
          100: '#CCDFD7',
          200: '#99BFB0',
          300: '#669F88',
          400: '#337F61',
          500: '#0B4B2D',  // DEFAULT
          600: '#094225',
          700: '#073B23',
          800: '#05321E',
          900: '#042819',
        },
        secondary: {
          50: '#FBF7F4',
          100: '#F5EBE3',
          200: '#E5D1C0',
          300: '#D4B49C',
          400: '#BF9872',
          500: '#A67F5D',  // DEFAULT
          600: '#8C6848',
          700: '#735439',
          800: '#5A422D',
          900: '#42311F',
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
          50: '#FDF8F6',
          100: '#F9EDE7',
          200: '#F0D5C8',
          300: '#E5CCBA',
          400: '#D4B49C',  // DEFAULT
          500: '#C39B7E',
          600: '#B38E6D',
          700: '#9C7857',
          800: '#856344',
          900: '#6E4E31',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        fresh: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
        },
        clean: {
          50: '#F0F9FF',
          100: '#E0F2FE',
          200: '#BAE6FD',
          300: '#7DD3FC',
          400: '#38BDF8',
          500: '#0EA5E9',
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
        // System Colors
        success: '#1B543D',
        error: '#A65D45',
        warning: '#C8976C',
        info: '#2C4F3E',
        background: {
          DEFAULT: '#FFFFFF',
          paper: '#FCFBF8',
          dark: '#0A2318',
        },
        content: {
          primary: '#0A2318',
          secondary: '#1B3C2B',
          disabled: '#A3B3AC',
          hint: '#5F7267',
        },
        neutral: {
          50: '#FFFFFF',
          100: '#FCFBF8',
          200: '#F5F2EA',
          300: '#EBE7DB',
          400: '#DDD6C4',
          500: '#CAC0A9',
          600: '#B3A88D',
          700: '#9C8F71',
          800: '#857754',
          900: '#6E5F38',
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' }
        },
        'shimmer': {
          '100%': {
            transform: 'translateX(100%)',
          },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'shimmer': 'shimmer 2s infinite',
      },
    },
  },
  plugins: [
    flowbitePlugin
  ],
};

export default config;
