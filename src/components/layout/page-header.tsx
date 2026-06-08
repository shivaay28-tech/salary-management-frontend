import { cn } from "@/lib/utils";
import { PAGE_THEMES, type PageThemeKey } from "@/lib/theme";

interface PageHeaderProps {
  theme: PageThemeKey;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  theme,
  title,
  description,
  children,
  className,
}: PageHeaderProps) {
  const t = PAGE_THEMES[theme];

  return (
    <div
      className={cn(
        "rounded-2xl bg-gradient-to-r p-6 text-white shadow-lg",
        t.gradient,
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-white/85">{description}</p>
          )}
        </div>
        {children && (
          <div className="page-header-actions flex flex-wrap gap-2">{children}</div>
        )}
      </div>
    </div>
  );
}
