"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface EmployeeOption {
  _id: string;
  fullName: string;
}

interface EmployeeSelectProps {
  employees: EmployeeOption[];
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  dialogOpen?: boolean;
}

export function EmployeeSelect({
  employees,
  value,
  onValueChange,
  disabled,
  label = "Employee",
  placeholder = "Search employee by name...",
  dialogOpen = true,
}: EmployeeSelectProps) {
  const [query, setQuery] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedEmployee = employees.find((employee) => employee._id === value);

  const filteredEmployees = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter((employee) =>
      employee.fullName.toLowerCase().includes(term)
    );
  }, [employees, query]);

  useEffect(() => {
    if (!dialogOpen) {
      setQuery("");
      setListOpen(false);
    }
  }, [dialogOpen]);

  useEffect(() => {
    if (!listOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setListOpen(false);
        if (value && selectedEmployee) {
          setQuery(selectedEmployee.fullName);
        } else if (!value) {
          setQuery("");
        }
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [listOpen, value, selectedEmployee]);

  const displayValue = listOpen ? query : selectedEmployee?.fullName ?? query;

  const handleFocus = () => {
    if (disabled) return;
    setListOpen(true);
    setQuery(selectedEmployee?.fullName ?? "");
  };

  const handleChange = (next: string) => {
    setQuery(next);
    setListOpen(true);
    if (value) onValueChange("");
  };

  const handleSelect = (employee: EmployeeOption) => {
    onValueChange(employee._id);
    setQuery(employee.fullName);
    setListOpen(false);
  };

  return (
    <div className="space-y-2" ref={containerRef}>
      <Label>{label}</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={placeholder}
          value={displayValue}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={handleFocus}
          disabled={disabled}
          autoComplete="off"
        />
        {listOpen && !disabled && (
          <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border bg-popover text-popover-foreground shadow-md">
            {filteredEmployees.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">No employees match</p>
            ) : (
              filteredEmployees.map((employee) => (
                <button
                  key={employee._id}
                  type="button"
                  className={cn(
                    "flex w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                    employee._id === value && "bg-accent/60 font-medium"
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(employee)}
                >
                  {employee.fullName}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}