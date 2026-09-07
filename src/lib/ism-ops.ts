// Prototype operations data for Indian Shopping Mela.
// All values below are DEMO DATA for the marketplace prototype — no live
// payment, shipping or messaging provider is connected.

export const DEMO_NOTE =
  "Demo data — prototype only. No live payment, shipping or messaging provider is connected.";

export type Tone = "ok" | "warn" | "info" | "muted" | "bad";

/* ------------------------------------------------------------------ roles */

export type Role = "customer" | "seller_owner" | "seller_staff" | "admin";

export const SELLER_PERMISSIONS = [
  { id: "products", label: "Products", note: "Create, edit and submit listings" },
  { id: "inventory", label: "Inventory", note: "Stock levels and bulk stock updates" },
  { id: "orders", label: "Orders", note: "Accept, prepare and fulfil sub-orders" },
  { id: "shipping", label: "Shipping", note: "Labels, pickups and tracking" },
  { id: "returns", label: "Returns", note: "Approve, reject and receive returns" },
  { id: "promotions", label: "Promotions", note: "Seller coupons and campaign opt-ins" },
  { id: "reports", label: "Reports", note: "Sales, product and returns reporting" },
  { id: "store", label: "Store Settings", note: "Profile, policies, holiday mode" },
  { id: "finance", label: "Finance", note: "Payouts, statements and bank details" },
] as const;

export type SellerPermission = (typeof SELLER_PERMISSIONS)[number]["id"];

export type StaffMember = {
  name: string;
  email: string;
  role: "Owner" | "Manager" | "Dispatch" | "Finance";
  status: "Active" | "Invited" | "Suspended";
  mfa: boolean;
  permissions: SellerPermission[];
};

export const SELLER_STAFF: StaffMember[] = [
  {
    name: "Meera Shah",
    email: "meera@mumbaimirror.demo",
    role: "Owner",
    status: "Active",
    mfa: true,
    permissions: SELLER_PERMISSIONS.map((p) => p.id),
  },
  {
    name: "Karan Patel",
    email: "karan@mumbaimirror.demo",
    role: "Manager",
    status: "Active",
    mfa: true,
    permissions: ["products", "inventory", "orders", "shipping", "returns", "promotions", "reports"],
  },
  {
    name: "Simran Kaur",
    email: "simran@mumbaimirror.demo",
    role: "Dispatch",
    status: "Active",
    mfa: false,
    permissions: ["orders", "shipping", "inventory"],
  },
  {
    name: "Anil Rao",
    email: "anil@mumbaimirror.demo",
    role: "Finance",
    status: "Invited",
    mfa: false,
    permissions: ["finance", "reports"],
  },
];

/* ------------------------------------------------------- seller onboarding */

export const ONBOARDING_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "INFO_REQUIRED",
  "APPROVED",
  "REJECTED",
  "SUSPENDED",
] as const;
export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];

export const SELLER_AGREEMENTS = [
  "ISM Seller Agreement",
  "Commission schedule (category based)",
  "Shipping & dispatch standards",
  "Returns & refunds policy",
  "Prohibited products policy",
  "Payout terms (eligible 14 days after confirmed delivery)",
];

export const POST_APPROVAL_CHECKLIST = [
  { label: "Complete store profile, logo and banner", done: true },
  { label: "Set dispatch address and handling time", done: true },
  { label: "Confirm payout provider details", done: false },
  { label: "Publish first 5 listings (single or bulk)", done: false },
  { label: "Add shipping profiles for AU zones", done: false },
  { label: "Review return address and policy", done: false },
];

/* ------------------------------------------------------------ order model */

export const ORDER_STATUS_GROUPS: { group: string; statuses: string[] }[] = [
  { group: "Payment", statuses: ["PAYMENT_PENDING", "PAYMENT_FAILED", "PAID"] },
  {
    group: "Fulfilment",
    statuses: [
      "ORDER_CREATED",
      "SELLER_NOTIFIED",
      "SELLER_ACCEPTED",
      "PREPARING",
      "READY_TO_SHIP",
    ],
  },
  {
    group: "Shipping",
    statuses: [
      "LABEL_CREATED",
      "PICKUP_SCHEDULED",
      "SHIPPED",
      "IN_TRANSIT",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
    ],
  },
  {
    group: "Returns",
    statuses: [
      "RETURN_REQUESTED",
      "RETURN_APPROVED",
      "RETURN_IN_TRANSIT",
      "RETURN_RECEIVED",
      "REFUND_PENDING",
      "REFUNDED",
    ],
  },
  {
    group: "Payout",
    statuses: ["PAYOUT_HOLD", "PAYOUT_ELIGIBLE", "PAYOUT_PROCESSING", "PAID_TO_SELLER"],
  },
  { group: "Exceptions", statuses: ["CANCELLED", "DISPUTED"] },
];

