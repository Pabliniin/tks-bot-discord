/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta de marca de TK$ Bot. Cambia estos valores y se aplica a todo.
        brand: {
          50: '#EEF0FE',
          100: '#DDE1FD',
          200: '#BAC3FB',
          300: '#98A5F9',
          400: '#7587F7',
          500: '#5865F2',
          600: '#4451D8',
          700: '#333EAE',
          800: '#232B85',
          900: '#151B5C',
        },
        // Grises inspirados en la interfaz de Discord.
        ink: {
          50: '#F2F3F5',
          100: '#E3E5E8',
          200: '#B5BAC1',
          300: '#87909C',
          400: '#5C6470',
          500: '#404249',
          600: '#313338',
          700: '#2B2D31',
          800: '#232428',
          900: '#1E1F22',
          950: '#111214',
        },
        success: '#3BA55D',
        danger: '#ED4245',
        warning: '#FAA81A',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'grid-dark':
          'linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s ease-out both',
        float: 'float 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
