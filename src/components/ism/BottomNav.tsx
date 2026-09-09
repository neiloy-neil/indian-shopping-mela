import { Link } from "@tanstack/react-router";
import { Grid2x2, Heart, Home, Search, User } from "lucide-react";
import { useIsm } from "@/lib/ism-store";

export function BottomNav() {
  const { wishlist } = useIsm();
  const item =
    "flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-semibold text-muted-foreground";
  const active = {
    className: "flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-semibold text-rani",
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface md:hidden">
      <div className="flex">
        <Link to="/" className={item} activeOptions={{ exact: true }} activeProps={active}>
          <Home size={19} /> Home
        </Link>
        <Link to="/category/$slug" params={{ slug: "women" }} className={item} activeProps={active}>
          <Grid2x2 size={19} /> Categories
        </Link>
        <Link to="/search" search={{}} className={item} activeProps={active}>
          <Search size={19} /> Search
        </Link>
        <Link to="/account" search={{ tab: "wishlist" }} className={item}>
          <span className="relative">
            <Heart size={19} />
            {wishlist.length > 0 && (
              <span className="absolute -right-2 -top-1 rounded-full bg-rani px-1 text-[9px] leading-3 text-rani-foreground">
                {wishlist.length}
              </span>
            )}
          </span>
          Wishlist
        </Link>
        <Link to="/account" className={item} activeProps={active}>
          <User size={19} /> Account
        </Link>
      </div>
    </nav>
  );
}