export type SubOrder = {
  id: string;
  seller: string;
  sellerSlug: string;
  origin: string;
  status: string;
  packageLabel: string;
  carrier: string;
  tracking: string;
  service: string;
  eta: string;
  items: { name: string; productId: string; variant: string; qty: number; price: number }[];
  shipping: number;
  timeline: { label: string; at: string; done: boolean; note?: string }[];
  canCancel: boolean;
  canReturn: boolean;
  payout: string;
};

export const MASTER_ORDER = {
  id: "ISM10001",
  placed: "24 Aug 2026, 7:42pm AEST",
  payment: "PAID · Provider-confirmed (demo) · auth ref PSP_8842A",
  paymentNote:
    "Payment is marked paid only after the provider confirms the charge server-side. Front-end success alone never releases an order.",
  address: "Priya Sharma · 14 Wigram St, Harris Park NSW 2150, Australia",
  itemsTotal: 386,
  shippingTotal: 26,
  gst: 37.45,
  total: 412,
  subOrders: [
    {
      id: "ISM10001-A",
      seller: "Mumbai Mirror Boutique",
      sellerSlug: "mumbai-mirror-boutique",
      origin: "Harris Park, NSW",
      status: "DELIVERED",
      packageLabel: "Package 1 of 3",
      carrier: "Australia Post eParcel (demo)",
      tracking: "AP-DEMO-77120045",
      service: "Standard 4–7 business days",
      eta: "Delivered 28 Aug 2026",
      items: [
        {
          name: "Banarasi Silk Saree — Rani Pink",
          productId: "ism-1001",
          variant: "Free Size · Rani Pink",
          qty: 1,
          price: 189,
        },
      ],
      shipping: 0,
      canCancel: false,
      canReturn: true,
      payout: "PAYOUT_ELIGIBLE from 11 Sep 2026 (delivery + 14 days)",
      timeline: [
        { label: "Order created", at: "24 Aug, 7:42pm", done: true },
        { label: "Seller notified", at: "24 Aug, 7:42pm", done: true },
        { label: "Seller accepted", at: "24 Aug, 8:10pm", done: true },
        { label: "Preparing", at: "25 Aug, 9:05am", done: true },
        { label: "Label created", at: "25 Aug, 2:20pm", done: true },
        { label: "Shipped", at: "26 Aug, 8:15am", done: true },
        { label: "Out for delivery", at: "28 Aug, 7:05am", done: true },
        { label: "Delivered", at: "28 Aug, 1:12pm", done: true, note: "Left in a safe place — photo POD on file" },
      ],
    },
    {
      id: "ISM10001-B",
      seller: "Jaipur Jewel House",
      sellerSlug: "jaipur-jewel-house",
      origin: "Melbourne, VIC",
      status: "IN_TRANSIT",
      packageLabel: "Package 2 of 3",
      carrier: "Sendle (demo)",
      tracking: "SND-DEMO-4419021",
      service: "Standard 3–6 business days",
      eta: "Estimated 3 Sep 2026",
      items: [
        {
          name: "Oxidised Silver Jhumkas",
          productId: "ism-2003",
          variant: "Silver",
          qty: 2,
          price: 49,
        },
      ],
      shipping: 9.95,
      canCancel: false,
      canReturn: false,
      payout: "PAYOUT_HOLD until delivery is confirmed",
      timeline: [
        { label: "Order created", at: "24 Aug, 7:42pm", done: true },
        { label: "Seller accepted", at: "24 Aug, 9:33pm", done: true },
        { label: "Ready to ship", at: "26 Aug, 10:00am", done: true },
        { label: "Label created", at: "26 Aug, 10:04am", done: true },
        { label: "Shipped", at: "27 Aug, 6:40pm", done: true },
        { label: "In transit", at: "31 Aug, 4:12am", done: true, note: "Processed at Melbourne facility" },
        { label: "Out for delivery", at: "—", done: false },
        { label: "Delivered", at: "—", done: false },
      ],
    },
    {
      id: "ISM10001-C",
      seller: "Desi Ghar Homewares",
      sellerSlug: "desi-ghar-homewares",
      origin: "Brisbane, QLD",
      status: "PREPARING",
      packageLabel: "Package 3 of 3",
      carrier: "Not yet assigned",
      tracking: "—",
      service: "Standard 4–7 business days",
      eta: "Dispatch by 2 Sep 2026",
      items: [
        {
          name: "Jaipuri Cotton Double Bedsheet Set",
          productId: "ism-6001",
          variant: "Queen · Indigo",
          qty: 1,
          price: 79,
        },
        { name: "Brass Pooja Thali Set", productId: "ism-7001", variant: "Standard", qty: 1, price: 69 },
      ],
      shipping: 16.05,
      canCancel: true,
      canReturn: false,
      payout: "PAYOUT_HOLD",
      timeline: [
        { label: "Order created", at: "24 Aug, 7:42pm", done: true },
        { label: "Seller accepted", at: "25 Aug, 8:02am", done: true },
        { label: "Preparing", at: "31 Aug, 11:20am", done: true },
        { label: "Ready to ship", at: "—", done: false },
        { label: "Shipped", at: "—", done: false },
        { label: "Delivered", at: "—", done: false },
      ],
    },
  ] as SubOrder[],
};

