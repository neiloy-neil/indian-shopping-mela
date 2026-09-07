import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Check, MapPin, Package, ShieldCheck, Truck, XCircle } from "lucide-react";
import { ShopLayout } from "@/components/ism/ShopLayout";
import { Badge, Button } from "@/components/ism/SellerShell";
import { DEMO_NOTE, MASTER_ORDER, RETURN_WINDOW_NOTE } from "@/lib/ism-ops";
import { formatAUD } from "@/lib/ism-data";
import { cancelCustomerSubOrderServerFn, getOrderTrackingDetailsServerFn } from "@/lib/api/orders";

export const Route = createFileRoute("/orders/$id")({
  head: () => ({
    meta: [
      { title: "Order tracking — Indian Shopping Mela" },
      {
        name: "description",
        content:
          "Track a multi-seller ISM order: one payment, separate seller packages, live status timeline, cancellation and returns.",
      },
      { property: "og:title", content: "Order tracking — Indian Shopping Mela" },
      {
        property: "og:description",
        content: "Master order and seller sub-orders with package-level tracking across Australia.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async ({ params }) => {
    try {
      const data = await getOrderTrackingDetailsServerFn({ data: { orderId: params.id } });
      return { order: data };
    } catch {
      return { order: null };
    }
  },
  component: OrderDetail,
});

function OrderDetail() {
  const { id } = Route.useParams();
  const loaderData = Route.useLoaderData();
  const [orderState, setOrderState] = useState(loaderData?.order ?? MASTER_ORDER);
  const [cancellingSubOrderId, setCancellingSubOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (loaderData?.order) {
      setOrderState(loaderData.order);
    }
  }, [loaderData?.order]);

  const handleCancelSubOrder = async (subOrderId: string) => {
    if (!cancelReason.trim()) {
      toast.error("Please provide a reason for cancellation.");
      return;
    }

    setIsCancelling(true);
    try {
      const res = await cancelCustomerSubOrderServerFn({
        data: { subOrderId, reason: cancelReason },
      });

      if (res.success) {
        setOrderState((prev: any) => ({
          ...prev,
          subOrders: prev.subOrders.map((so: any) =>
            so.id === subOrderId
              ? {
                  ...so,
                  status: "CANCELLED" as any,
                  canCancel: false,
                  payout: "Cancelled — refund processing",
                  timeline: [
                    ...so.timeline,
                    {
                      label: "Package Cancelled by Customer",
                      at: new Date().toLocaleDateString("en-AU"),
                      done: true,
                      note: `Reason: ${cancelReason}`,
                    },
                  ],
                }
              : so
          ),
        }));
        toast.success(`Package ${subOrderId} cancelled`, {
          description: "Inventory has been released and refund will be processed to original card.",
        });
        setCancellingSubOrderId(null);
        setCancelReason("");
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error("Cancellation failed", { description: err.message });
    } finally {
      setIsCancelling(false);
    }
  };

  const o = orderState;

  return (
    <ShopLayout>
      <div className="mx-auto max-w-6xl px-3 py-6 sm:px-4 lg:px-6">
        <nav className="mb-3 text-xs text-muted-foreground">
          <Link to="/account" className="hover:text-rani">
            My Account
          </Link>{" "}
          / Orders / #{id.toUpperCase()}
        </nav>

        <header className="rounded-md border border-gold/50 bg-cream p-4 sm:p-5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-xl font-bold text-primary sm:text-2xl">
                Order #{o.id}
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground">Placed {o.placed}</p>
              <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                <Badge tone="teal">
                  <ShieldCheck size={12} /> {o.payment}
                </Badge>
                <Badge tone="primary">{o.subOrders.length} seller packages</Badge>
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Order total</p>
              <p className="font-display text-2xl font-bold text-rani">{formatAUD(o.total)}</p>
              <p className="text-[11px] text-muted-foreground">incl. GST {formatAUD(o.gst)}</p>
            </div>
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
            <MapPin size={13} className="mt-0.5 shrink-0" /> {o.address}
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">{o.paymentNote}</p>
        </header>

        <div className="mt-5 space-y-4">
          {o.subOrders.map((s: any) => (
            <section key={s.id} className="rounded-md border border-border bg-surface">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-border p-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-rani">
                    {s.packageLabel} · Sub-order {s.id}
                  </p>
                  <Link
                    to="/seller/$slug"
                    params={{ slug: s.sellerSlug }}
                    className="font-display text-lg font-semibold text-primary hover:text-rani"
                  >
                    {s.seller}
                  </Link>
                  <p className="text-xs text-muted-foreground">Ships from {s.origin}</p>
                </div>
                <div className="shrink-0 text-right">
                  <Badge
                    tone={
                      s.status === "DELIVERED"
                        ? "teal"
                        : s.status === "IN_TRANSIT"
                          ? "primary"
                          : s.status === "CANCELLED"
                            ? "neutral"
                            : "marigold"
                    }
                  >
                    {s.status.replace(/_/g, " ")}
                  </Badge>
                  <p className="mt-1 text-[11px] text-muted-foreground">{s.eta}</p>
                </div>
              </div>

              <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                <div>
                  <ul className="divide-y divide-border text-sm">
                    {s.items.map((it: any) => (
                      <li key={it.productId} className="flex items-start justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <Link
                            to="/product/$id"
                            params={{ id: it.productId }}
                            className="font-medium hover:text-rani"
                          >
                            {it.name}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {it.variant} · Qty {it.qty}
                          </p>
                        </div>
                        <span className="shrink-0 font-semibold">{formatAUD(it.price * it.qty)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <p className="flex items-center gap-1.5">
                      <Truck size={13} /> {s.carrier} · {s.service}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Package size={13} /> Tracking {s.tracking} · Shipping {formatAUD(s.shipping)}
                    </p>
                    <p>Payout state: {s.payout}</p>
                  </div>

                  {cancellingSubOrderId === s.id ? (
                    <div className="mt-3 rounded-sm border border-marigold/50 bg-marigold/10 p-3 space-y-2">
                      <p className="text-xs font-semibold text-foreground">Cancel Package {s.id}</p>
                      <input
                        type="text"
                        placeholder="Reason for cancellation (e.g. ordered by mistake)"
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        className="w-full rounded-sm border border-input bg-surface p-2 text-xs"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="rani"
                          onClick={() => handleCancelSubOrder(s.id)}
                        >
                          Confirm Cancellation
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setCancellingSubOrderId(null)}
                        >
                          Keep Order
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        disabled={!s.canCancel}
                        onClick={() => setCancellingSubOrderId(s.id)}
                      >
                        Cancel this package
                      </Button>
                      {s.canReturn ? (
                        <Link
                          to="/returns/new"
                          search={{ order: s.id }}
                          className="inline-flex items-center rounded-sm bg-rani px-4 py-2 text-xs font-bold uppercase tracking-wide text-rani-foreground"
                        >
                          Return an item
                        </Link>
                      ) : (
                        <Button variant="ghost" disabled>
                          {s.status === "CANCELLED" ? "Package cancelled" : "Return available after delivery"}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        onClick={() => {
                          const invoiceWindow = window.open("", "_blank");
                          if (invoiceWindow) {
                            invoiceWindow.document.write(
                              `<html><head><title>Tax Invoice - ${o.id}</title></head><body style="font-family: sans-serif; padding: 40px;"><h2>Indian Shopping Mela — Tax Invoice</h2><p><strong>Order #:</strong> ${o.id}</p><p><strong>Sub-Order:</strong> ${s.id}</p><p><strong>Seller:</strong> ${s.seller}</p><p><strong>Total:</strong> ${formatAUD(s.items.reduce((acc: number, i: any) => acc + i.price * i.qty, 0) + s.shipping)} (GST incl.)</p></body></html>`
                            );
                            invoiceWindow.document.close();
                          }
                        }}
                      >
                        Tax invoice
                      </Button>
                    </div>
                  )}
                </div>

                <ol className="space-y-2.5 rounded-sm border border-border bg-cream/60 p-3.5">
                  {s.timeline.map((t: any) => (
                    <li key={t.label} className="flex gap-2.5 text-sm">
                      <span
                        className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full ${
                          t.done ? "bg-teal text-teal-foreground" : "border border-border bg-surface"
                        }`}
                      >
                        {t.done && <Check size={10} />}
                      </span>
                      <span className="min-w-0">
                        <span className={`block font-medium ${t.done ? "" : "text-muted-foreground"}`}>
                          {t.label}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          {t.at}
                          {t.note ? ` · ${t.note}` : ""}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          ))}
        </div>

        <section className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-md border border-border bg-surface p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide">Payment summary</h2>
            <dl className="mt-3 space-y-1.5 text-sm">
              {[
                ["Items", formatAUD(o.itemsTotal)],
                ["Shipping (all sellers)", formatAUD(o.shippingTotal)],
                ["GST included", formatAUD(o.gst)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-muted-foreground">
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
              <div className="flex justify-between border-t border-border pt-2 font-display text-lg font-bold text-primary">
                <dt>One total paid</dt>
                <dd>{formatAUD(o.total)}</dd>
              </div>
            </dl>
          </div>
          <div className="rounded-md border border-border bg-surface p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide">Returns & cancellations</h2>
            <p className="mt-2 text-sm text-muted-foreground">{RETURN_WINDOW_NOTE}</p>
            <p className="mt-2 text-xs text-muted-foreground">{DEMO_NOTE}</p>
          </div>
        </section>
      </div>
    </ShopLayout>
  );
}

