import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Camera, Info } from "lucide-react";
import { ShopLayout } from "@/components/ism/ShopLayout";
import { Badge, Button } from "@/components/ism/SellerShell";
import { MASTER_ORDER, RETURN_REASONS } from "@/lib/ism-ops";
import { formatAUD } from "@/lib/ism-data";
import { createCustomerReturnRequestServerFn } from "@/lib/api/returns";
import { useAuth } from "@/hooks/use-auth";

type Search = { order?: string | undefined };

export const Route = createFileRoute("/returns/new")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    order: typeof search['order'] === "string" ? (search['order'] as string) : undefined,
  }),
  component: NewReturn,
});

function NewReturn() {
  const { user } = useAuth();
  const { order } = Route.useSearch();
  const sub = MASTER_ORDER.subOrders.find((s) => s.id === order) ?? MASTER_ORDER.subOrders[0]!;
  const [selected, setSelected] = useState<string[]>([sub.items[0]!.productId]);
  const [reason, setReason] = useState(RETURN_REASONS[0]!.id);
  const [submitted, setSubmitted] = useState(false);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

        {submitted ? (
          <div className="rounded-md border border-teal/40 bg-teal/5 p-6 text-center">
            <div className="mb-2">
              <Badge tone="teal">Request registered</Badge>
            </div>
            <h1 className="font-display text-2xl font-bold text-primary">Return requested</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              We have notified the seller and initiated the return process for sub-order {sub.id}.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <Link
                to="/orders/$id"
                params={{ id: MASTER_ORDER.id }}
                className="inline-flex items-center rounded-sm bg-rani px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-rani/90"
              >
                Back to order tracking
              </Link>
              <Link
                to="/account"
                className="inline-flex items-center rounded-sm border border-border bg-surface px-4 py-2 text-xs font-bold uppercase tracking-wide text-primary hover:border-rani hover:text-rani"
              >
                My Account
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-[1fr_320px]">
            <div className="space-y-6">
              <header>
                <h1 className="font-display text-2xl font-bold text-primary sm:text-3xl">
                  Request a return
                </h1>
                <p className="mt-1 text-xs text-muted-foreground">
                  Sub-order {sub.id} · Seller: {sub.seller} · Ordinary returns within 7 days of delivery under ACL.
                </p>
              </header>

              <section className="rounded-md border border-border bg-surface p-4">
                <h2 className="text-sm font-semibold text-primary">1. Select items to return</h2>
                <div className="mt-3 divide-y divide-border">
                  {sub.items.map((item) => {
                    const isSel = selected.includes(item.productId);
                    return (
                      <label
                        key={item.productId}
                        className="flex cursor-pointer items-center gap-3 py-2.5 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={(e) => {
                            if (e.target.checked) setSelected([...selected, item.productId]);
                            else setSelected(selected.filter((x) => x !== item.productId));
                          }}
                          className="size-4 rounded border-border text-rani focus:ring-rani"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-primary">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Qty: {item.qty} · {formatAUD(item.price)} each
                          </p>
                        </div>
                        <span className="font-semibold text-primary">
                          {formatAUD(item.price * item.qty)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-md border border-border bg-surface p-4">
                <h2 className="text-sm font-semibold text-primary">2. Reason for return</h2>
                <div className="mt-3 space-y-2">
                  {RETURN_REASONS.map((r) => (
                    <label
                      key={r.id}
                      className={`flex cursor-pointer items-start gap-2.5 rounded-sm border p-3 text-xs ${
                        reason === r.id
                          ? "border-rani bg-rani/5 text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-border/80"
                      }`}
                    >
                      <input
                        type="radio"
                        name="return_reason"
                        value={r.id}
                        checked={reason === r.id}
                        onChange={() => setReason(r.id)}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="font-semibold text-primary">{r.label}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {r.statutory ? "Statutory claim under ACL" : "Change of mind (within 7 days)"}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="mt-4">
                  <label className="text-xs font-semibold text-primary">
                    Additional notes / details
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Tell the seller what happened or why you are returning these items"
                    className="mt-1 w-full rounded-sm border border-border bg-background p-2 text-xs outline-none focus:border-rani"
                  />
                </div>
              </section>

              <section className="rounded-md border border-border bg-surface p-4">
                <h2 className="text-sm font-semibold text-primary">3. Photo evidence (optional)</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Required if claiming damaged in transit or faulty item.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="flex h-20 w-24 flex-col items-center justify-center gap-1 rounded-sm border border-dashed border-border bg-background text-[11px] text-muted-foreground hover:border-rani hover:text-rani"
                  >
                    <Camera size={18} />
                    <span>Add photo</span>
                  </button>
                </div>
              </section>
            </div>

            <section className="space-y-4">
              <div className="rounded-md border border-border bg-surface p-4">
                <h2 className="text-sm font-semibold text-primary">Return summary</h2>
                <dl className="mt-3 space-y-1.5 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <dt>Items selected</dt>
                    <dd>{selected.length}</dd>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <dt>Reason</dt>
                    <dd className="font-medium text-primary">{reasonMeta.label}</dd>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2 font-semibold text-primary">
                    <dt>Estimated refund</dt>
                    <dd className="text-rani">{formatAUD(refund)}</dd>
                  </div>
                </dl>
                <div className="mt-4 rounded-sm bg-muted/40 p-2.5 text-[11px] text-muted-foreground">
                  <p className="flex items-start gap-1">
                    <Info size={13} className="mt-0.5 shrink-0" />
                    Refunded to the original payment method after the return is received and checked.
                  </p>
                </div>
                <Button
                  variant="rani"
                  disabled={selected.length === 0 || isSubmitting}
                  className="w-full mt-4"
                  onClick={async () => {
                    if (!user) {
                      toast.error("Please sign in to submit a return request.");
                      return;
                    }
                    setIsSubmitting(true);
                    try {
                      const reasonMapping: Record<string, any> = {
                        "change-of-mind": "CHANGED_MIND",
                        "wrong-size": "WRONG_SIZE",
                        "wrong-item": "WRONG_ITEM",
                        "damaged": "DAMAGED_IN_TRANSIT",
                        "faulty": "DEFECTIVE_FAULTY",
                        "not-as-described": "NOT_AS_DESCRIBED",
                      };

                      await createCustomerReturnRequestServerFn({
                        data: {
                          subOrderId: sub.id,
                          orderItemId: selected[0] ?? sub.items[0]!.productId,
                          customerId: user.id,
                          quantity: 1,
                          reason: notes || reasonMeta.label,
                          reasonCode: reasonMapping[reason] ?? "CHANGED_MIND",
                        },
                      });

                      setSubmitted(true);
                      toast.success("Return request submitted", {
                        description: "Return request registered. Seller notified and payout hold placed on ledger.",
                      });
                    } catch (err: any) {
                      toast.error("Return request failed", { description: err.message });
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                >
                  {isSubmitting ? "Submitting..." : "Submit return request"}
                </Button>
              </div>
            </section>
          </div>
        )}
      </div>
    </ShopLayout>
  );
}