/* ------------------------------------------------------- returns / refunds */

export const RETURN_REASONS = [
  { id: "changed_mind", label: "Changed my mind", statutory: false },
  { id: "wrong_size", label: "Wrong size", statutory: false },
  { id: "wrong_item", label: "Wrong item received", statutory: true },
  { id: "damaged_transit", label: "Damaged in transit", statutory: true },
  { id: "defective", label: "Defective / faulty", statutory: true },
  { id: "not_as_described", label: "Not as described", statutory: true },
];

export const RETURN_WINDOW_NOTE =
  "Change-of-mind returns can be requested within 7 days of confirmed delivery, where the seller's policy allows. Faulty, damaged, wrong or not-as-described items are handled separately under Australian Consumer Law and are not limited by that 7-day window.";

export const RETURNS_QUEUE = [
  {
    id: "RET-4412",
    order: "ISM10001-A",
    product: "Banarasi Silk Saree",
    reason: "Wrong size",
    stage: "RETURN_APPROVED",
    refund: 189,
    partial: false,
    tone: "info" as Tone,
  },
  {
    id: "RET-4390",
    order: "ISM09984-B",
    product: "Oxidised Jhumkas (1 of 2)",
    reason: "Damaged in transit",
    stage: "RETURN_RECEIVED",
    refund: 49,
    partial: true,
    tone: "warn" as Tone,
  },
  {
    id: "RET-4381",
    order: "ISM09960-A",
    product: "Kids Lehenga",
    reason: "Not as described",
    stage: "REFUND_PENDING",
    refund: 119,
    partial: false,
    tone: "warn" as Tone,
  },
  {
    id: "RET-4356",
    order: "ISM09931-C",
    product: "Chikankari Kurta Set",
    reason: "Changed my mind",
    stage: "RETURN_IN_TRANSIT",
    refund: 99,
    partial: false,
    tone: "muted" as Tone,
  },
];

/* ------------------------------------------------------------- finance */

export const LEDGER_TYPES = [
  "Customer Charge",
  "Seller Gross",
  "ISM Commission",
  "Payment Processing",
  "Shipping Charge",
  "Shipping Cost",
  "Refund",
  "Adjustment",
  "Payout",
] as const;

export type LedgerRow = {
  ref: string;
  type: (typeof LEDGER_TYPES)[number];
  amount: number;
  order: string;
  seller: string;
  at: string;
  status: "Posted" | "Pending" | "Reversed" | "Held";
  source: string;
};

export const LEDGER: LedgerRow[] = [
  { ref: "TXN-2026-0009812", type: "Customer Charge", amount: 412, order: "ISM10001", seller: "—", at: "24 Aug 2026 19:42", status: "Posted", source: "Payment provider (demo)" },
  { ref: "TXN-2026-0009813", type: "Payment Processing", amount: -7.02, order: "ISM10001", seller: "—", at: "24 Aug 2026 19:42", status: "Posted", source: "Payment provider (demo)" },
  { ref: "TXN-2026-0009814", type: "Seller Gross", amount: 189, order: "ISM10001-A", seller: "Mumbai Mirror Boutique", at: "24 Aug 2026 19:42", status: "Posted", source: "Ledger engine" },
  { ref: "TXN-2026-0009815", type: "ISM Commission", amount: -15.12, order: "ISM10001-A", seller: "Mumbai Mirror Boutique", at: "24 Aug 2026 19:42", status: "Posted", source: "Ledger engine" },
  { ref: "TXN-2026-0009816", type: "Shipping Charge", amount: 26, order: "ISM10001", seller: "—", at: "24 Aug 2026 19:42", status: "Posted", source: "Checkout" },
  { ref: "TXN-2026-0009817", type: "Shipping Cost", amount: -21.4, order: "ISM10001-B", seller: "Jaipur Jewel House", at: "27 Aug 2026 18:40", status: "Posted", source: "Carrier (demo)" },
  { ref: "TXN-2026-0009901", type: "Refund", amount: -49, order: "ISM09984-B", seller: "Jaipur Jewel House", at: "29 Aug 2026 10:05", status: "Posted", source: "Return RET-4390" },
  { ref: "TXN-2026-0009902", type: "Adjustment", amount: -12.5, order: "ISM09984-B", seller: "Jaipur Jewel House", at: "29 Aug 2026 10:06", status: "Posted", source: "Post-payout recovery" },
  { ref: "TXN-2026-0009950", type: "Payout", amount: -4182.4, order: "BATCH-PO-2026-36", seller: "Mumbai Mirror Boutique", at: "29 Aug 2026 17:00", status: "Pending", source: "Payout batch (demo)" },
  { ref: "TXN-2026-0009951", type: "Payout", amount: -1620, order: "BATCH-PO-2026-36", seller: "Sydney Silk Studio", at: "29 Aug 2026 17:00", status: "Held", source: "Manual hold — open dispute" },
];

