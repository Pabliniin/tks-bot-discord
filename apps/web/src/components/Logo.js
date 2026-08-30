/**
 * Logotipo de TK$ Bot.
 * Es un SVG propio, así no depende de ningún archivo externo y escala bien.
 */
export default function Logo({ size = 40, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="TK$ Bot"
    >
      <defs>
        <linearGradient id="tk-logo-gradient" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7587F7" />
          <stop offset="1" stopColor="#4451D8" />
        </linearGradient>
      </defs>

      <rect width="48" height="48" rx="13" fill="url(#tk-logo-gradient)" />

      {/* Monograma "TK" */}
      <path
        d="M9 15.5h11.5v3.6h-3.9V33h-3.7V19.1H9v-3.6Z"
        fill="white"
        fillOpacity="0.96"
      />
      <path
        d="M22.5 15.5h3.7v6.9l5.4-6.9h4.4l-6.1 7.6L36.4 33h-4.5l-4.2-7.1-1.5 1.8V33h-3.7V15.5Z"
        fill="white"
        fillOpacity="0.96"
      />

      {/* Símbolo del dólar atravesando el monograma */}
      <path
        d="M38.2 11.5v25"
        stroke="white"
        strokeOpacity="0.55"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
