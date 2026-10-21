import { Logo } from "@/components/logo";

interface FullPageLoaderProps {
  message?: string;
}

export function FullPageLoader({ message = "Loading..." }: FullPageLoaderProps) {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Logo size={64} showText={false} />
        <p className="text-sm text-muted-foreground animate-pulse">
          {message}
        </p>
      </div>
    </main>
  );
}