export const PAYOUT_STAGES = [
  { stage: "Pending", note: "Order paid, delivery not yet confirmed", amount: 2905.1, tone: "muted" as Tone },
  { stage: "On Hold", note: "Open return, dispute, chargeback or fraud review", amount: 318, tone: "warn" as Tone },
  { stage: "Eligible", note: "Confirmed delivery + 14 days, no open issues", amount: 4182.4, tone: "ok" as Tone },
  { stage: "Processing", note: "Included in the current payout batch", amount: 1240, tone: "info" as Tone },
  { stage: "Paid", note: "Settled to the seller's payout account", amount: 186340, tone: "muted" as Tone },
];

export const PAYOUT_RULE =
  "Payout eligibility = confirmed delivery + 14 days, provided there is no open return, dispute, chargeback or fraud hold. Refunds raised after a payout create a recovery adjustment against the next payout, which can show as a temporary negative balance.";

/* ------------------------------------------------------- notifications */

export const NOTIFICATIONS = [
  { event: "Payment confirmed", audience: "Customer", channel: "Email + in-app", status: "Sent", at: "24 Aug 19:42", attempts: 1 },
  { event: "Payment failed", audience: "Customer", channel: "Email", status: "Sent", at: "24 Aug 19:38", attempts: 2 },
  { event: "New order", audience: "Seller", channel: "Email + dashboard", status: "Sent", at: "24 Aug 19:42", attempts: 1 },
  { event: "Seller accepted", audience: "Customer", channel: "In-app", status: "Sent", at: "24 Aug 20:10", attempts: 1 },
  { event: "Label created", audience: "Seller", channel: "Dashboard", status: "Sent", at: "25 Aug 14:20", attempts: 1 },
  { event: "Shipped", audience: "Customer", channel: "Email + SMS", status: "Sent", at: "26 Aug 08:15", attempts: 1 },
  { event: "Out for delivery", audience: "Customer", channel: "SMS", status: "Retrying", at: "28 Aug 07:05", attempts: 2 },
  { event: "Delivered", audience: "Customer", channel: "Email", status: "Sent", at: "28 Aug 13:12", attempts: 1 },
  { event: "Return approved", audience: "Customer + Seller", channel: "Email", status: "Sent", at: "29 Aug 09:20", attempts: 1 },
  { event: "Refund issued", audience: "Customer", channel: "Email", status: "Failed", at: "29 Aug 10:05", attempts: 3 },
  { event: "Payout paid", audience: "Seller", channel: "Email", status: "Queued", at: "—", attempts: 0 },
];

/* -------------------------------------------------------- integrations */

export const INTEGRATIONS = [
  { name: "Payment provider", area: "Payments", state: "Not connected (adapter ready)", events: "charge.succeeded, charge.failed, refund.created", tone: "warn" as Tone },
  { name: "Carrier / shipping", area: "Shipping", state: "Not connected (adapter ready)", events: "shipment.created, label.ready, tracking.update", tone: "warn" as Tone },
  { name: "Media pipeline", area: "Product video", state: "Not connected (adapter ready)", events: "upload.complete, transcode.done, safety.flagged", tone: "warn" as Tone },
  { name: "Notification service", area: "Email / SMS", state: "Not connected (adapter ready)", events: "message.delivered, message.bounced", tone: "warn" as Tone },
];

export const WEBHOOK_EVENTS = [
  { id: "evt_demo_9a71", provider: "Payments", type: "charge.succeeded", received: "24 Aug 19:42", signature: "Verified (demo)", state: "Processed", attempts: 1 },
  { id: "evt_demo_9a83", provider: "Payments", type: "refund.created", received: "29 Aug 10:05", signature: "Verified (demo)", state: "Processed", attempts: 1 },
  { id: "evt_demo_4c19", provider: "Shipping", type: "tracking.update", received: "31 Aug 04:12", signature: "Verified (demo)", state: "Processed", attempts: 1 },
  { id: "evt_demo_4c22", provider: "Shipping", type: "label.ready", received: "31 Aug 09:41", signature: "Failed (demo)", state: "Failed", attempts: 3 },
  { id: "evt_demo_7f30", provider: "Media", type: "transcode.done", received: "31 Aug 11:02", signature: "Verified (demo)", state: "Retrying", attempts: 2 },
];

