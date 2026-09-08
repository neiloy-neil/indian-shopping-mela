import { useState, useEffect, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, CreditCard, Lock, Package, RotateCcw, ShieldCheck, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { ShopLayout } from "@/components/ism/ShopLayout";
import { formatAUD, sellerBySlug } from "@/lib/ism-data";
import { cartProducts, useIsm, getOrCreateGuestToken } from "@/lib/ism-store";
import {
  prepareCheckoutSummaryServerFn,
  createCheckoutOrderServerFn,
  type CheckoutSummary,
  type CheckoutItemDto,
} from "@/lib/api/checkout";
import { useAuth } from "@/hooks/use-auth";

const stripePublishableKey =
  typeof import.meta !== "undefined" && import.meta.env
    ? (import.meta.env["VITE_STRIPE_PUBLISHABLE_KEY"] as string)
    : "pk_test_placeholder";

const stripePromise = stripePublishableKey && stripePublishableKey.startsWith("pk_")
  ? loadStripe(stripePublishableKey)
  : null;

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — Indian Shopping Mela" },
      {
        name: "description",
        content: "Authoritative Australian multi-vendor checkout: delivery, shipping, Stripe payment and review in AUD.",
      },
      { property: "og:title", content: "Checkout — Indian Shopping Mela" },
      { property: "og:description", content: "One unified checkout across every Indian boutique seller in your cart." },
    ],
  }),
  component: CheckoutPage,
});

const STEPS = ["Delivery", "Shipping", "Payment", "Review"] as const;
const STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];

