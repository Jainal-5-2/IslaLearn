"use client";

import { FileText, Video, ClipboardList, Lock, Plus, GripVertical } from "lucide-react";
import { TopicPage } from "@/lib/api";
import { cn } from "@/lib/utils";

interface PageListProps {
  pages: TopicPage[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
}

export function PageList({ pages, activeIndex, onSelect, onAdd }: PageListProps) {
  return (
    <div className="space-y-1">
      {pages.map((page, index) => (
        <button
          key={page.id}
          onClick={() => onSelect(index)}
          className={cn(
            "w-full text-left px-3 py-2 rounded-md text-sm flex items-center justify-between transition-colors group",
            index === activeIndex
              ? "bg-accent/10 text-accent font-medium"
              : "text-foreground hover:bg-muted"
          )}
        >
          <span className="flex items-center gap-2 truncate">
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
            <span className="text-xs text-muted-foreground w-4">{index + 1}.</span>
            {page.page_type === "text" && (
              <FileText className="h-3.5 w-3.5 shrink-0" />
            )}
            {page.page_type === "video" && (
              <Video className="h-3.5 w-3.5 shrink-0" />
            )}
            {page.page_type === "quiz" && (
              <ClipboardList className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="truncate capitalize">{page.page_type}</span>
          </span>
          {page.is_locked && (
            <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          )}
        </button>
      ))}
      <button
        onClick={onAdd}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <Plus className="h-4 w-4" />
        Add page
      </button>
    </div>
  );
}