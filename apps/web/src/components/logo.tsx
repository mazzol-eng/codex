import Link from 'next/link';
import { Bot } from 'lucide-react';
import { brand } from '../../../../config/brand';
const BrandIcon = { bot: Bot }[brand.logo];
export function Logo({ href = '/', compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="brand" aria-label={`${brand.name}, início`}>
      <span className="brand-mark">
        <BrandIcon size={23} strokeWidth={2.2} />
      </span>
      {!compact && (
        <span>
          {brand.name}
          <span className="brand-dot">.</span>
        </span>
      )}
    </Link>
  );
}
