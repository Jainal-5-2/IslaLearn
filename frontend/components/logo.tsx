import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  href?: string;
  className?: string;
  size?: number;
  showText?: boolean;
}

export function Logo({ 
  href = "/", 
  className, 
  size = 40, 
  showText = true 
}: LogoProps) {
  const content = (
    <div className={cn("flex items-center gap-2", className)}>
      <div 
        className="relative shrink-0 overflow-hidden rounded-full" 
        style={{ width: size, height: size }}
      >
        <Image
          src="/logo.png"
          alt="IslaLearn Logo"
          fill
          className="object-cover"
          priority
        />
      </div>
      {showText && (
        <span className="text-xl font-bold tracking-tight text-foreground">
          IslaLearn
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-block transition-opacity hover:opacity-80">
        {content}
      </Link>
    );
  }

  return content;
}