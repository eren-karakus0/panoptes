import { cn } from "@/lib/utils";

interface PrismIconProps {
  className?: string;
}

export function PrismIcon({ className }: PrismIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-4", className)}
    >
      <defs>
        <linearGradient id="pi-g" x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4C1D95" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <path d="M12 3L21 8L21 16L12 21L3 16L3 8Z" fill="url(#pi-g)" />
      <path d="M12 3L21 8L12 12Z" fill="white" opacity=".1" />
      <circle cx="12" cy="12" r="1.8" fill="#1C0F2B" />
      <circle cx="11.5" cy="11.3" r=".6" fill="white" opacity=".5" />
    </svg>
  );
}