/* --------------------------------------------------------------- audit */

export const AUDIT_LOG = [
  { at: "31 Aug 2026 12:04", actor: "admin@ism.demo", role: "Super Admin", action: "PAYOUT_HOLD_APPLIED", target: "Sydney Silk Studio", detail: "Reason: open dispute over $500", ip: "203.0.113.4" },
  { at: "31 Aug 2026 11:20", actor: "finance@ism.demo", role: "Finance Admin", action: "ADJUSTMENT_POSTED", target: "TXN-2026-0009902", detail: "Post-payout refund recovery -$12.50", ip: "203.0.113.9" },
  { at: "30 Aug 2026 17:48", actor: "ops@ism.demo", role: "Catalogue Admin", action: "PRODUCT_REJECTED", target: "ism-3110", detail: "Restricted keyword in title", ip: "203.0.113.22" },
  { at: "30 Aug 2026 09:12", actor: "admin@ism.demo", role: "Super Admin", action: "SELLER_APPROVED", target: "Desi Ghar Homewares", detail: "ABN and dispatch address verified", ip: "203.0.113.4" },
  { at: "29 Aug 2026 15:31", actor: "meera@mumbaimirror.demo", role: "Seller Owner", action: "STAFF_PERMISSION_CHANGED", target: "simran@mumbaimirror.demo", detail: "Granted: inventory", ip: "198.51.100.14" },
];

/* ----------------------------------------------------- launch readiness */

// Four honest readiness states. UI existing is NOT the same as done.
export const READINESS = {
  PROTOTYPE: "PROTOTYPE COMPLETE",
  PARTIAL: "PARTIAL",
  BACKEND: "BACKEND/INTEGRATION REQUIRED",
  MISSING: "MISSING",
} as const;
export type Readiness = (typeof READINESS)[keyof typeof READINESS];

export const READINESS_LEGEND: { state: Readiness; tone: Tone; meaning: string }[] = [
  { state: READINESS.PROTOTYPE, tone: "ok", meaning: "Flow, screens and demo state fully represent the intended behaviour." },
  { state: READINESS.PARTIAL, tone: "info", meaning: "Some screens or states exist; the flow is not yet end-to-end." },
  { state: READINESS.BACKEND, tone: "warn", meaning: "Server-authoritative logic, security or a live provider is required. Not done." },
  { state: READINESS.MISSING, tone: "bad", meaning: "Not represented anywhere in the prototype yet." },
];

