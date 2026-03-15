'use client';

import Image from 'next/image';
import { useTheme } from '@/lib/theme-context';

interface OkraLogoProps {
  size?: number;
  className?: string;
}

/**
 * Picks the best logo variant per theme:
 *  - dark  → green (pops on the dark background)
 *  - light → black (clean contrast on white)
 */
export default function OkraLogo({ size = 28, className = '' }: OkraLogoProps) {
  const { theme } = useTheme();
  const src = theme === 'dark' ? '/images/logo-green.svg' : '/images/logo-black.svg';

  return (
    <Image
      src={src}
      alt="Okra logo"
      width={size}
      height={size}
      className={className}
      priority
    />
  );
}
