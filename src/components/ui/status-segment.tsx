import { cn } from "@/lib/utils";

interface StatusSegmentProps {
  value: string;
  onChange: (value: string) => void;
  options?: { value: string; label: string }[];
  className?: string;
}

const DEFAULT_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export function StatusSegment({
  value,
  onChange,
  options = DEFAULT_OPTIONS,
  className,
}: StatusSegmentProps) {
  return (
    <div
      className={cn(
        "inline-flex rounded-full border-2 border-primary bg-background p-0.5",
        className
      )}
      role="group"
      aria-label="Status filter"
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "min-w-[5.5rem] rounded-full px-5 py-1.5 text-sm font-semibold transition-colors",
              selected
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-transparent text-primary hover:bg-primary/8"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
