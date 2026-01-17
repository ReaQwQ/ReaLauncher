/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Deep purple/blue theme
                primary: {
                    50: 'rgb(var(--color-primary-50) / <alpha-value>)',
                    100: 'rgb(var(--color-primary-100) / <alpha-value>)',
                    200: 'rgb(var(--color-primary-200) / <alpha-value>)',
                    300: 'rgb(var(--color-primary-300) / <alpha-value>)',
                    400: 'rgb(var(--color-primary-400) / <alpha-value>)',
                    500: 'rgb(var(--color-primary-500) / <alpha-value>)',
                    600: 'rgb(var(--color-primary-600) / <alpha-value>)',
                    700: 'rgb(var(--color-primary-700) / <alpha-value>)',
                    800: 'rgb(var(--color-primary-800) / <alpha-value>)',
                    900: 'rgb(var(--color-primary-900) / <alpha-value>)',
                    950: 'rgb(var(--color-primary-950) / <alpha-value>)',
                },
                dark: {
                    50: 'rgb(var(--color-dark-50) / <alpha-value>)',
                    100: 'rgb(var(--color-dark-100) / <alpha-value>)',
                    200: 'rgb(var(--color-dark-200) / <alpha-value>)',
                    300: 'rgb(var(--color-dark-300) / <alpha-value>)',
                    400: 'rgb(var(--color-dark-400) / <alpha-value>)',
                    500: 'rgb(var(--color-dark-500) / <alpha-value>)',
                    600: 'rgb(var(--color-dark-600) / <alpha-value>)',
                    700: 'rgb(var(--color-dark-700) / <alpha-value>)',
                    800: 'rgb(var(--color-dark-800) / <alpha-value>)',
                    900: 'rgb(var(--color-dark-900) / <alpha-value>)',
                    950: 'rgb(var(--color-dark-950) / <alpha-value>)',
                }
            },
            fontFamily: {
                sans: ['var(--font-sans)', 'sans-serif'],
                minecraft: ['Mojangles', 'sans-serif'],
            },
            animation: {
                'fade-in': 'fadeIn 0.3s ease-out',
                'slide-up': 'slideUp 0.3s ease-out',
                'glow': 'glow 2s ease-in-out infinite alternate',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                glow: {
                    '0%': { boxShadow: '0 0 5px rgba(139, 92, 246, 0.5)' },
                    '100%': { boxShadow: '0 0 20px rgba(139, 92, 246, 0.8)' },
                }
            }
        },
    },
    plugins: [],
}
