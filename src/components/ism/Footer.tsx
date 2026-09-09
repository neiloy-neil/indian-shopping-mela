import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { CATEGORIES } from "@/lib/ism-data";
import { LogoMark } from "@/components/ism/Logo";

const linkCls = "hover:text-gold";

export function Footer() {
  return (
    <footer className="mt-14 border-t border-border">
      <div className="bunting" aria-hidden />
      <div className="festive-deep mandala text-primary-foreground">
        <div className="ism-container relative grid gap-8 py-12 md:grid-cols-4">
          <div>
            <LogoMark onDark />
            <p className="mt-4 max-w-xs text-sm text-primary-foreground/80">
              Australia's multi-vendor marketplace for Indian fashion, jewellery, home and festive
              essentials. Shipped locally by verified sellers in NSW, VIC, QLD, WA and SA.
            </p>
          </div>

          <FooterCol title="Shop">
            {CATEGORIES.slice(0, 6).map((c) => (
              <li key={c.slug}>
                <Link to="/category/$slug" params={{ slug: c.slug }} className={linkCls}>
                  {c.name}
                </Link>
              </li>
            ))}
          </FooterCol>

          <FooterCol title="Customer Care">
            <li>
              <Link to="/account" search={{ tab: "orders" }} className={linkCls}>
                Track Your Order
              </Link>
            </li>
            <li>
              <Link to="/policies" className={linkCls}>
                Returns & Refunds Policy
              </Link>
            </li>
            <li>
              <Link to="/policies" className={linkCls}>
                Privacy & Data Policy
              </Link>
            </li>
            <li>
              <Link to="/policies" className={linkCls}>
                Terms of Service
              </Link>
            </li>
            <li>
              <Link to="/account" search={{ tab: "wishlist" }} className={linkCls}>
                My Wishlist
              </Link>
            </li>
            <li>
              <Link to="/signin" className={linkCls}>
                Sign In / Register
              </Link>
            </li>
          </FooterCol>

          <FooterCol title="Sellers & Partners">
            <li>
              <Link to="/sell" className={linkCls}>
                Sell on ISM
              </Link>
            </li>
            <li>
              <Link to="/sell/add-product" className={linkCls}>
                Add a Product
              </Link>
            </li>
            <li>
              <Link to="/sell/bulk-upload" className={linkCls}>
                Bulk Product Upload
              </Link>
            </li>
            <li>
              <Link to="/seller/$slug" params={{ slug: "jaipur-jewel-house" }} className={linkCls}>
                Featured Storefront
              </Link>
            </li>
            <li>
              <Link to="/policies" className={linkCls}>
                Seller Master Agreement
              </Link>
            </li>
            <li>
              <Link to="/admin" className={linkCls}>
                Admin Console
              </Link>
            </li>
          </FooterCol>
        </div>

        <div className="relative border-t border-gold/25">
          <div className="ism-container flex flex-col gap-2 py-5 text-xs text-primary-foreground/70 md:flex-row md:items-center md:justify-between">
            <p>© 2026 Indian Shopping Mela Pty Ltd · All Rights Reserved</p>
            <div className="flex flex-wrap gap-4">
              <Link to="/policies" className="hover:text-gold hover:underline">
                Privacy Policy
              </Link>
              <Link to="/policies" className="hover:text-gold hover:underline">
                Terms of Service
              </Link>
              <Link to="/policies" className="hover:text-gold hover:underline">
                GST & Tax Compliance
              </Link>
            </div>
            <p>All prices in AUD (GST inclusive) · Stripe & Australia Post Powered</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-gold">{title}</h3>
      <ul className="mt-4 space-y-2 text-sm text-primary-foreground/80">{children}</ul>
    </div>
  );
}