export const LAUNCH_CHECKLIST: {
  area: string;
  scenario: string;
  state: Readiness;
  note?: string;
}[] = [
  { area: "Seller onboarding", scenario: "Draft → submitted → under review → approved, with ABN, dispatch/return address and agreements", state: READINESS.PROTOTYPE },
  { area: "ABN / identity verification", scenario: "ABR lookup, ID document check, sanctions screening", state: READINESS.BACKEND, note: "No ABR or KYC provider connected." },
  { area: "Payout profile", scenario: "Bank/payout account captured and verified", state: READINESS.BACKEND, note: "Placeholder only — payout provider onboarding not connected." },
  { area: "Single listing", scenario: "Category/subcategory, variants, SKUs, inventory, weight/dimensions, handling time, return eligibility, images + video", state: READINESS.PROTOTYPE },
  { area: "Listing moderation", scenario: "Admin approve/reject with reasons and restricted-keyword rules", state: READINESS.PARTIAL, note: "Queue and decisions demoed; rule engine is server-side work." },
  { area: "Bulk import — create", scenario: "1,000-row CSV/XLSX create run with validation and preview counts", state: READINESS.PROTOTYPE },
  { area: "Bulk import — update", scenario: "Explicit update mode keyed on seller SKU, with blank-cell IGNORE vs CLEAR", state: READINESS.PROTOTYPE },
  { area: "Bulk import — async workers", scenario: "Large files queued, chunked, resumable, retry of failed rows", state: READINESS.BACKEND, note: "Batch/queue UI demoed; no job runner." },
  { area: "Product video pipeline", scenario: "Upload → safety check → transcode → thumbnail → ready / failed, no autoplay sound", state: READINESS.PARTIAL, note: "All states rendered; media/safety provider not connected." },
  { area: "Video moderation", scenario: "Admin can review, reject and remove a live product video", state: READINESS.PARTIAL, note: "Admin action demoed; takedown propagation needs backend." },
  { area: "Customer journey", scenario: "Search → filter → storefront → PDP → cart → checkout → confirmation → orders → tracking → returns → reviews → wishlist", state: READINESS.PROTOTYPE },
  { area: "Guest vs account checkout", scenario: "Guest checkout with email, or sign-in, both reaching one order", state: READINESS.PARTIAL, note: "UI choice present; no real auth or session." },
  { area: "Multi-seller checkout", scenario: "One cart and one payment → master order → seller sub-orders and packages", state: READINESS.PROTOTYPE },
  { area: "Seller data isolation", scenario: "A seller can only ever read their own sub-orders, customers and finance", state: READINESS.BACKEND, note: "Represented in UI; must be enforced server-side with row-level rules." },
  { area: "Inventory reservation", scenario: "Stock reserved at checkout; simultaneous buyers cannot oversell", state: READINESS.BACKEND, note: "Requires transactional reservation and release-on-expiry." },
  { area: "Payment capture", scenario: "Order marked paid only on provider-confirmed server callback", state: READINESS.BACKEND, note: "No payment provider connected." },
  { area: "Payment idempotency", scenario: "Duplicate callback does not double-charge or duplicate the order", state: READINESS.BACKEND },
  { area: "Financial ledger", scenario: "Immutable entries for charge, commission, fees, shipping, refund, adjustment, payout", state: READINESS.PARTIAL, note: "Ledger view and entry types demoed; immutability is a DB guarantee." },
  { area: "Shipping rates & labels", scenario: "Rate quote → label → pickup → tracking → POD", state: READINESS.BACKEND, note: "Adapter-ready screens; carrier NOT CONNECTED." },
  { area: "Returns", scenario: "7-day change of mind from confirmed delivery; ACL issues handled separately; item/qty/reason/evidence; partial or full", state: READINESS.PROTOTYPE },
  { area: "Return logistics", scenario: "Return label, instructions, return tracking, receipt scan, refund trigger", state: READINESS.PARTIAL, note: "States shown; label and refund execution need providers." },
  { area: "Payout eligibility", scenario: "Confirmed delivery + 14 days, blocked by return, refund, dispute, chargeback or fraud hold", state: READINESS.PROTOTYPE },
  { area: "Payout execution", scenario: "Batch, failed payout, retry, statement, recovery adjustment", state: READINESS.BACKEND, note: "Pipeline visualised; no payout rail connected." },
  { area: "Seller staff permissions", scenario: "Owner/Manager/Dispatch/Finance permission matrix with MFA", state: READINESS.PARTIAL, note: "Matrix editable in prototype; enforcement is server-side." },
  { area: "Admin role separation", scenario: "Support / Catalogue / Finance / Super Admin scopes, sensitive finance actions audited", state: READINESS.PARTIAL },
  { area: "Notifications", scenario: "Templates, per-event delivery log, retries and failures", state: READINESS.PARTIAL, note: "Email/SMS provider not connected." },
  { area: "Webhooks & integrations", scenario: "Signature verification, idempotency keys, retry with backoff, dead-letter", state: READINESS.BACKEND },
  { area: "Marketplace configuration", scenario: "Admin-editable commission, payout delay, return window, listing rules, seller SLA", state: READINESS.PROTOTYPE, note: "Values editable in the prototype; persistence needs backend." },
  { area: "Reporting & exports", scenario: "GMV, seller performance, returns analysis exports", state: READINESS.PARTIAL },
  { area: "Audit log", scenario: "Immutable who/what/when/IP trail for sensitive actions", state: READINESS.PARTIAL, note: "Read-only demo log; append-only storage required." },
  { area: "Security", scenario: "Auth, MFA, session revocation, rate limiting, PII encryption, RLS", state: READINESS.BACKEND, note: "PRODUCTION REQUIRED — nothing here is real security." },
  { area: "Fraud & risk", scenario: "Risk scoring, velocity checks, chargeback handling", state: READINESS.MISSING },
  { area: "Backups & disaster recovery", scenario: "Point-in-time restore, tested recovery runbook", state: READINESS.MISSING, note: "PRODUCTION REQUIRED." },
  { area: "Error monitoring & alerting", scenario: "Crash reporting, job failure alerts, uptime checks", state: READINESS.MISSING, note: "PRODUCTION REQUIRED." },
  { area: "Performance", scenario: "Lazy media, compact grids, mobile-first layout, no autoplay sound", state: READINESS.PROTOTYPE },
];

export function readinessTone(state: Readiness): Tone {
  return state === READINESS.PROTOTYPE
    ? "ok"
    : state === READINESS.PARTIAL
      ? "info"
      : state === READINESS.BACKEND
        ? "warn"
        : "bad";
}

/* -------------------------------------------------- marketplace config */

export type ConfigItem = {
  id: string;
  group: "Commission" | "Payouts" | "Returns" | "Listings" | "Seller SLA";
  label: string;
  value: string;
  unit?: string;
  note: string;
};

