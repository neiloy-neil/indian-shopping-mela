import { useState } from "react";
import { Link } from "@tanstack/react-router";
import logoAsset from "@/assets/ism-logo.png.asset.json";

/**
 * Master brand asset supplied by Indian Shopping Mela.
 */
export const ISM_LOGO_SRC = "/ism-logo.png";
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
  const [imgError, setImgError] = useState(false);

  return (
    <span
      className={[
        "inline-flex shrink-0 items-center justify-center",
        onDark ? "rounded-xl bg-white/95 px-3 py-2 shadow-sm ring-1 ring-white/40" : "",
        className,
      ].join(" ")}
    >
      {!imgError ? (
        <img
          src={ISM_LOGO_SRC}
          alt={ISM_LOGO_ALT}
          width={1254}
          height={1254}
          onError={() => setImgError(true)}
          className={
            compact ? "h-10 w-auto object-contain" : "h-10 w-auto object-contain sm:h-12 md:h-14"
          }
        />
      ) : (
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-tr from-primary to-rani font-display text-base font-black text-primary-foreground shadow-sm">
            ISM
          </span>
          {!compact && (
            <div className="flex flex-col text-left leading-none">
              <span className="font-display text-sm font-extrabold tracking-tight text-primary">
                INDIAN SHOPPING MELA
              </span>
              <span className="text-[9px] font-bold tracking-widest text-rani">
                AUSTRALIA'S DESI BAZAAR
              </span>
            </div>
          )}
        </div>
      )}
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

