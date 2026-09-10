import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Camera, Info, Loader2, X } from "lucide-react";
import { ShopLayout } from "@/components/ism/ShopLayout";
import { Badge, Button } from "@/components/ism/SellerShell";
import { RETURN_REASONS } from "@/lib/ism-ops";
import { formatAUD } from "@/lib/ism-data";
import {
  createCustomerReturnRequestServerFn,
  getReturnableOrderItemsServerFn,
  type ReturnableSubOrder,
} from "@/lib/api/returns";
import { uploadReturnEvidenceMedia } from "@/lib/api/storage";
import { useAuth } from "@/hooks/use-auth";

type Search = { order?: string | undefined };

const REASON_CODE_MAP: Record<string, "CHANGED_MIND" | "WRONG_SIZE" | "WRONG_ITEM" | "DAMAGED_IN_TRANSIT" | "DEFECTIVE_FAULTY" | "NOT_AS_DESCRIBED"> = {
  changed_mind: "CHANGED_MIND",
  wrong_size: "WRONG_SIZE",
  wrong_item: "WRONG_ITEM",
  damaged_transit: "DAMAGED_IN_TRANSIT",
  defective: "DEFECTIVE_FAULTY",
  not_as_described: "NOT_AS_DESCRIBED",
};

export const Route = createFileRoute("/returns/new")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    order: typeof search["order"] === "string" ? (search["order"] as string) : undefined,
  }),
  component: NewReturn,
});

