/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: {
          50: '#fdfcfb',
          100: '#f7f6f3', // signature soft greyish-beige backdrop
          200: '#edeae4',
        },
        // Signature Burgundy Palette
        burgundy: {
          50: '#fdf3f5',
          100: '#fbe6ea',
          200: '#f6ced7',
          300: '#eda5b5',
          400: '#de6f89',
          500: '#cb4165',
          600: '#aa2448',
          700: '#871736', // Primary Brand Burgundy
          800: '#6f142e', // Deep Wine
          900: '#561225', // Midnight Burgundy
          950: '#380716',
        },
        // Warm Oatmeal & Sand Beige Palette
        beige: {
          50: '#faf8f5',
          100: '#f5f0e8', // Soft creamy beige
          200: '#ebdccb', // Warm sand beige
          300: '#ddc5a9',
          400: '#cbb08f',
          500: '#b59672',
          600: '#9c7d5b',
          700: '#7d6349',
          800: '#64503c',
          900: '#4f3f31',
        },
        // Elegant Warm Stone & Greyish Neutrals
        warmgrey: {
          50: '#fbfaf9',
          100: '#f4f2ee',
          200: '#e8e5df',
          300: '#d7d2c8',
          400: '#ada597',
          500: '#827a6c',
          600: '#645e52',
          700: '#4f4a40',
          800: '#3c3831',
          900: '#282520',
        },
        // Backward compatibility mappings directed into greyish-beige-burgundy
        teal: {
          50: '#fdf3f5',
          100: '#fbe6ea',
          200: '#f6ced7',
          300: '#eda5b5',
          400: '#de6f89',
          500: '#cb4165',
          600: '#871736',
          700: '#6f142e',
          800: '#561225',
          900: '#380716',
        },
        amber: {
          50: '#faf8f5',
          100: '#f5f0e8',
          200: '#ebdccb',
          300: '#ddc5a9',
          400: '#cbb08f',
          500: '#b59672',
          600: '#9c7d5b',
          700: '#7d6349',
          800: '#64503c',
        },
        navy: {
          950: '#282520',
          900: '#3c3831',
          850: '#4f4a40',
          800: '#645e52',
          700: '#827a6c',
          600: '#ada597',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(79, 74, 64, 0.05), 0 1px 2px -1px rgba(79, 74, 64, 0.04)',
        'card-hover': '0 4px 6px -1px rgba(79, 74, 64, 0.08), 0 2px 4px -2px rgba(79, 74, 64, 0.04)',
      }
    },
  },
  plugins: [],
}
