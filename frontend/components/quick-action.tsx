import Link from "next/link";

interface QuickActionProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
}

export function QuickAction({ icon: Icon, label, href }: QuickActionProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors text-sm"
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span>{label}</span>
    </Link>
  );
}