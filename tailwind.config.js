/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "bg-deep": "#111315",
        "surface-dark": "#171A1D",
        "surface-elevated": "#22262A",
        "text-cream": "#F4EFE6",
        "gold-primary": "#C9A45C",
        "gold-hover": "#D8B46B",
        "bronze-accent": "#A98245",
        "text-muted": "#8E9297",
        "border-dark": "#2A2E33",
        "emerald-success": "#22C55E",
        "rose-expense": "#EF4444",
      },
      boxShadow: {
        soft: "0 18px 50px rgba(0, 0, 0, 0.4)",
        glow: "0 0 20px rgba(201, 164, 92, 0.15)",
      },
    },
  },
  plugins: [],
};

