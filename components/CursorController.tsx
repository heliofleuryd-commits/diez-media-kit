'use client';

import { usePathname } from 'next/navigation';
import TargetCursor from './TargetCursor';

// Only show the custom cursor on public-facing pages
export default function CursorController() {
  const pathname = usePathname();
  const skip = pathname.startsWith('/admin') || pathname.startsWith('/football');
  if (skip) return null;
  return <TargetCursor />;
}
