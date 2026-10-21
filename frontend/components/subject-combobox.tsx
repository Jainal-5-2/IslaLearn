"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { Subject } from "@/lib/api";
import { cn } from "@/lib/utils";

interface SubjectComboboxProps {
  subjects: Subject[];
  value: number | null;
  onChange: (id: number | null) => void;
  placeholder?: string;
  className?: string;
}

export function SubjectCombobox({
  subjects,
  value,
  onChange,
  placeholder = "All subjects",
  className,
}: SubjectComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = subjects.find((s) => s.id === value) || null;

  const filtered = query.trim()
    ? subjects.filter((s) =>
        s.name.toLowerCase().includes(query.trim().toLowerCase())
      )
    : subjects;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Focus input when opening
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery("");
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  function handleSelect(id: number | null) {
    onChange(id);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className={cn("relative w-full sm:w-72", className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full flex items-center justify-between gap-2 h-10 px-3 rounded-lg border border-border bg-background text-left text-sm transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/50",
          open && "ring-2 ring-accent/50"
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected ? selected.name : placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {selected && (
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(null);
              }}
              className="p-0.5 rounded hover:bg-muted"
              aria-label="Clear selection"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
          )}
          <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-2 w-full rounded-lg border border-border bg-card shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-2 px-3 border-b border-border">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search subjects..."
              className="w-full h-10 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>

          {/* Options */}
          <ul
            role="listbox"
            className="max-h-64 overflow-y-auto py-1"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                No subjects match "{query}"
              </li>
            ) : (
              <>
                {/* "All subjects" option at the top */}
                {!query.trim() && (
                  <li>
                    <button
                      type="button"
                      onClick={() => handleSelect(null)}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted transition-colors"
                    >
                      <span className="text-muted-foreground">All subjects</span>
                      {value === null && <Check className="h-4 w-4 text-accent" />}
                    </button>
                  </li>
                )}
                {filtered.map((sub) => (
                  <li key={sub.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(sub.id)}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                    >
                      <span className="truncate">{sub.name}</span>
                      {value === sub.id && (
                        <Check className="h-4 w-4 text-accent shrink-0 ml-2" />
                      )}
                    </button>
                  </li>
                ))}
              </>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}