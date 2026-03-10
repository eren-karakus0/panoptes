import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
}

export function PageHeader({ title, description, children, breadcrumbs }: PageHeaderProps) {
  return (
    <div className="mb-8">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="mb-3 flex items-center gap-1 text-xs text-dusty-lavender/50">
          <Link href="/dashboard" className="transition-colors hover:text-soft-violet">
            Dashboard
          </Link>
          {breadcrumbs.map((crumb) => (
            <span key={crumb.label} className="flex items-center gap-1">
              <ChevronRight className="size-3" />
              {crumb.href ? (
                <Link href={crumb.href} className="transition-colors hover:text-soft-violet">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-dusty-lavender/70">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-mist">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-dusty-lavender/70">{description}</p>
          )}
        </div>
        {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
      </div>
    </div>
  );
}
