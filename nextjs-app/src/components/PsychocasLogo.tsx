interface PsychocasLogoProps {
  size?: number;
  gradientId?: string;
}

export default function PsychocasLogo({ size = 100, gradientId = 'logoGradient' }: PsychocasLogoProps) {
  return (
    <svg width={size} height={size} viewBox="-60 -60 120 120" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#1d4f7d', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#049edb', stopOpacity: 1 }} />
        </linearGradient>
      </defs>
      {/* Background circle with gradient */}
      <circle cx="0" cy="0" r="55" fill={`url(#${gradientId})`} />
      {/* Clock circle */}
      <circle cx="0" cy="0" r="50" fill="none" stroke="white" strokeWidth="6"/>
      {/* Hour hand pointing to 10 */}
      <line x1="0" y1="0" x2="-15" y2="-25" stroke="white" strokeWidth="5" strokeLinecap="round"/>
      {/* Minute hand pointing to 2 */}
      <line x1="0" y1="0" x2="25" y2="-15" stroke="white" strokeWidth="4" strokeLinecap="round"/>
      {/* Center dot */}
      <circle cx="0" cy="0" r="6" fill="white"/>
      {/* Clock marks at 12, 3, 6, 9 */}
      <circle cx="0" cy="-40" r="4" fill="white"/>
      <circle cx="40" cy="0" r="4" fill="white"/>
      <circle cx="0" cy="40" r="4" fill="white"/>
      <circle cx="-40" cy="0" r="4" fill="white"/>
    </svg>
  );
}
