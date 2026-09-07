import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Camera, Info } from "lucide-react";
import { ShopLayout } from "@/components/ism/ShopLayout";
import { Badge, Button } from "@/components/ism/SellerShell";
import { DEMO_NOTE, MASTER_ORDER, RETURN_REASONS, RETURN_WINDOW_NOTE } from "@/lib/ism-ops";
import { formatAUD } from "@/lib/ism-data";

type Search = { order?: string | undefined };

export const Route = createFileRoute("/returns/new")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    order: typeof search['order'] === "string" ? (search['order'] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Request a return — Indian Shopping Mela" },
      {
        name: "description",
        content:
          "Start a return: choose items, select a reason, add photo evidence and follow the return label and refund steps.",
      },
      { property: "og:title", content: "Request a return — Indian Shopping Mela" },
      { property: "og:description", content: "Returns and refunds for ISM marketplace orders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewReturn,
});

function NewReturn() {
  const { order } = Route.useSearch();
  const sub = MASTER_ORDER.subOrders.find((s) => s.id === order) ?? MASTER_ORDER.subOrders[0]!;
  const [selected, setSelected] = useState<string[]>([sub.items[0]!.productId]);
  const [reason, setReason] = useState(RETURN_REASONS[0]!.id);
  const [submitted, setSubmitted] = useState(false);

  const reasonMeta = RETURN_REASONS.find((r) => r.id === reason)!;
  const refund = sub.items
    .filter((i) => selected.includes(i.productId))
    .reduce((n, i) => n + i.price * i.qty, 0);

  return (
    <ShopLayout>
      <div className="mx-auto max-w-4xl px-3 py-6 sm:px-4">
        <nav className="mb-3 text-xs text-muted-foreground">
          <Link to="/account" className="hover:text-rani">
            My Account
          </Link>{" "}
          /{" "}
          <Link to="/orders/$id" params={{ id: MASTER_ORDER.id }} className="hover:text-rani">
            #{MASTER_ORDER.id}
          </Link>{" "}
          / Return request
        </nav>

        <h1 className="font-display text-2xl font-bold text-primary">Request a return</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {sub.packageLabel} · {sub.seller} · sub-order {sub.id}
        </p>

        {submitted ? (
          <section className="mt-5 rounded-md border border-teal/40 bg-teal/5 p-5">
            <Badge tone="teal">RETURN_REQUESTED</Badge>
            <h2 className="mt-2 font-display text-xl font-semibold text-primary">Return RET-4501 created</h2>
            <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>1. Seller or ISM review — approve, reject or request more information.</li>
              <li>2. Return label and packing instructions issued once approved.</li>
              <li>3. Return in transit, then received and condition-checked by the seller.</li>
              <li>4. Refund of {formatAUD(refund)} issued to the original payment method; the seller's payout for this sub-order stays on hold until then.</li>
            </ol>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                to="/orders/$id"
                params={{ id: MASTER_ORDER.id }}
                className="inline-flex items-center rounded-sm bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wide text-primary-foreground"
              >
                Back to order
              </Link>
              <Button variant="outline" onClick={() => toast("Return label (demo PDF)")}>
                View return instructions
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{DEMO_NOTE}</p>
          </section>
        ) : (
          <div className="mt-5 space-y-4">
            <section className="rounded-md border border-border bg-surface p-4">
              <h2 className="text-sm font-bold uppercase tracking-wide">1. Choose items</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Partial returns are supported — items you leave unticked are unaffected.
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {sub.items.map((i) => (
                  <li key={i.productId}>
                    <label className="flex items-center justify-between gap-3 rounded-sm border border-border px-3 py-2.5">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={selected.includes(i.productId)}
                          onChange={(e) =>
                            setSelected((prev) =>
                              e.target.checked
                                ? [...prev, i.productId]
                                : prev.filter((x) => x !== i.productId),
                            )
                          }
                          className="size-4 accent-[var(--color-rani)]"
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{i.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {i.variant} · Qty {i.qty}
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 font-semibold">{formatAUD(i.price * i.qty)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-md border border-border bg-surface p-4">
              <h2 className="text-sm font-bold uppercase tracking-wide">2. Reason</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {RETURN_REASONS.map((r) => (
                  <label
                    key={r.id}
                    className={`flex items-center gap-2 rounded-sm border px-3 py-2.5 text-sm ${
                      reason === r.id ? "border-rani bg-rani/5" : "border-border"
                    }`}
                  >
                    <input
                      type="radio"
                      name="reason"
                      checked={reason === r.id}
                      onChange={() => setReason(r.id)}
                      className="size-4 accent-[var(--color-rani)]"
                    />
                    {r.label}
                  </label>
                ))}
              </div>
              <p className="mt-3 flex items-start gap-2 rounded-sm bg-muted/50 p-3 text-xs text-muted-foreground">
                <Info size={14} className="mt-0.5 shrink-0" />
                {reasonMeta.statutory
                  ? "Faulty, damaged, wrong or not-as-described items are assessed under Australian Consumer Law and are not limited by the 7-day change-of-mind window."
                  : RETURN_WINDOW_NOTE}
              </p>
            </section>

            <section className="rounded-md border border-border bg-surface p-4">
              <h2 className="text-sm font-bold uppercase tracking-wide">3. Evidence & notes</h2>
              <label className="mt-3 flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-sm border-2 border-dashed border-border py-6 text-sm text-muted-foreground hover:border-rani hover:text-rani">
                <Camera size={16} />
                <span>Add photos {reasonMeta.statutory ? "(required for statutory claims)" : "(optional)"}</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files && files.length > 0) {
                      toast.success(`${files.length} photo(s) attached as return evidence.`);
                    }
                  }}
                />
              </label>
              <textarea
                placeholder="Tell the seller what happened or why you are returning these items"
                className="mt-3 h-24 w-full rounded-sm border border-input bg-surface p-3 text-sm focus:border-primary focus:outline-none"
              />
            </section>

            <section className="rounded-md border border-gold/50 bg-cream p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Estimated refund</p>
                  <p className="font-display text-2xl font-bold text-rani">{formatAUD(refund)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Refunded to the original payment method after the return is received and checked.
                  </p>
                </div>
                <Button
                  variant="rani"
                  disabled={selected.length === 0}
                  onClick={() => {
                    setSubmitted(true);
                    toast.success("Return request submitted", {
                      description: "Return #RET-4501 created. Seller notified and return payout hold placed on ledger.",
                    });
                  }}
                >
                  Submit return request
                </Button>
              </div>
            </section>
          </div>
        )}
      </div>
    </ShopLayout>
  );
}

