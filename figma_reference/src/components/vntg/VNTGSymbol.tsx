// VNTG Penrose Triangle Symbol
export function VNTGSymbol({ className = "", size = 24 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M50 10 L90 75 L10 75 Z"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
        strokeLinejoin="miter"
      />
      <path
        d="M50 30 L70 65 L30 65 Z"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
        strokeLinejoin="miter"
      />
      <path
        d="M35 65 L50 30 L50 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="miter"
      />
    </svg>
  );
}