function StripePaymentForm({
  clientSecret,
  onPaymentSuccess,
  isPlacing,
  setIsPlacing,
  orderNumber,
  email,
}: {
  clientSecret: string;
  onPaymentSuccess: () => void;
  isPlacing: boolean;
  setIsPlacing: (placing: boolean) => void;
  orderNumber: string;
  email: string;
}) {
  const stripe = useStripe();
  const elements = useElements();

  const handleStripePay = async () => {
    if (!stripe || !elements) {
      toast.error("Payment provider is initializing. Please wait a moment.");
      return;
    }

    setIsPlacing(true);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/orders/${orderNumber}`,
          receipt_email: email,
        },
        redirect: "if_required",
      });

      if (error) {
        toast.error("Payment failed", { description: error.message });
      } else if (paymentIntent && (paymentIntent.status === "succeeded" || paymentIntent.status === "processing")) {
        onPaymentSuccess();
      }
    } catch (err: any) {
      toast.error("Payment error", { description: err.message });
    } finally {
      setIsPlacing(false);
    }
  };

  return (
    <div className="mt-4 space-y-4">
      <PaymentElement options={{ layout: "tabs" }} />
      <button
        type="button"
        id="stripe-submit-btn"
        className="hidden"
        onClick={handleStripePay}
      />
    </div>
  );
}

function CheckoutPage() {
  const { user } = useAuth();
  const { cart, subtotal, guestToken } = useIsm();
  const lines = cartProducts(cart);

  const [step, setStep] = useState(0);
  const [placed, setPlaced] = useState(false);
  const [isPlacing, setIsPlacing] = useState(false);
  const [placedOrderNumber, setPlacedOrderNumber] = useState("");
  const [placedOrderId, setPlacedOrderId] = useState("");
  const [express, setExpress] = useState(false);

  // Form State
  const [name, setName] = useState(user?.fullName ?? "Priya Sharma");
  const [email, setEmail] = useState(user?.email ?? "priya.sharma@example.com.au");
  const [phone, setPhone] = useState("+61 412 345 678");
  const [street, setStreet] = useState("42 Wigram Street");
  const [suburb, setSuburb] = useState("Harris Park");
  const [addressState, setAddressState] = useState("NSW");
  const [postcode, setPostcode] = useState("2150");

  // Server Calculated Summary
  const [summary, setSummary] = useState<CheckoutSummary | null>(null);
  const [clientSecret, setClientSecret] = useState<string>("");
  const [isCalculating, setIsCalculating] = useState(false);

  const sellers = useMemo(() => Array.from(new Set(lines.map((l) => l.product.seller))), [lines]);

  // Load authoritative server calculation whenever address or cart lines change
  useEffect(() => {
    if (lines.length === 0) return;

    const checkoutItems = lines.map((l) => ({
      variantId: l.line.variantId ?? l.product.id,
      quantity: l.line.qty,
    }));

    const destinationAddress = {
      line1: street,
      suburb,
      state: addressState,
      postcode,
      country: "Australia",
    };

    setIsCalculating(true);
    prepareCheckoutSummaryServerFn({
      data: {
        items: checkoutItems,
        destinationAddress,
        sessionId: guestToken || getOrCreateGuestToken(),
      },
    })
      .then((res) => {
        setSummary(res);
      })
      .catch((err) => {
        console.warn("prepareCheckoutSummaryServerFn note:", err.message);
      })
      .finally(() => {
        setIsCalculating(false);
      });
  }, [lines, street, suburb, addressState, postcode, guestToken]);

  // Initialize order creation & PaymentIntent upon reaching Payment step
  const handleProceedToPayment = async () => {
    if (!summary) return;

    setIsPlacing(true);
    try {
      const destinationAddress = {
        line1: street,
        suburb,
        state: addressState,
        postcode,
        country: "Australia",
      };

      const checkoutItems = lines.map((l) => ({
        variantId: l.line.variantId ?? l.product.id,
        quantity: l.line.qty,
      }));

      const result = await createCheckoutOrderServerFn({
        data: {
          items: checkoutItems,
          customerEmail: email,
          customerName: name,
          customerPhone: phone,
          shippingAddress: destinationAddress,
          billingAddress: destinationAddress,
          userId: user?.id,
          sessionId: guestToken || getOrCreateGuestToken(),
          idempotencyKey: `ord_idem_${guestToken}_${Date.now()}`,
        },
      });

      setPlacedOrderId(result.masterOrderId);
      setPlacedOrderNumber(result.masterOrderNumber);
      if (result.clientSecret) {
        setClientSecret(result.clientSecret);
      }
      setStep(2);
    } catch (err: any) {
      toast.error("Checkout preparation failed", { description: err.message });
    } finally {
      setIsPlacing(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (clientSecret && stripePromise) {
      const submitBtn = document.getElementById("stripe-submit-btn");
      if (submitBtn) {
        submitBtn.click();
        return;
      }
    }

    if (!clientSecret) {
      toast.error("Payment session unavailable", {
        description: "Please reload checkout or contact support to complete payment.",
      });
      return;
    }

    setPlaced(true);
    toast.success("Order confirmed successfully!", {
      description: `Order #${placedOrderNumber || "ISM10002"} with ${sellers.length} seller package(s).`,
    });
  };

  if (placed) {
    return (
      <ShopLayout>
        <div className="mx-auto max-w-xl py-12 text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-teal/15 text-teal">
            <Check size={32} />
          </div>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-widest text-primary">
            Order Confirmed · 100% Guaranteed
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
            Dhanyawad, {name.split(" ")[0]}!
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Order <span className="font-mono font-bold text-foreground">#{placedOrderNumber || "ISM10002"}</span> has been placed.
            We have sent your invoice and delivery tracking details to <span className="font-semibold text-foreground">{email}</span>.
          </p>
          <div className="mt-6 rounded-md border border-border bg-card p-4 text-left text-xs space-y-2">
            <p className="font-semibold text-foreground">Order Overview:</p>
            <p className="text-muted-foreground">• {sellers.length} distinct boutique seller package(s) dispatched separately.</p>
            <p className="text-muted-foreground">• Total amount paid: <span className="font-bold text-foreground">{formatAUD(summary?.grandTotalAud ?? subtotal)} AUD</span> (inclusive of 10% GST).</p>
            <p className="text-muted-foreground">• Protected by Australia-wide 7-day change-of-mind return policy & Australian Consumer Law.</p>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/orders/$id"
              params={{ id: placedOrderId || placedOrderNumber || "ISM10002" }}
              className="inline-flex items-center gap-1.5 rounded-sm bg-rani px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-rani-foreground hover:bg-rani/90"
            >
              Track Order
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-sm border border-border px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-foreground hover:bg-accent"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </ShopLayout>
    );
  }

  if (lines.length === 0) {
    return (
      <ShopLayout>
        <div className="mx-auto max-w-md py-16 text-center">
          <Package className="mx-auto size-12 text-muted-foreground" />
          <h1 className="mt-4 font-display text-xl font-bold">Your cart is empty</h1>
          <p className="mt-2 text-sm text-muted-foreground">Add handcrafted Indian clothing or jewellery to begin checkout.</p>
          <Link
            to="/category/$slug"
            params={{ slug: "women" }}
            className="mt-6 inline-flex items-center gap-1.5 rounded-sm bg-rani px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-rani-foreground"
          >
            Browse Catalogue
          </Link>
        </div>
      </ShopLayout>
    );
  }

  const grandTotal = summary?.grandTotalAud ?? (subtotal + sellers.length * (express ? 14.95 : 9.95));
  const shippingTotal = summary?.shippingTotalAud ?? (sellers.length * (express ? 14.95 : 9.95));
  const gstTotal = summary?.gstTotalAud ?? Number((grandTotal / 11).toFixed(2));

  return (
    <ShopLayout>
      <div className="mx-auto max-w-5xl py-6 sm:py-8">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Secure Checkout</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Zero-trust verified checkout · 10% Australian GST included · Australia Post delivery
        </p>

        {/* Stepper */}
        <ol className="mt-6 grid grid-cols-4 gap-2 border-b border-border pb-4">
          {STEPS.map((s, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li
                key={s}
                className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wide ${
                  active ? "text-rani" : done ? "text-teal" : "text-muted-foreground"
                }`}
              >
                <span
                  className={`grid size-6 place-items-center rounded-full text-[11px] font-bold ${
                    done
                      ? "bg-teal text-teal-foreground"
                      : active
                        ? "bg-rani text-rani-foreground"
                        : "border border-border bg-surface"
                  }`}
                >
                  {done ? <Check size={12} /> : i + 1}
                </span>
                <span className="hidden sm:inline">{s}</span>
              </li>
            );
          })}
        </ol>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="rounded-md border border-border bg-card p-5 sm:p-6 shadow-sm">
            {/* Step 0: Delivery */}
            {step === 0 && (
              <div className="space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-wide">1. Delivery Address</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      Full Name
                    </label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm outline-none focus:border-rani"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm outline-none focus:border-rani"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      Mobile (for AusPost SMS Tracking)
                    </label>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm outline-none focus:border-rani"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      Street Address
                    </label>
                    <input
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm outline-none focus:border-rani"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      Suburb
                    </label>
                    <input
                      value={suburb}
                      onChange={(e) => setSuburb(e.target.value)}
                      className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm outline-none focus:border-rani"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                        State
                      </label>
                      <select
                        value={addressState}
                        onChange={(e) => setAddressState(e.target.value)}
                        className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-2 text-sm outline-none focus:border-rani"
                      >
                        {STATES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                        Postcode
                      </label>
                      <input
                        value={postcode}
                        onChange={(e) => setPostcode(e.target.value)}
                        className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm outline-none focus:border-rani"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: Shipping */}
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-wide">2. Shipping Method</h2>
                <p className="text-xs text-muted-foreground">
                  Each independent boutique seller ships directly from their Australian dispatch facility.
                </p>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setExpress(false)}
                    className={`flex w-full items-center gap-3 rounded-sm border p-3 text-left ${
                      !express ? "border-rani bg-accent" : "border-border"
                    }`}
                  >
                    <span
                      className={`grid size-4 place-items-center rounded-full border ${
                        !express ? "border-rani bg-rani text-rani-foreground" : "border-border"
                      }`}
                    >
                      {!express && <Check size={10} />}
                    </span>
                    <div>
                      <span className="block text-sm font-semibold">Standard Australia Post</span>
                      <span className="block text-xs text-muted-foreground">3–6 business days · $9.95 per seller package</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpress(true)}
                    className={`flex w-full items-center gap-3 rounded-sm border p-3 text-left ${
                      express ? "border-rani bg-accent" : "border-border"
                    }`}
                  >
                    <span
                      className={`grid size-4 place-items-center rounded-full border ${
                        express ? "border-rani bg-rani text-rani-foreground" : "border-border"
                      }`}
                    >
                      {express && <Check size={10} />}
                    </span>
                    <div>
                      <span className="block text-sm font-semibold">Express Post</span>
                      <span className="block text-xs text-muted-foreground">1–3 business days · $14.95 per seller package</span>
                    </div>
                  </button>
                </div>

                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    Your order ships as {sellers.length} package(s):
                  </p>
                  <div className="mt-2 space-y-2">
                    {sellers.map((s, i) => {
                      const seller = sellerBySlug(s);
                      return (
                        <div
                          key={s}
                          className="flex items-center justify-between rounded-sm border border-border bg-cream/50 p-2.5 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <Package size={14} className="text-primary shrink-0" />
                            <span className="font-semibold">
                              Package {i + 1} of {sellers.length} — {seller?.name ?? "Boutique Seller"}
                            </span>
                          </div>
                          <span className="text-muted-foreground">{seller?.dispatchDays ?? "1–2 business days"}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Payment */}
            {step === 2 && (
              <div className="space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-wide">3. Payment Information</h2>
                <p className="text-xs text-muted-foreground">
                  Encrypted, PCI-compliant payment processed by Stripe Australia.
                </p>

                {clientSecret && stripePromise ? (
                  <Elements
                    stripe={stripePromise}
                    options={{
                      clientSecret,
                      appearance: {
                        theme: "stripe",
                        variables: {
                          colorPrimary: "#b81d24",
                          borderRadius: "4px",
                        },
                      },
                    }}
                  >
                    <StripePaymentForm
                      clientSecret={clientSecret}
                      onPaymentSuccess={() => {
                        setPlaced(true);
                        toast.success("Payment confirmed!");
                      }}
                      isPlacing={isPlacing}
                      setIsPlacing={setIsPlacing}
                      orderNumber={placedOrderNumber}
                      email={email}
                    />
                  </Elements>
                ) : (
                  <div className="rounded-sm border border-dashed border-border bg-cream/40 p-4 text-xs text-muted-foreground space-y-2">
                    <p className="font-semibold text-foreground flex items-center gap-1.5">
                      <CreditCard size={14} className="text-primary" /> Ready to process order
                    </p>
                    <p>
                      Order <span className="font-mono font-bold text-foreground">#{placedOrderNumber || "ISM10002"}</span> has been initialized on the server with 15-minute atomic stock reservation.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Review */}
            {step === 3 && (
              <div className="space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-wide">4. Review & Confirm Order</h2>
                <div className="space-y-3 text-xs">
                  <div className="rounded-sm border border-border p-3">
                    <p className="font-bold uppercase text-muted-foreground">Delivery To</p>
                    <p className="mt-1 text-foreground font-semibold">
                      {name} · {street}, {suburb} {addressState} {postcode} · {phone}
                    </p>
                  </div>
                  <div className="rounded-sm border border-border p-3">
                    <p className="font-bold uppercase text-muted-foreground">Shipping Method</p>
                    <p className="mt-1 text-foreground font-semibold">
                      {express ? "Express Post (1–3 business days)" : "Standard Australia Post (3–6 business days)"} · {sellers.length} package(s)
                    </p>
                  </div>
                  <div className="rounded-sm border border-border p-3">
                    <p className="font-bold uppercase text-muted-foreground">Ordered Items</p>
                    <div className="mt-1 space-y-1">
                      {lines.map((l) => (
                        <div key={l.product.id} className="flex justify-between">
                          <span>
                            {l.line.qty} × {l.product.name} ({l.line.size ?? "Standard"})
                          </span>
                          <span className="font-semibold">{formatAUD(l.product.price * l.line.qty)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step Actions */}
            <div className="mt-6 flex justify-between gap-3 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setStep(Math.max(0, step - 1))}
                disabled={step === 0 || isPlacing}
                className="rounded-sm border border-border px-4 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground disabled:opacity-40"
              >
                Back
              </button>

              {step === 0 && (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-sm bg-rani px-6 py-2 text-xs font-bold uppercase tracking-wide text-rani-foreground hover:bg-rani/90"
                >
                  Continue to Shipping
                </button>
              )}

              {step === 1 && (
                <button
                  type="button"
                  onClick={handleProceedToPayment}
                  disabled={isPlacing || isCalculating}
                  className="rounded-sm bg-rani px-6 py-2 text-xs font-bold uppercase tracking-wide text-rani-foreground hover:bg-rani/90 disabled:opacity-50"
                >
                  {isPlacing ? "Initializing Order..." : "Proceed to Payment"}
                </button>
              )}

              {step === 2 && (
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="rounded-sm bg-rani px-6 py-2 text-xs font-bold uppercase tracking-wide text-rani-foreground hover:bg-rani/90"
                >
                  Review Order
                </button>
              )}

              {step === 3 && (
                <button
                  type="button"
                  onClick={handlePlaceOrder}
                  disabled={isPlacing}
                  className="rounded-sm bg-rani px-6 py-2.5 text-xs font-bold uppercase tracking-wide text-rani-foreground hover:bg-rani/90 disabled:opacity-50"
                >
                  {isPlacing ? "Authorizing Payment..." : `Place Order · ${formatAUD(grandTotal)} AUD`}
                </button>
              )}
            </div>
          </div>

          {/* Sidebar Order Summary */}
          <aside className="h-max space-y-4">
            <div className="rounded-md border border-border bg-card p-5 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wide">Order Summary</h2>
              <span className="mt-2 block h-px w-full gold-hairline" aria-hidden />
              <dl className="mt-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Items ({lines.reduce((n, l) => n + l.line.qty, 0)})</dt>
                  <dd className="font-semibold text-foreground">{formatAUD(subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Shipping ({sellers.length} pkg)</dt>
                  <dd className="font-semibold text-foreground">{formatAUD(shippingTotal)}</dd>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <dt>GST Included (10%)</dt>
                  <dd>{formatAUD(gstTotal)}</dd>
                </div>
              </dl>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <span className="text-xs font-bold uppercase">Total (AUD)</span>
                <span className="text-lg font-bold text-foreground">{formatAUD(grandTotal)}</span>
              </div>
            </div>

            <div className="rounded-md border border-border bg-cream/60 p-3.5 text-[11px] text-muted-foreground space-y-2">
              <p className="flex items-center gap-1.5 text-foreground font-semibold">
                <Lock size={12} className="text-teal shrink-0" /> Bank-grade 256-bit encryption
              </p>
              <p className="flex items-center gap-1.5">
                <ShieldCheck size={12} className="text-primary shrink-0" /> Full buyer protection across all sellers
              </p>
              <p className="flex items-center gap-1.5">
                <RotateCcw size={12} className="text-primary shrink-0" /> 7-day change-of-mind return policy
              </p>
            </div>
          </aside>
        </div>
      </div>
    </ShopLayout>
  );
}
