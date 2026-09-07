import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function Stars({
  rating,
  reviews,
  size = 12,
  className,
}: {
  rating: number;
  reviews?: number;
  size?: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}>
      <span className="inline-flex items-center gap-0.5 rounded bg-teal/10 px-1.5 py-0.5 font-semibold text-teal">
        {rating.toFixed(1)}
        <Star size={size} className="fill-current" />
      </span>
      {reviews !== undefined && <span>({reviews})</span>}
    </span>
  );
}
