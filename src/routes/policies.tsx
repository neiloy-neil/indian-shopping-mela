import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck, FileText, RotateCcw, Building2, AlertTriangle, Receipt } from "lucide-react";
import { ShopLayout } from "@/components/ism/ShopLayout";

export const Route = createFileRoute("/policies")({
  head: () => ({
    meta: [
      { title: "Legal & Marketplace Policies — Indian Shopping Mela" },
      {
        name: "description",
        content:
          "Official marketplace policies including Terms of Service, Privacy Policy, 7-Day Returns, Seller Agreements and ACL Consumer Guarantees.",
      },
      { property: "og:title", content: "Legal & Marketplace Policies — Indian Shopping Mela" },
      {
        property: "og:description",
        content:
          "Transparent terms, GST tax compliance, privacy standards and return policies for Australian buyers and sellers.",
      },
    ],
  }),
  component: PoliciesPage,
});

type PolicyTab = "terms" | "privacy" | "returns" | "seller-agreement" | "prohibited" | "gst-tax";

function PoliciesPage() {
  const [activeTab, setActiveTab] = useState<PolicyTab>("returns");

  return (
    <ShopLayout>
      <div className="bg-cream">
        <div className="ism-container py-10">
          <div className="max-w-3xl">
            <h1 className="font-display text-3xl font-bold text-foreground">
              Marketplace Policies & Legal Terms
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Indian Shopping Mela Pty Ltd operates an Australian multi-vendor marketplace
              connecting verified Australian-based Indian boutiques, artisans, and sellers with
              Australian consumers.
            </p>
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[260px_1fr]">
            {/* Sidebar Navigation */}
            <nav className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-3 shadow-sm h-fit">
              <button
                onClick={() => setActiveTab("returns")}
                className={`flex items-center gap-2.5 rounded-md px-3.5 py-2.5 text-xs font-semibold text-left transition-colors ${
                  activeTab === "returns"
                    ? "bg-rani text-rani-foreground"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <RotateCcw size={16} />
                <span>Returns & Refunds Policy</span>
              </button>

              <button
                onClick={() => setActiveTab("terms")}
                className={`flex items-center gap-2.5 rounded-md px-3.5 py-2.5 text-xs font-semibold text-left transition-colors ${
                  activeTab === "terms"
                    ? "bg-rani text-rani-foreground"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <FileText size={16} />
                <span>Terms & Conditions</span>
              </button>

              <button
                onClick={() => setActiveTab("privacy")}
                className={`flex items-center gap-2.5 rounded-md px-3.5 py-2.5 text-xs font-semibold text-left transition-colors ${
                  activeTab === "privacy"
                    ? "bg-rani text-rani-foreground"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <ShieldCheck size={16} />
                <span>Privacy Policy</span>
              </button>

              <button
                onClick={() => setActiveTab("seller-agreement")}
                className={`flex items-center gap-2.5 rounded-md px-3.5 py-2.5 text-xs font-semibold text-left transition-colors ${
                  activeTab === "seller-agreement"
                    ? "bg-rani text-rani-foreground"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <Building2 size={16} />
                <span>Seller Master Agreement</span>
              </button>

              <button
                onClick={() => setActiveTab("prohibited")}
                className={`flex items-center gap-2.5 rounded-md px-3.5 py-2.5 text-xs font-semibold text-left transition-colors ${
                  activeTab === "prohibited"
                    ? "bg-rani text-rani-foreground"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <AlertTriangle size={16} />
                <span>Prohibited & Restricted Goods</span>
              </button>

              <button
                onClick={() => setActiveTab("gst-tax")}
                className={`flex items-center gap-2.5 rounded-md px-3.5 py-2.5 text-xs font-semibold text-left transition-colors ${
                  activeTab === "gst-tax"
                    ? "bg-rani text-rani-foreground"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <Receipt size={16} />
                <span>GST & Tax Compliance</span>
              </button>
            </nav>

            {/* Main Content Area */}
            <article className="rounded-lg border border-border bg-card p-8 shadow-sm space-y-6">
              {activeTab === "returns" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-rani font-bold text-xs uppercase tracking-wider">
                    <RotateCcw size={16} />
                    <span>Version 1.2 — Effective September 2026</span>
                  </div>
                  <h2 className="font-display text-2xl font-bold text-foreground">
                    7-Day Change of Mind & Australian Consumer Law
                  </h2>
                  <div className="space-y-3 text-sm text-foreground/90 leading-relaxed">
                    <p>
                      At Indian Shopping Mela, we strive for complete satisfaction with every
                      purchase from our Indian boutiques. All eligible orders come with our{" "}
                      <strong>7-Day Change-of-Mind Return Window</strong> in addition to your
                      statutory rights under the <strong>Australian Consumer Law (ACL)</strong>.
                    </p>
                    <h3 className="font-bold text-base text-foreground mt-4">
                      1. 7-Day Change of Mind Eligibility
                    </h3>
                    <ul className="list-disc pl-5 space-y-1.5 text-xs text-muted-foreground">
                      <li>
                        Return request must be logged within 7 calendar days of courier delivery
                        confirmation.
                      </li>
                      <li>
                        Item must be unworn, unwashed, in its original packaging with all boutique
                        tags intact.
                      </li>
                      <li>
                        Custom-stitched blouses, altered sarees, and perishable pooja goods/sweets
                        are excluded from change-of-mind returns.
                      </li>
                      <li>
                        Customer is responsible for standard return postage back to the seller's
                        Australian return address.
                      </li>
                    </ul>

                    <h3 className="font-bold text-base text-foreground mt-4">
                      2. Statutory Rights (ACL Consumer Guarantees)
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      If an item arrives damaged, materially defective, counterfeit, or differs
                      significantly from the listing description, you are entitled to a replacement
                      or full refund under the Australian Consumer Law. Statutory claims can be
                      submitted beyond the 7-day change-of-mind period and return shipping is
                      covered by the seller.
                    </p>

                    <h3 className="font-bold text-base text-foreground mt-4">
                      3. Refund Processing & Payout Holds
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Once a return request is opened, the affected seller payout balance is
                      automatically placed on financial hold. Upon item inspection and seller
                      approval, funds are refunded to your original payment method (Stripe
                      card/Apple Pay) within 3-5 business days.
                    </p>

                    <div className="mt-6 pt-4 border-t border-border">
                      <Link
                        to="/returns/new"
                        className="inline-flex items-center justify-center rounded-sm bg-rani px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-rani-foreground hover:opacity-90"
                      >
                        Start a Return Request →
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "terms" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-rani font-bold text-xs uppercase tracking-wider">
                    <FileText size={16} />
                    <span>Version 1.0 — Effective September 2026</span>
                  </div>
                  <h2 className="font-display text-2xl font-bold text-foreground">
                    Marketplace Terms of Service
                  </h2>
                  <div className="space-y-3 text-sm text-foreground/90 leading-relaxed">
                    <p>
                      Welcome to Indian Shopping Mela. By browsing, creating an account, or placing
                      an order on our platform, you agree to be bound by these Terms of Service.
                    </p>
                    <h3 className="font-bold text-base text-foreground mt-4">
                      1. Marketplace Operation
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Indian Shopping Mela operates as an intermediary marketplace platform. When
                      you purchase goods, your contract of sale is directly with the individual
                      verified seller listed on the product page. ISM facilitates payment
                      processing, order splitting, seller communication, dispute mediation, and
                      courier integration.
                    </p>
                    <h3 className="font-bold text-base text-foreground mt-4">
                      2. Multi-Vendor Orders & Shipping
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      When your cart contains products from multiple sellers, your order will be
                      automatically split into individual seller packages. Each seller packages and
                      dispatches their items independently. Shipping fees and thresholds ($99 free
                      delivery) apply per seller package.
                    </p>
                    <h3 className="font-bold text-base text-foreground mt-4">
                      3. Pricing and Payments
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      All prices are quoted in Australian Dollars (AUD) and are inclusive of
                      Australian Goods and Services Tax (GST) where applicable. Payments are
                      securely processed via Stripe Payments Australia.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === "privacy" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-rani font-bold text-xs uppercase tracking-wider">
                    <ShieldCheck size={16} />
                    <span>Privacy Act 1988 (Cth) Compliant</span>
                  </div>
                  <h2 className="font-display text-2xl font-bold text-foreground">
                    Privacy Policy & Data Security
                  </h2>
                  <div className="space-y-3 text-sm text-foreground/90 leading-relaxed">
                    <p>
                      Indian Shopping Mela respects your privacy and is committed to protecting your
                      personal information in accordance with the Australian Privacy Principles
                      (APPs) set out in the Privacy Act 1988 (Cth).
                    </p>
                    <h3 className="font-bold text-base text-foreground mt-4">
                      1. Information We Collect
                    </h3>
                    <ul className="list-disc pl-5 space-y-1.5 text-xs text-muted-foreground">
                      <li>
                        <strong>Customer details:</strong> Name, delivery address, phone number,
                        email address for order fulfillment and tracking.
                      </li>
                      <li>
                        <strong>Seller verification:</strong> ABN, legal entity name, identity
                        documentation, Australian dispatch and return address.
                      </li>
                      <li>
                        <strong>Financial security:</strong> We never store raw credit card numbers
                        or banking passwords. All payment tokens are handled by PCI-DSS Level 1
                        compliant Stripe.
                      </li>
                    </ul>
                    <h3 className="font-bold text-base text-foreground mt-4">
                      2. Use of Information
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Personal delivery information is shared only with the specific sellers
                      fulfilling your items and authorized courier partners (Australia Post /
                      Sendle) strictly to complete shipping and delivery.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === "seller-agreement" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-rani font-bold text-xs uppercase tracking-wider">
                    <Building2 size={16} />
                    <span>Seller Master Terms v1.1</span>
                  </div>
                  <h2 className="font-display text-2xl font-bold text-foreground">
                    Seller Master Marketplace Agreement
                  </h2>
                  <div className="space-y-3 text-sm text-foreground/90 leading-relaxed">
                    <p>
                      This Agreement outlines the operational, fulfillment, and financial
                      obligations required of all approved boutique sellers on Indian Shopping Mela.
                    </p>
                    <h3 className="font-bold text-base text-foreground mt-4">
                      1. Commission & Fee Schedule
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      ISM charges a flat 10% marketplace commission on the item value of completed
                      orders. No monthly subscription fee is required for standard boutique
                      listings.
                    </p>
                    <h3 className="font-bold text-base text-foreground mt-4">
                      2. 14-Day Delivery Payout Hold
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      To safeguard buyers and accommodate our 7-day return policy, seller net
                      earnings mature and become eligible for payout exactly{" "}
                      <strong>14 calendar days after courier delivery confirmation</strong>. Payouts
                      are transferred automatically to your verified Australian Stripe Connect
                      account.
                    </p>
                    <h3 className="font-bold text-base text-foreground mt-4">
                      3. Dispatch Standards & Packaging
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Sellers must accept and dispatch orders within their declared handling time
                      (maximum 2-3 business days) using tracked Australia Post or Sendle services.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === "prohibited" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-rani font-bold text-xs uppercase tracking-wider">
                    <AlertTriangle size={16} />
                    <span>Catalogue Compliance Policy</span>
                  </div>
                  <h2 className="font-display text-2xl font-bold text-foreground">
                    Prohibited & Restricted Items
                  </h2>
                  <div className="space-y-3 text-sm text-foreground/90 leading-relaxed">
                    <p>
                      To maintain trust and adhere to Australian safety and customs laws, the
                      following items are strictly prohibited from listing on Indian Shopping Mela:
                    </p>
                    <ul className="list-disc pl-5 space-y-1.5 text-xs text-muted-foreground">
                      <li>
                        <strong>Counterfeits & Replica Designer Goods:</strong> Unauthorized copies
                        of designer ethnic brands.
                      </li>
                      <li>
                        <strong>Unapproved Medicines:</strong> Prescription pharmaceuticals or
                        Ayurvedic medicines making unapproved therapeutic claims without TGA
                        registration.
                      </li>
                      <li>
                        <strong>Perishable & Hazardous Goods:</strong> Fresh unsealed perishable
                        foods, hazardous fireworks, or uncertified flammable items.
                      </li>
                      <li>
                        <strong>Precious Metals without Hallmark:</strong> Gold/silver jewellery
                        without clear purity hallmarking specifications.
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {activeTab === "gst-tax" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-rani font-bold text-xs uppercase tracking-wider">
                    <Receipt size={16} />
                    <span>Australian Taxation Office (ATO) Standards</span>
                  </div>
                  <h2 className="font-display text-2xl font-bold text-foreground">
                    GST & Invoicing Compliance
                  </h2>
                  <div className="space-y-3 text-sm text-foreground/90 leading-relaxed">
                    <p>
                      Indian Shopping Mela complies with Australian GST regulations for electronic
                      distribution platforms (EDPs) and marketplace operators.
                    </p>
                    <h3 className="font-bold text-base text-foreground mt-4">
                      1. Inclusive Pricing
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      All item prices and shipping rates displayed on the marketplace include 10%
                      Australian Goods and Services Tax (GST).
                    </p>
                    <h3 className="font-bold text-base text-foreground mt-4">2. Tax Invoices</h3>
                    <p className="text-xs text-muted-foreground">
                      Itemized GST tax invoices showing seller ABNs, item descriptions, GST
                      components (total / 11), and delivery breakdowns are generated automatically
                      and sent with order confirmation emails. Tax invoices are also downloadable at
                      any time from your customer account portal.
                    </p>
                  </div>
                </div>
              )}
            </article>
          </div>
        </div>
      </div>
    </ShopLayout>
  );
}
