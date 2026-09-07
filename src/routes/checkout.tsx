import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, CreditCard, Lock, Package, RotateCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { ShopLayout } from "@/components/ism/ShopLayout";
import { formatAUD, sellerBySlug } from "@/lib/ism-data";
import { cartProducts, useIsm } from "@/lib/ism-store";
import { createCheckoutOrderTransactional, prepareCheckoutSummary } from "@/lib/api/checkout";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — Indian Shopping Mela" },
      {
        name: "description",
        content: "Four-step Australian checkout: delivery, shipping, payment and review with one final AUD total.",
      },
      { property: "og:title", content: "Checkout — Indian Shopping Mela" },
      { property: "og:description", content: "One checkout across every Indian seller in your cart." },
    ],
  }),
  component: CheckoutPage,
});

const STEPS = ["Delivery", "Shipping", "Payment", "Review"] as const;
const STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];

function CheckoutPage() {
  const [step, setStep] = useState(0);
  const [placed, setPlaced] = useState(false);
  const [isPlacing, setIsPlacing] = useState(false);
  const [placedOrderNumber, setPlacedOrderNumber] = useState("ISM10002");
  const [express, setExpress] = useState(false);
  const [accountMode, setAccountMode] = useState<"guest" | "account">("guest");
  const [method, setMethod] = useState("card");

  // Form state
  const [name, setName] = useState("Priya Sharma");
  const [email, setEmail] = useState("priya.sharma@example.com.au");
  const [phone, setPhone] = useState("+61 412 345 678");
  const [street, setStreet] = useState("42 Wigram Street");
  const [suburb, setSuburb] = useState("Harris Park");
  const [addressState, setAddressState] = useState("NSW");
  const [postcode, setPostcode] = useState("2150");

  const { cart, subtotal } = useIsm();
  const lines = cartProducts(cart);
  const sellers = Array.from(new Set(lines.map((l) => l.product.seller)));
  const shipping = sellers.length * (express ? 14.95 : 9.95);
  const total = subtotal + shipping;

  const handlePlaceOrder = async () => {
    setIsPlacing(true);
    try {
      const checkoutItems = lines.map((l) => ({
        productId: l.product.id,
        variantId: l.product.id,
        sellerId: l.product.seller,
        productTitle: l.product.name,
        variantTitle: `${l.line.size ?? "Standard"} / ${l.line.colour ?? "Standard"}`,
        sku: `${l.product.id.toUpperCase()}-STD`,
        unitPriceAud: l.product.price,
        quantity: l.line.qty,
        weightKg: 0.5,
      }));

      const destinationAddress = {
        line1: street,
        suburb,
        state: addressState,
        postcode,
        country: "Australia",
      };

      const summary = await prepareCheckoutSummary(checkoutItems, destinationAddress, `checkout_sess_${Date.now()}`);
      const result = await createCheckoutOrderTransactional({
        customerEmail: email,
        customerName: name,
        customerPhone: phone,
        shippingAddress: destinationAddress,
        billingAddress: destinationAddress,
        summary,
      });

      setPlacedOrderNumber(result.masterOrderNumber);
      setPlaced(true);
      toast.success("Order confirmed successfully!", {
        description: `Order #${result.masterOrderNumber} with ${sellers.length} seller packages.`,
      });
    } catch (err: any) {
      console.error("Order placement failed:", err);
      toast.error("Unable to place order", {
        description: err.message || "A transactional error occurred while processing checkout. Please try again.",
      });
    } finally {
      setIsPlacing(false);
    }
  };

  if (placed) {
    return (
      <ShopLayout>
        <div className="ism-container py-20 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-teal text-teal-foreground">
            <Check size={26} />
          </span>
          <h1 className="mt-5 font-display text-2xl font-bold text-primary">Order #{placedOrderNumber} placed</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {sellers.length} packages from {sellers.length} sellers · total {formatAUD(total)} AUD
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Confirmation sent to {email}</p>
          <Link
            to="/account"
            search={{ tab: "orders" }}
            className="mt-6 inline-block rounded-sm bg-rani px-6 py-3 text-xs font-bold uppercase tracking-wide text-rani-foreground"
          >
            Track your orders
          </Link>
        </div>
      </ShopLayout>
    );
  }


  return (
    <ShopLayout>
      <div className="ism-container py-8">
        <h1 className="section-title text-foreground">Secure Checkout</h1>
        <span className="mt-2 block h-1 w-20 rounded-full mela-rule" aria-hidden />

        {/* Step indicator */}
        <ol className="mt-6 flex items-center">
          {STEPS.map((s, i) => (
            <li key={s} className="flex flex-1 items-center last:flex-none">
              <button
                onClick={() => setStep(i)}
                className="flex items-center gap-2 text-left"
                disabled={i > step}
              >
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors ${
                    i < step
                      ? "bg-teal text-teal-foreground"
                      : i === step
                        ? "bg-rani text-rani-foreground"
                        : "border-2 border-border text-muted-foreground"
                  }`}
                >
                  {i < step ? <Check size={14} /> : i + 1}
                </span>
                <span
                  className={`hidden text-xs font-bold uppercase tracking-wide sm:inline ${
                    i === step ? "text-foreground" : i < step ? "text-teal" : "text-muted-foreground"
                  }`}
                >
                  {s}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <span
                  className={`mx-2 h-0.5 flex-1 rounded-full sm:mx-3 ${
                    i < step ? "bg-teal" : "bg-border"
                  }`}
                  aria-hidden
                />
              )}
            </li>
          ))}
        </ol>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="rounded-md border border-border bg-card p-5">
            {step === 0 && (
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wide">Delivery Address</h2>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {[
                    { id: "guest" as const, title: "Continue as guest", note: "Order updates by email; create an account later." },
                    { id: "account" as const, title: "Sign in to my account", note: "Saved addresses, order history and returns." },
                  ].map((o) => (
                    <button
                      key={o.id}
                      onClick={() => setAccountMode(o.id)}
                      className={`rounded-sm border p-3 text-left text-sm transition-colors ${
                        accountMode === o.id ? "border-rani bg-rani/5" : "border-border hover:border-rani/50"
                      }`}
                    >
                      <span className="font-bold">{o.title}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{o.note}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Demo prototype — no real authentication. Real guest/account sessions are BACKEND REQUIRED.
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Field label="First name" defaultValue="Priya" />
                  <Field label="Last name" defaultValue="Sharma" />
                  <Field label="Mobile" defaultValue="0412 345 678" />
                  <Field label="Email" defaultValue="priya@example.com.au" />
                  <Field label="Street address" defaultValue="24 Wigram Street" full />
                  <Field label="Unit / Apartment (optional)" full />
                  <Field label="Suburb" defaultValue="Harris Park" />
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      State
                    </label>
                    <select className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm outline-none focus:border-rani">
                      {STATES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <Field label="Postcode" defaultValue="2150" />
                  <Field label="Delivery instructions (optional)" full />
                </div>
              </div>
            )}

            {step === 1 && (
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wide">Shipping Method</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Each seller ships their own package. Choose a speed for the whole order.
                </p>
                <div className="mt-4 space-y-2">
                  <Option
                    active={!express}
                    onClick={() => setExpress(false)}
                    title="Standard Australia Post"
                    note="4–7 business days · $9.95 per package"
                  />
                  <Option
                    active={express}
                    onClick={() => setExpress(true)}
                    title="Express Post"
                    note="1–3 business days · $14.95 per package"
                  />
                </div>
                <p className="mt-5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Your order ships as {sellers.length} package{sellers.length === 1 ? "" : "s"}
                </p>
                <div className="mt-2 space-y-2">
                  {sellers.map((s, i) => {
                    const seller = sellerBySlug(s)!;
                    return (
                      <div
                        key={s}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-sm border border-border bg-cream/60 p-3 text-xs"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <Package size={15} className="shrink-0 text-primary" />
                          <span className="min-w-0 truncate font-semibold">
                            Package {i + 1} of {sellers.length} — {seller.name}
                          </span>
                        </div>
                        <span className="shrink-0 text-muted-foreground">
                          Dispatch {seller.dispatchDays}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wide">Payment</h2>
                <div className="mt-4 space-y-2">
                  {[
                    { id: "card", title: "Credit / Debit Card", note: "Visa, Mastercard, Amex, Apple Pay", available: true },
                    { id: "payid", title: "PayID / Bank Transfer", note: "Direct bank transfer (Coming Soon)", available: false },
                    { id: "bnpl", title: "Buy Now Pay Later", note: "Afterpay / Zip (Coming Soon)", available: false },
                  ].filter(m => m.available).map((m) => (
                    <Option
                      key={m.id}
                      active={method === m.id}
                      onClick={() => setMethod(m.id)}
                      title={m.title}
                      note={m.note}
                    />
                  ))}
                </div>
                {method === "card" && (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <Field label="Card number" defaultValue="4242 4242 4242 4242" full />
                    <Field label="Expiry" defaultValue="04/29" />
                    <Field label="CVC" defaultValue="123" />
                    <Field label="Name on card" defaultValue="Priya Sharma" full />
                  </div>
                )}
                <p className="mt-4 flex items-center gap-2 rounded-sm border border-dashed border-border bg-cream/60 px-3 py-2 text-[11px] text-muted-foreground">
                  <CreditCard size={13} className="shrink-0" /> Prototype checkout — no real payment is processed.
                  BACKEND REQUIRED: orders are only marked paid from a provider-confirmed server callback, with
                  idempotency keys, and stock is reserved transactionally to prevent overselling.
                </p>
              </div>
            )}

            {step === 3 && (
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wide">Review Your Order</h2>
                <div className="mt-4 space-y-3 text-sm">
                  <Review title="Delivering to">
                    Priya Sharma · 24 Wigram Street, Harris Park NSW 2150 · 0412 345 678
                  </Review>
                  <Review title="Shipping">
                    {express ? "Express Post (1–3 business days)" : "Standard (4–7 business days)"} ·{" "}
                    {sellers.length} package{sellers.length === 1 ? "" : "s"}
                  </Review>
                  <Review title="Payment">
                    {method === "card" ? "Card ending 4242" : method === "payid" ? "PayID" : "BNPL — 4 payments"}{" "}
                    <span className="text-muted-foreground">(prototype — not charged)</span>
                  </Review>
                  <Review title="Items">
                    {lines.map((l) => (
                      <span key={l.product.id} className="block">
                        {l.line.qty} × {l.product.name} — {formatAUD(l.product.price * l.line.qty)}
                      </span>
                    ))}
                  </Review>
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-between gap-3 border-t border-border pt-5">
              <button
                onClick={() => setStep(Math.max(0, step - 1))}
                disabled={step === 0 || isPlacing}
                className="rounded-sm border border-border px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-muted-foreground disabled:opacity-40"
              >
                Back
              </button>
              <button
                onClick={() => {
                  if (step === 3) {
                    handlePlaceOrder();
                  } else setStep(step + 1);
                }}
                disabled={isPlacing}
                className="rounded-sm bg-rani px-6 py-2.5 text-xs font-bold uppercase tracking-wide text-rani-foreground hover:opacity-90 disabled:opacity-50"
              >
                {step === 3 ? (isPlacing ? "Processing..." : `Place order · ${formatAUD(total)}`) : "Continue"}
              </button>
            </div>
          </div>

          <aside className="h-max space-y-4">
            <div className="rounded-md border border-border bg-card p-5 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wide">Order Total</h2>
              <span className="mt-2 block h-px w-full gold-hairline" aria-hidden />
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt>Items ({lines.length})</dt>
                  <dd className="font-semibold">{formatAUD(subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Shipping — {sellers.length} package{sellers.length === 1 ? "" : "s"}</dt>
                  <dd className="font-semibold">{formatAUD(shipping)}</dd>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <dt>GST included</dt>
                  <dd>{formatAUD(Math.round(total / 11))}</dd>
                </div>
              </dl>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <span className="text-sm font-bold uppercase">One final total</span>
                <span className="text-xl font-bold text-foreground">{formatAUD(total)}</span>
              </div>
            </div>
            <div className="rounded-md border border-border bg-cream/60 p-4 text-xs text-muted-foreground">
              <p className="flex items-center gap-2">
                <Lock size={13} className="shrink-0 text-primary" /> Prototype secure checkout — demo only
              </p>
              <p className="mt-2 flex items-center gap-2">
                <ShieldCheck size={13} className="shrink-0 text-primary" /> Buyer protection on every order
              </p>
              <p className="mt-2 flex items-center gap-2">
                <RotateCcw size={13} className="shrink-0 text-primary" /> Easy 7-day returns
              </p>
            </div>
          </aside>
        </div>
      </div>
    </ShopLayout>
  );
}

function Field({
  label,
  defaultValue,
  full,
}: {
  label: string;
  defaultValue?: string;
  full?: boolean;
}) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <input
        defaultValue={defaultValue}
        className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm outline-none focus:border-rani"
      />
    </div>
  );
}

function Option({
  active,
  onClick,
  title,
  note,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  note: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-sm border p-3 text-left ${
        active ? "border-rani bg-accent" : "border-border"
      }`}
    >
      <span
        className={`grid size-4 place-items-center rounded-full border ${
          active ? "border-rani bg-rani text-rani-foreground" : "border-border"
        }`}
      >
        {active && <Check size={10} />}
      </span>
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted-foreground">{note}</span>
      </span>
    </button>
  );
}

function Review({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-sm border border-border p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}
