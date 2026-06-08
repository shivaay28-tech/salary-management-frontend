import { Filter } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { accentCard, PAGE_THEMES, type PageThemeKey } from "@/lib/theme";
import { cn } from "@/lib/utils";

interface FilterSectionProps {
  theme: PageThemeKey;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function FilterSection({
  theme,
  title = "Filters",
  description,
  children,
  className,
}: FilterSectionProps) {
  const style = accentCard(theme);
  const iconClass = PAGE_THEMES[theme].icon;

  return (
    <Card className={cn(style.card, className)}>
      <CardHeader className={cn(style.header, "gap-1 py-3")}>
        <div className="flex items-center gap-2">
          <Filter className={cn("size-4 shrink-0", iconClass)} />
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  );
}