export const MARKETPLACE_CONFIG: ConfigItem[] = [
  { id: "comm_standard", group: "Commission", label: "Standard commission", value: "8", unit: "%", note: "Applied to GST-inclusive item value." },
  { id: "comm_jewellery", group: "Commission", label: "Jewellery commission", value: "6", unit: "%", note: "Category override." },
  { id: "comm_promoted", group: "Commission", label: "Promoted placement", value: "10", unit: "%", note: "Opt-in campaign rate." },
  { id: "payout_delay", group: "Payouts", label: "Payout delay after confirmed delivery", value: "14", unit: "days", note: "Eligibility clock start = confirmed delivery." },
  { id: "payout_day", group: "Payouts", label: "Payout run", value: "Friday 5pm AEST", note: "Weekly batch." },
  { id: "payout_min", group: "Payouts", label: "Minimum payout", value: "50", unit: "AUD", note: "Balances below roll into the next run." },
  { id: "return_window", group: "Returns", label: "Change-of-mind window", value: "7", unit: "days", note: "From confirmed delivery. Statutory ACL claims are not limited by this." },
  { id: "return_hold", group: "Returns", label: "Automatic payout hold on return", value: "Enabled", note: "Held until the return is resolved." },
  { id: "listing_images", group: "Listings", label: "Gallery images per product", value: "12", note: "First image is the thumbnail." },
  { id: "listing_video", group: "Listings", label: "Product video limit", value: "1 × 60s × 200MB", note: "Muted by default, never autoplays with sound." },
  { id: "listing_import", group: "Listings", label: "Bulk import rows per file", value: "1000", unit: "rows", note: "Larger files are queued as async batches." },
  { id: "listing_review", group: "Listings", label: "Listing review", value: "Required for new sellers", note: "Auto-approve after 20 clean listings." },
  { id: "sla_accept", group: "Seller SLA", label: "Accept order within", value: "24", unit: "hours", note: "Breach affects seller score." },
  { id: "sla_dispatch", group: "Seller SLA", label: "Dispatch within handling time", value: "95", unit: "% on time", note: "Rolling 30-day target." },
  { id: "sla_response", group: "Seller SLA", label: "Message response", value: "1 business day", note: "Customer enquiries." },
];

export const CONFIG_PERSISTENCE_NOTE =
  "Configuration edits are local to this prototype. Persisting them, versioning changes and applying them to live pricing, payouts and returns is BACKEND REQUIRED.";

/* ------------------------------------------------------ bulk import */

export type ImportMode = "create" | "update";

export const BLANK_CELL_POLICIES = [
  { id: "ignore", label: "IGNORE blank cells", note: "Leave the existing value untouched. Safest for partial updates." },
  { id: "clear", label: "CLEAR blank cells", note: "Treat a blank cell as an instruction to empty that field." },
] as const;

export const IMPORT_VALIDATION_CHECKS = [
  "Required columns and template version",
  "Seller SKU / product identifier present and unique in file",
  "Duplicate SKU against your existing catalogue",
  "Category and subcategory exist in the ISM taxonomy",
  "Category attributes valid (size, colour, fabric, material)",
  "Price, compare-at price and GST flag numeric and sane",
  "Inventory non-negative integer",
  "Weight, dimensions and handling time present for shipping",
  "Return eligibility value recognised",
  "Image URLs reachable and correct format",
  "Video URL reachable, duration and size within limits",
];

export const IMPORT_BATCHES = [
  { id: "IMP-2026-0188", at: "28 Aug 2026 14:02", mode: "create" as ImportMode, rows: 1000, ready: 944, warnings: 36, errors: 20, state: "Completed", tone: "ok" as Tone },
  { id: "IMP-2026-0181", at: "12 Aug 2026 09:20", mode: "update" as ImportMode, rows: 640, ready: 640, warnings: 0, errors: 0, state: "Completed", tone: "ok" as Tone },
  { id: "IMP-2026-0174", at: "03 Aug 2026 18:44", mode: "create" as ImportMode, rows: 180, ready: 180, warnings: 4, errors: 0, state: "Completed", tone: "ok" as Tone },
  { id: "IMP-2026-0166", at: "19 Jul 2026 11:05", mode: "create" as ImportMode, rows: 96, ready: 88, warnings: 2, errors: 8, state: "Completed with errors", tone: "warn" as Tone },
  { id: "IMP-2026-0150", at: "02 Jul 2026 16:12", mode: "create" as ImportMode, rows: 240, ready: 0, warnings: 0, errors: 240, state: "Failed — wrong template version", tone: "bad" as Tone },
];

