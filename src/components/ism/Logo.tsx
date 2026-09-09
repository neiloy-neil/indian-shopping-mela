import { Link } from "@tanstack/react-router";
import logoAsset from "@/assets/ism-logo.png.asset.json";

/**
 * Official master brand asset supplied by Indian Shopping Mela.
 * Never redraw, recolour or crop — always render this exact file.
 */
export const ISM_LOGO_SRC = logoAsset.url;
export const ISM_LOGO_ALT = "Indian Shopping Mela — Your One Stop Desi Bazaar";

type LogoProps = {
  /** Smaller lockup for dense bars (mobile drawer, dashboards). */
  compact?: boolean;
  /** Renders on a dark surface: adds a soft white plate for contrast. */
  onDark?: boolean;
  className?: string;
};

/** Non-linking image, for places that already have their own link/heading. */
export function LogoMark({ compact = false, onDark = false, className = "" }: LogoProps) {
  return (
    <span
      className={[
        "inline-flex shrink-0 items-center justify-center",
        onDark ? "rounded-xl bg-white/95 px-3 py-2 shadow-sm ring-1 ring-white/40" : "",
        className,
      ].join(" ")}
    >
      <img
        src={ISM_LOGO_SRC}
        alt={ISM_LOGO_ALT}
        width={1254}
        height={1254}
        className={
          compact ? "h-12 w-auto object-contain" : "h-12 w-auto object-contain sm:h-14 md:h-[88px]"
        }
      />
    </span>
  );
}

export function Logo({ compact = false, onDark = false, className = "" }: LogoProps) {
  return (
    <Link
      to="/"
      className={["group flex shrink-0 items-center", className].join(" ")}
      aria-label={ISM_LOGO_ALT}
    >
      <LogoMark compact={compact} onDark={onDark} />
    </Link>
  );
}
