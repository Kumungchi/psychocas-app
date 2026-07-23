import Image from 'next/image';

interface PsychocasLogoProps {
  size?: number;
  gradientId?: string;
  className?: string;
}

export default function PsychocasLogo({ size = 42, className }: PsychocasLogoProps) {
  return (
    <Image
      src="/brand/psychocas-wordmark.svg"
      width={Math.round(size * (600 / 190))}
      height={size}
      alt="Psychočas – Psychologická česká asociace studentů"
      className={className}
      unoptimized
      style={{ display: 'block', flexShrink: 0, height: size, width: 'auto' }}
    />
  );
}