export const ASYNC_IMPORT_NOTE =
  "Files over 200 rows are queued as an async batch: rows are chunked, processed by a worker, and progress is polled. Queueing, chunking, resumability and per-row retry are BACKEND REQUIRED.";

/* ------------------------------------------- inventory / backend notes */

export const BACKEND_REQUIRED_NOTES = {
  inventory:
    "BACKEND REQUIRED — stock reservation at checkout, concurrency control and oversell prevention must be transactional and server-authoritative. The counts shown here are demo state only.",
  payments:
    "BACKEND REQUIRED — orders may only be marked paid from a provider-confirmed server callback, with idempotency keys and signature verification. No payment provider is connected.",
  shipping:
    "NOT CONNECTED — carrier adapter is ready in the UI (rates, labels, pickups, tracking, proof of delivery), but no shipping provider is integrated.",
  payouts:
    "BACKEND REQUIRED — payout batching, failed payout retry, statements and post-payout recovery adjustments need a real payout rail and an immutable ledger.",
  security:
    "PRODUCTION REQUIRED — authentication, MFA, session revocation, rate limiting, PII encryption, row-level seller isolation, backups and error monitoring are not implemented in this prototype.",
  media:
    "BACKEND REQUIRED — video upload, safety screening, transcoding and thumbnail generation are simulated states; no media pipeline is connected.",
} as const;


/* ------------------------------------------------------- video pipeline */

export const VIDEO_STATES = [
  "UPLOADING",
  "UPLOADED",
  "SAFETY CHECK",
  "PROCESSING / TRANSCODING",
  "THUMBNAIL GENERATED",
  "READY",
  "FAILED / REJECTED",
] as const;

/* -------------------------------------------------- category attributes */

export const ATTRIBUTE_TYPES = [
  "Text",
  "Number",
  "Decimal",
  "Dropdown",
  "Multi-select",
  "Colour",
  "Size",
  "Boolean",
  "Date",
  "Dimension",
] as const;

export const CATEGORY_TREE = [
  {
    department: "Fashion",
    categories: [
      { name: "Women", subs: ["Sarees", "Lehengas", "Kurta Sets", "Salwar Suits", "Anarkali", "Indo-Western", "Blouses", "Dupattas"] },
      { name: "Men", subs: ["Kurta", "Sherwani", "Nehru Jacket", "Dhoti"] },
      { name: "Kids", subs: ["Girls Festive", "Boys Kurta", "Kids Lehenga"] },
    ],
  },
  {
    department: "Jewellery & Accessories",
    categories: [
      { name: "Jewellery", subs: ["Jhumkas", "Necklace Sets", "Kundan", "Polki", "Oxidised", "Bangles", "Temple", "Bridal"] },
      { name: "Beauty", subs: ["Skincare", "Haircare", "Mehndi", "Bindi"] },
    ],
  },
  {
    department: "Home, Pooja & Gifting",
    categories: [
      { name: "Home & Living", subs: ["Bedsheets", "Blankets & Quilts", "Dohars", "Towels", "Cushion Covers", "Curtains", "Home Decor", "Brassware", "Kitchen & Dining", "Handicrafts"] },
      { name: "Pooja", subs: ["Diyas", "Idols", "Pooja Thalis", "Incense", "Mandir Accessories", "Pooja Kits"] },
      { name: "Gifts", subs: ["Hampers", "By Occasion", "Under $50", "Corporate"] },
    ],
  },
  {
    department: "Footwear",
    categories: [{ name: "Footwear", subs: ["Women's Juttis", "Punjabi Juttis", "Mojaris", "Kolhapuri Chappals"] }],
  },
];

/* -------------------------------------------------- video state machine */

export const VIDEO_PIPELINE: {
  state: (typeof VIDEO_STATES)[number];
  tone: Tone;
  detail: string;
}[] = [
  { state: "UPLOADING", tone: "info", detail: "Chunked upload in progress. Seller can cancel; partial files are discarded." },
  { state: "UPLOADED", tone: "info", detail: "File received and checksummed. Not yet visible to customers." },
  { state: "SAFETY CHECK", tone: "warn", detail: "Automated content screening plus manual review for flagged clips." },
  { state: "PROCESSING / TRANSCODING", tone: "info", detail: "Transcoded to streaming renditions (1080p/720p/480p)." },
  { state: "THUMBNAIL GENERATED", tone: "info", detail: "Poster frame generated; seller may pick an alternate frame." },
  { state: "READY", tone: "ok", detail: "Live on the product page. Muted by default — never autoplays with sound." },
  { state: "FAILED / REJECTED", tone: "bad", detail: "Rejected by safety review or failed transcoding. Seller sees the reason and can re-upload." },
];

export const VIDEO_MODERATION_NOTE =
  "Admin catalogue moderators can review, reject or remove a live product video at any time; removal reverts the listing to images only and notifies the seller.";
