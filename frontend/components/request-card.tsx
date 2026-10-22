import Link from "next/link";
import { TutoringRequest } from "@/lib/api";
import { cn } from "@/lib/utils";

interface RequestCardProps {
  request: TutoringRequest;
  showApplications?: boolean;
  href?: string;
  isOwner?: boolean;
  action?: React.ReactNode;
  footer?: React.ReactNode;
}

export function RequestCard({
  request,
  showApplications = true,
  href,
  isOwner = false,
  action,
  footer,
}: RequestCardProps) {
  const target = href ?? `/requests/${request.id}`;
  const interactive = !footer;

  const body = (
    <>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-xs font-medium px-2 py-1 bg-muted rounded-md text-muted-foreground">
          {request.subject.name}
        </span>
        <span
          className={cn(
            "text-xs px-2 py-1 rounded-md font-medium",
            request.status === "open"
              ? "bg-green-500/10 text-green-600"
              : "bg-muted text-muted-foreground"
          )}
        >
          {request.status}
        </span>
        {isOwner && (
          <span className="text-xs px-2 py-1 rounded-md font-medium bg-accent/10 text-accent">
            Your request
          </span>
        )}
        {showApplications &&
          typeof request.application_count === "number" && (
            <span className="text-xs text-muted-foreground">
              {request.application_count} application
              {request.application_count === 1 ? "" : "s"}
            </span>
          )}
        {action && <div className="ml-auto">{action}</div>}
      </div>
      <p className="text-sm text-foreground line-clamp-2">
        {request.description}
      </p>
      <p className="text-xs text-muted-foreground mt-3">
        by {request.tutee.username} ·{" "}
        {new Date(request.created_at).toLocaleDateString()}
      </p>
      {footer && (
        <div
          className="mt-4 pt-4 border-t border-border"
          onClick={(e) => e.stopPropagation()}
        >
          {footer}
        </div>
      )}
    </>
  );

  const baseClasses =
    "block bg-card border rounded-xl p-5 transition-all";

  if (interactive) {
    return (
      <Link
        href={target}
        className={cn(
          baseClasses,
          "border-border hover:shadow-md hover:border-accent/40"
        )}
      >
        {body}
      </Link>
    );
  }

  return (
    <div
      className={cn(
        baseClasses,
        isOwner ? "border-accent/50" : "border-border"
      )}
    >
      {body}
    </div>
  );
}