function NewReturn() {
  const { user, loading: authLoading } = useAuth();
  const { order } = Route.useSearch();

  const [loading, setLoading] = useState(true);
  const [subOrders, setSubOrders] = useState<ReturnableSubOrder[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState(RETURN_REASONS[0]!.id);
  const [submitted, setSubmitted] = useState(false);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      if (!authLoading) setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getReturnableOrderItemsServerFn({ data: { subOrderId: order } })
      .then((rows) => {
        if (cancelled) return;
        setSubOrders(rows);
        setSelected(rows[0]?.items[0] ? [rows[0].items[0].orderItemId] : []);
      })
      .catch((err) => {
        console.error("Failed to load returnable order items:", err);
        if (!cancelled) setSubOrders([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, authLoading, order]);

  const sub = subOrders[0];
  const reasonMeta = RETURN_REASONS.find((r) => r.id === reason)!;
  const refund = (sub?.items ?? [])
    .filter((i) => selected.includes(i.orderItemId))
    .reduce((n, i) => n + i.unitPrice * i.quantity, 0);

  if (authLoading || loading) {
    return (
      <ShopLayout>
        <div className="mx-auto flex max-w-4xl items-center justify-center px-3 py-24 sm:px-4">
          <Loader2 className="animate-spin text-rani" size={24} />
        </div>
      </ShopLayout>
    );
  }

  if (!user) {
    return (
      <ShopLayout>
        <div className="mx-auto max-w-4xl px-3 py-16 text-center sm:px-4">
          <h1 className="font-display text-2xl font-bold text-primary">Sign in required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Please sign in to request a return on your order.
          </p>
          <Link
            to="/signin"
            className="mt-4 inline-flex items-center rounded-sm bg-rani px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-rani/90"
          >
            Sign in
          </Link>
        </div>
      </ShopLayout>
    );
  }

  if (!sub) {
    return (
      <ShopLayout>
        <div className="mx-auto max-w-4xl px-3 py-16 text-center sm:px-4">
          <h1 className="font-display text-2xl font-bold text-primary">No eligible orders</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We couldn't find a delivered package eligible for a return request. Returns can only
            be requested once a package has been marked delivered.
          </p>
          <Link
            to="/account"
            className="mt-4 inline-flex items-center rounded-sm border border-border bg-surface px-4 py-2 text-xs font-bold uppercase tracking-wide text-primary hover:border-rani hover:text-rani"
          >
            Back to My Account
          </Link>
        </div>
      </ShopLayout>
    );
  }

  return (
    <ShopLayout>
      <div className="mx-auto max-w-4xl px-3 py-6 sm:px-4">
        <nav className="mb-3 text-xs text-muted-foreground">
          <Link to="/account" className="hover:text-rani">
            My Account
          </Link>{" "}
          /{" "}
          <Link to="/orders/$id" params={{ id: sub.masterOrderId }} className="hover:text-rani">
            #{sub.masterOrderId}
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
              We have notified the seller and initiated the return process for sub-order{" "}
              {sub.subOrderId}.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <Link
                to="/orders/$id"
                params={{ id: sub.masterOrderId }}
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
                  Sub-order {sub.subOrderId} · Seller: {sub.sellerName} · Ordinary returns within
                  7 days of delivery under ACL.
                </p>
              </header>

              <section className="rounded-md border border-border bg-surface p-4">
                <h2 className="text-sm font-semibold text-primary">1. Select items to return</h2>
                <div className="mt-3 divide-y divide-border">
                  {sub.items.map((item) => {
                    const isSel = selected.includes(item.orderItemId);
                    return (
                      <label
                        key={item.orderItemId}
                        className="flex cursor-pointer items-center gap-3 py-2.5 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={(e) => {
                            if (e.target.checked) setSelected([...selected, item.orderItemId]);
                            else setSelected(selected.filter((x) => x !== item.orderItemId));
                          }}
                          className="size-4 rounded border-border text-rani focus:ring-rani"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-primary">{item.productName}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.variantName} · Qty: {item.quantity} · {formatAUD(item.unitPrice)}{" "}
                            each
                          </p>
                        </div>
                        <span className="font-semibold text-primary">
                          {formatAUD(item.unitPrice * item.quantity)}
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
                          {r.statutory
                            ? "Statutory claim under ACL"
                            : "Change of mind (within 7 days)"}
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
                  {evidenceFiles.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      className="relative flex h-20 w-24 flex-col items-center justify-center gap-1 overflow-hidden rounded-sm border border-border bg-background text-[10px] text-muted-foreground"
                    >
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setEvidenceFiles(evidenceFiles.filter((_, i) => i !== idx))}
                        className="absolute right-1 top-1 z-10 grid size-5 place-items-center rounded-full bg-ink/75 text-surface"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  <label className="flex h-20 w-24 flex-col items-center justify-center gap-1 rounded-sm border border-dashed border-border bg-background text-[11px] text-muted-foreground hover:border-rani hover:text-rani">
                    <Camera size={18} />
                    <span>Add photo</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setEvidenceFiles([...evidenceFiles, file]);
                        e.target.value = "";
                      }}
                    />
                  </label>
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
                    Refunded to the original payment method after the return is received and
                    checked.
                  </p>
                </div>
                <Button
                  variant="rani"
                  disabled={selected.length === 0 || isSubmitting || isUploadingEvidence}
                  className="w-full mt-4"
                  onClick={async () => {
                    if (!user) {
                      toast.error("Please sign in to submit a return request.");
                      return;
                    }
                    setIsSubmitting(true);
                    try {
                      let evidenceUrls: string[] = [];
                      if (evidenceFiles.length > 0) {
                        setIsUploadingEvidence(true);
                        evidenceUrls = await Promise.all(
                          evidenceFiles.map((file) => uploadReturnEvidenceMedia(file)),
                        );
                        setIsUploadingEvidence(false);
                      }

                      const selectedItems = sub.items.filter((i) =>
                        selected.includes(i.orderItemId),
                      );

                      await createCustomerReturnRequestServerFn({
                        data: {
                          subOrderId: sub.subOrderId,
                          items: selectedItems.map((i) => ({
                            orderItemId: i.orderItemId,
                            quantity: i.quantity,
                          })),
                          customerId: user.id,
                          reason: notes || reasonMeta.label,
                          reasonCode: REASON_CODE_MAP[reason] ?? "CHANGED_MIND",
                          customerNotes: notes || undefined,
                          evidenceUrls: evidenceUrls.length > 0 ? evidenceUrls : undefined,
                        },
                      });

                      setSubmitted(true);
                      toast.success("Return request submitted", {
                        description:
                          "Return request registered. Seller notified and payout hold placed on ledger.",
                      });
                    } catch (err: any) {
                      toast.error("Return request failed", { description: err.message });
                    } finally {
                      setIsSubmitting(false);
                      setIsUploadingEvidence(false);
                    }
                  }}
                >
                  {isUploadingEvidence
                    ? "Uploading evidence..."
                    : isSubmitting
                      ? "Submitting..."
                      : "Submit return request"}
                </Button>
              </div>
            </section>
          </div>
        )}
      </div>
    </ShopLayout>
  );
}
