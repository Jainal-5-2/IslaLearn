import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
}

export function StatCard({ icon: Icon, label, value, hint, accent }: StatCardProps) {
  return (
    <div className="p-4 sm:p-6 rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div
          className={cn(
            "p-2 rounded-lg",
            accent ? "bg-accent/10" : "bg-muted"
          )}
        >
          <Icon
            className={cn(
              "h-5 w-5",
              accent ? "text-accent" : "text-muted-foreground"
            )}
          />
        </div>
      </div>
      <h3 className="text-sm text-muted-foreground mb-1">{label}</h3>
      <p className="text-2xl font-bold">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}