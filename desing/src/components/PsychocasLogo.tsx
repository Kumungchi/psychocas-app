type PsychocasLogoProps = {
  size?: number
  className?: string
}

export default function PsychocasLogo({ size = 72, className = '' }: PsychocasLogoProps) {
  const r = Math.round(size * 0.2) // border-radius
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 192 192"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Psychočas"
    >
      <defs>
        <linearGradient id="pcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1d4f7d" />
          <stop offset="100%" stopColor="#049edb" />
        </linearGradient>
      </defs>
      <rect width="192" height="192" rx={r} fill="url(#pcGrad)" />
      <g transform="translate(96, 88)">
        <circle cx="0" cy="0" r="50" fill="none" stroke="white" strokeWidth="8" opacity="0.95" />
        <line x1="0" y1="0" x2="0" y2="-28" stroke="white" strokeWidth="7" strokeLinecap="round" opacity="0.95" />
        <line x1="0" y1="0" x2="22" y2="-16" stroke="white" strokeWidth="5" strokeLinecap="round" opacity="0.95" />
        <circle cx="0" cy="0" r="6" fill="white" opacity="0.95" />
        <circle cx="0" cy="-45" r="3" fill="white" opacity="0.7" />
        <circle cx="45" cy="0" r="3" fill="white" opacity="0.7" />
        <circle cx="0" cy="45" r="3" fill="white" opacity="0.7" />
        <circle cx="-45" cy="0" r="3" fill="white" opacity="0.7" />
      </g>
    </svg>
  )
}
