interface PsychocasLogoProps {
  size?: number;
  gradientId?: string;
}

export default function PsychocasLogo({ size = 100 }: PsychocasLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Psychočas"
    >
      <circle cx="64" cy="64" r="38" fill="white" />
      <circle cx="64" cy="64" r="36" fill="none" stroke="#049EDB" strokeWidth="7" />
      <path
        d="M44 58.5L58.5 73L85 38"
        fill="none"
        stroke="#049EDB"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M78 31L83 20" stroke="#049EDB" strokeWidth="6" strokeLinecap="round" />
      <path
        d="M64 25V32M64 96V103M25 64H32M96 64H103M37.5 36.5L42.5 41.5M85.5 86.5L90.5 91.5M90.5 36.5L85.5 41.5M42.5 86.5L37.5 91.5"
        stroke="#049EDB"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
