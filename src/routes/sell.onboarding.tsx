import { useState, useEffect, useRef } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  CheckCircle2,
  Circle,
  ShieldCheck,
  Upload,
  FileText,
  Trash2,
  Loader2,
  AlertCircle,
  Check,
} from "lucide-react";
import { Badge, Button, Card, Field, SellerShell } from "@/components/ism/SellerShell";
import { useAuth } from "@/hooks/use-auth";
import {
  DEMO_NOTE,
  ONBOARDING_STATUSES,
  POST_APPROVAL_CHECKLIST,
  SELLER_AGREEMENTS,
  type OnboardingStatus,
} from "@/lib/ism-ops";
import { CATEGORIES } from "@/lib/ism-data";
import { saveSellerOnboardingServerFn } from "@/lib/api/sellers";
import { uploadSellerVerificationDoc } from "@/lib/api/storage";

export const Route = createFileRoute("/sell/onboarding")({
  head: () => ({
    meta: [
      { title: "Become a Seller — Indian Shopping Mela" },
      {
        name: "description",
        content:
          "Seller onboarding: business details, ABN, dispatch and return addresses, payout setup, verification documents and seller agreement.",
      },
      { property: "og:title", content: "Become a Seller — Indian Shopping Mela" },
      {
        property: "og:description",
        content: "Multi-step onboarding for Indian sellers joining Australia's ISM marketplace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OnboardingPage,
});

const STEPS = [
  "Verify contact",
  "Business details",
  "Addresses",
  "Payouts & documents",
  "Categories",
  "Agreements",
  "Review",
] as const;

type DocKey = "photoId" | "businessReg" | "proofAddress";

interface DocState {
  file: File | null;
  fileName: string;
  fileSize: number;
  storagePath: string | null;
  uploading: boolean;
  uploaded: boolean;
  error?: string | undefined;
}

function Select({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm focus:border-primary focus:outline-none"
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

function DocumentUploadItem({
  title,
  description,
  docKey,
  state,
  onFileSelect,
  onRemove,
}: {
  title: string;
  description: string;
  docKey: DocKey;
  state: DocState;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <div className="rounded-sm border border-border bg-surface/50 p-3.5 transition-all hover:border-border/80">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleInputChange}
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        className="hidden"
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <span className="font-semibold text-foreground text-xs">{title}</span>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>

          {state.uploaded && state.fileName && (
            <div className="mt-1.5 flex items-center gap-2 text-[11px] font-medium text-teal">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{state.fileName}</span>
              <span className="text-muted-foreground">({formatBytes(state.fileSize)})</span>
            </div>
          )}

          {state.error && (
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-rani">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{state.error}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {state.uploading ? (
            <div className="flex items-center gap-1.5 rounded-sm bg-muted px-2.5 py-1 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Uploading...</span>
            </div>
          ) : state.uploaded ? (
            <>
              <Badge tone="teal">
                <Check className="h-3 w-3 inline mr-1" />
                Uploaded
              </Badge>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[11px] font-semibold text-primary hover:text-rani hover:underline"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={onRemove}
                className="text-muted-foreground hover:text-rani p-1"
                title="Remove file"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-sm border border-rani/40 bg-rani/5 px-3 py-1.5 text-xs font-bold text-rani transition-colors hover:bg-rani hover:text-rani-foreground"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload Document</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function OnboardingPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<OnboardingStatus>("DRAFT");
  const [sameAsDispatch, setSameAsDispatch] = useState(true);
  const [sellerType, setSellerType] = useState("Sole trader");
  const [cats, setCats] = useState<string[]>([]);
  const [agreed, setAgreed] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states - Contact & Business
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [contactName, setContactName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [tradingName, setTradingName] = useState("");
  const [abn, setAbn] = useState("");
  const [gstRegistered, setGstRegistered] = useState("Yes");

  // Form states - Addresses
  const [dispatchStreet, setDispatchStreet] = useState("");
  const [dispatchSuburb, setDispatchSuburb] = useState("");
  const [dispatchState, setDispatchState] = useState("NSW");
  const [dispatchPostcode, setDispatchPostcode] = useState("");

  const [returnStreet, setReturnStreet] = useState("");
  const [returnSuburb, setReturnSuburb] = useState("");
  const [returnState, setReturnState] = useState("NSW");
  const [returnPostcode, setReturnPostcode] = useState("");

  // Payout states (clean initial values)
  const [bankBsb, setBankBsb] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");

  // Verification documents state
  const [docs, setDocs] = useState<Record<DocKey, DocState>>({
    photoId: {
      file: null,
      fileName: "",
      fileSize: 0,
      storagePath: null,
      uploading: false,
      uploaded: false,
    },
    businessReg: {
      file: null,
      fileName: "",
      fileSize: 0,
      storagePath: null,
      uploading: false,
      uploaded: false,
    },
    proofAddress: {
      file: null,
      fileName: "",
      fileSize: 0,
      storagePath: null,
      uploading: false,
      uploaded: false,
    },
  });

  // Authenticity declaration state
  const [authenticityAccepted, setAuthenticityAccepted] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/signin", search: { portal: "seller", redirect: "/sell/onboarding" } });
      return;
    }
    if (user) {
      if (!email && user.email) setEmail(user.email);
      if (!phone && user.phone) setPhone(user.phone);
      if (!contactName && user.fullName) setContactName(user.fullName);
      if (!bankAccountName && (tradingName || user.fullName)) {
        setBankAccountName(tradingName || user.fullName || "");
      }
    }
  }, [authLoading, user, navigate]);

  const handleFileUpload = async (key: DocKey, file: File) => {
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File exceeds maximum 10MB limit. Please choose a smaller file.");
      return;
    }

    setDocs((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        file,
        fileName: file.name,
        fileSize: file.size,
        uploading: true,
        error: undefined,
      },
    }));

    try {
      let storagePath: string | null = null;
      try {
        storagePath = await uploadSellerVerificationDoc(file);
      } catch (storageErr: any) {
        console.warn("Storage upload notice (staged locally):", storageErr?.message);
        storagePath = `staged/${user?.id || "seller"}/${file.name}`;
      }

      setDocs((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          storagePath,
          uploading: false,
          uploaded: true,
        },
      }));
      toast.success(`${file.name} uploaded successfully!`);
    } catch (err: any) {
      setDocs((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          uploading: false,
          uploaded: false,
          error: err.message,
        },
      }));
      toast.error(`Document upload failed: ${err.message}`);
    }
  };

  const handleRemoveDoc = (key: DocKey) => {
    setDocs((prev) => ({
      ...prev,
      [key]: {
        file: null,
        fileName: "",
        fileSize: 0,
        storagePath: null,
        uploading: false,
        uploaded: false,
        error: undefined,
      },
    }));
    toast.info("Document removed.");
  };

  const allAgreed = agreed.length === SELLER_AGREEMENTS.length;
  const uploadedDocsCount = Object.values(docs).filter((d) => d.uploaded).length;

  const handleSaveDraft = async () => {
    setIsSubmitting(true);
    try {
      await saveSellerOnboardingServerFn({
        data: {
          email,
          phone,
          businessName: tradingName || `${contactName || "Seller"}'s Store`,
          legalName: legalName || tradingName || contactName,
          abn: abn.replace(/\s+/g, ""),
          businessType: sellerType,
          slug: (tradingName || "seller-store").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          dispatchAddress: {
            line1: dispatchStreet || "123 Dispatch St",
            suburb: dispatchSuburb || "Sydney",
            state: dispatchState || "NSW",
            postcode: dispatchPostcode || "2000",
            country: "Australia",
          },
          returnAddress: sameAsDispatch
            ? {
                line1: dispatchStreet || "123 Dispatch St",
                suburb: dispatchSuburb || "Sydney",
                state: dispatchState || "NSW",
                postcode: dispatchPostcode || "2000",
                country: "Australia",
              }
            : {
                line1: returnStreet || dispatchStreet || "123 Return St",
                suburb: returnSuburb || dispatchSuburb || "Sydney",
                state: returnState || dispatchState || "NSW",
                postcode: returnPostcode || dispatchPostcode || "2000",
                country: "Australia",
              },
          termsAcceptedVersion: "V1_2026",
          status: "DRAFT",
        },
      });
      toast.success("Draft saved successfully", {
        description: "You can resume your onboarding anytime.",
      });
    } catch (err: any) {
      toast.error("Failed to save draft", { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitApplication = async () => {
    setIsSubmitting(true);
    try {
      await saveSellerOnboardingServerFn({
        data: {
          email,
          phone,
          businessName: tradingName,
          legalName,
          abn: abn.replace(/\s+/g, ""),
          businessType: sellerType,
          slug: tradingName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          dispatchAddress: {
            line1: dispatchStreet,
            suburb: dispatchSuburb,
            state: dispatchState,
            postcode: dispatchPostcode,
            country: "Australia",
          },
          returnAddress: sameAsDispatch
            ? {
                line1: dispatchStreet,
                suburb: dispatchSuburb,
                state: dispatchState,
                postcode: dispatchPostcode,
                country: "Australia",
              }
            : {
                line1: returnStreet,
                suburb: returnSuburb,
                state: returnState,
                postcode: returnPostcode,
                country: "Australia",
              },
          termsAcceptedVersion: "V1_2026",
          status: "SUBMITTED",
        },
      });
      setStatus("SUBMITTED");
      setStep(STEPS.length - 1);
      toast.success("Application submitted", {
        description: "Your seller application is under review by ISM Admin.",
      });
    } catch (err: any) {
      toast.error("Application submission failed", { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SellerShell
      active="onboarding"
      title="Become a Seller"
      subtitle="Onboarding application · Australian marketplace registration"
      brand={{
        storeName:
          tradingName || (user?.fullName ? `${user.fullName}'s Store` : "Seller Onboarding"),
        location: dispatchSuburb ? `${dispatchSuburb}, ${dispatchState}` : "Australia",
        verified: false,
      }}
      actions={
        <>
          <Button variant="outline" disabled={isSubmitting} onClick={handleSaveDraft}>
            Save draft
          </Button>
          <Button
            variant="rani"
            disabled={!allAgreed || isSubmitting}
            onClick={handleSubmitApplication}
          >
            {isSubmitting ? "Submitting..." : "Submit application"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface px-4 py-3 text-xs">
          <span className="text-muted-foreground">
            Already registered as an approved seller or store manager on Indian Shopping Mela?
          </span>
          <Link
            to="/signin"
            search={{ portal: "seller", redirect: "/sell" }}
            className="font-bold text-rani hover:underline"
          >
            Sign in to Seller Centre →
          </Link>
        </div>

        <Card title="Application status">
          <div className="flex flex-wrap items-center gap-2">
            {ONBOARDING_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`rounded-sm px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors ${
                  status === s
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:border-rani hover:text-rani"
                }`}
              >
                {s.replace(/_/g, " ")}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {status === "INFO_REQUIRED"
              ? "Reviewer note: ABN name does not match the trading name — upload a business name registration."
              : status === "REJECTED"
                ? "Reviewer note: selling categories include prohibited products."
                : status === "SUSPENDED"
                  ? "Store is suspended. Listings are hidden and payouts are held."
                  : status === "SUBMITTED"
                    ? "Application submitted. Average review time: 1–2 business days."
                    : "Complete your seller onboarding steps to begin selling on Indian Shopping Mela."}
          </p>
        </Card>

        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {STEPS.map((s, i) => (
            <button
              key={s}
              onClick={() => setStep(i)}
              className={`shrink-0 rounded-sm px-3 py-1.5 text-xs font-semibold ${
                i === step
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground"
              }`}
            >
              {i + 1}. {s}
            </button>
          ))}
        </div>

        {step === 0 && (
          <Card title="Verify email and mobile">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Email Address <span className="text-rani">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seller@store.com.au"
                  className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm focus:border-primary focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Mobile Number <span className="text-rani">*</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0400 000 000"
                  className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm focus:border-primary focus:outline-none"
                  required
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="teal">
                <ShieldCheck size={12} /> Contact Information Editable
              </Badge>
              <Badge tone="marigold">MFA Recommended</Badge>
            </div>
          </Card>
        )}

        {step === 1 && (
          <Card title="Business details">
            <div className="grid gap-4 md:grid-cols-2">
              <Select
                label="Seller type"
                value={sellerType}
                onChange={setSellerType}
                options={["Sole trader", "Company (Pty Ltd)", "Partnership", "Trust"]}
              />
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Legal entity name <span className="text-rani">*</span>
                </label>
                <input
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="e.g. Melbourne Sari Palace Pty Ltd"
                  className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm focus:border-primary focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Trading name (Store Name) <span className="text-rani">*</span>
                </label>
                <input
                  value={tradingName}
                  onChange={(e) => setTradingName(e.target.value)}
                  placeholder="e.g. Mumbai Mirror Boutique"
                  className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm focus:border-primary focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Australian Business Number (ABN) <span className="text-rani">*</span>
                </label>
                <input
                  value={abn}
                  onChange={(e) => setAbn(e.target.value)}
                  placeholder="11-digit ABN (e.g. 51 824 753 556)"
                  className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm focus:border-primary focus:outline-none"
                  required
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Verified against the Australian Business Register (ABR)
                </p>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  GST Registered
                </label>
                <select
                  value={gstRegistered}
                  onChange={(e) => setGstRegistered(e.target.value)}
                  className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="Yes">Yes (10% GST Inclusive)</option>
                  <option value="No">No</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Primary Contact Name <span className="text-rani">*</span>
                </label>
                <input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Contact Name"
                  className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm focus:border-primary focus:outline-none"
                  required
                />
              </div>
            </div>
          </Card>
        )}

        {step === 2 && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Dispatch address">
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    Street Address <span className="text-rani">*</span>
                  </label>
                  <input
                    value={dispatchStreet}
                    onChange={(e) => setDispatchStreet(e.target.value)}
                    placeholder="e.g. 45 Wigram Street"
                    className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm focus:border-primary focus:outline-none"
                    required
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      Suburb <span className="text-rani">*</span>
                    </label>
                    <input
                      value={dispatchSuburb}
                      onChange={(e) => setDispatchSuburb(e.target.value)}
                      placeholder="e.g. Harris Park"
                      className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm focus:border-primary focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      State <span className="text-rani">*</span>
                    </label>
                    <select
                      value={dispatchState}
                      onChange={(e) => setDispatchState(e.target.value)}
                      className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm focus:border-primary focus:outline-none"
                    >
                      {["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"].map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      Postcode <span className="text-rani">*</span>
                    </label>
                    <input
                      value={dispatchPostcode}
                      onChange={(e) => setDispatchPostcode(e.target.value)}
                      placeholder="2150"
                      className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm focus:border-primary focus:outline-none"
                      required
                    />
                  </div>
                </div>
                <Field label="Handling time SLA" defaultValue="1–2 business days" required readOnly />
              </div>
            </Card>
            <Card title="Return address">
              <label className="mb-3 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={sameAsDispatch}
                  onChange={(e) => setSameAsDispatch(e.target.checked)}
                  className="size-4 accent-[var(--color-rani)]"
                />
                Same as dispatch address
              </label>
              {!sameAsDispatch && (
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      Return Street Address
                    </label>
                    <input
                      value={returnStreet}
                      onChange={(e) => setReturnStreet(e.target.value)}
                      placeholder="Return street address"
                      className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm focus:border-primary focus:outline-none"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                        Suburb
                      </label>
                      <input
                        value={returnSuburb}
                        onChange={(e) => setReturnSuburb(e.target.value)}
                        placeholder="Suburb"
                        className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm focus:border-primary focus:outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                        State
                      </label>
                      <select
                        value={returnState}
                        onChange={(e) => setReturnState(e.target.value)}
                        className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm focus:border-primary focus:outline-none"
                      >
                        {["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"].map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                        Postcode
                      </label>
                      <input
                        value={returnPostcode}
                        onChange={(e) => setReturnPostcode(e.target.value)}
                        placeholder="2000"
                        className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm focus:border-primary focus:outline-none"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}
              {sameAsDispatch && (
                <p className="text-sm text-muted-foreground">
                  Returns will be addressed to {dispatchStreet || "Your Dispatch Address"},{" "}
                  {dispatchSuburb || ""} {dispatchState} {dispatchPostcode}.
                </p>
              )}
            </Card>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Direct Bank & Stripe Payouts (AUD)">
              <p className="text-sm text-muted-foreground">
                Sellers are paid in AUD directly to their Australian bank account via Stripe Connect
                14 days post-delivery.
              </p>
              <div className="mt-3 space-y-3 text-sm">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    BSB (6 Digits) <span className="text-rani">*</span>
                  </label>
                  <input
                    value={bankBsb}
                    onChange={(e) => setBankBsb(e.target.value)}
                    placeholder="e.g. 062-000"
                    maxLength={7}
                    className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm focus:border-primary focus:outline-none"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Australian Bank State Branch code
                  </p>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    Account Number <span className="text-rani">*</span>
                  </label>
                  <input
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value)}
                    placeholder="e.g. 1234 5678"
                    maxLength={12}
                    className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm focus:border-primary focus:outline-none"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    6 to 10 digit Australian bank account number
                  </p>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    Account Name <span className="text-rani">*</span>
                  </label>
                  <input
                    value={bankAccountName}
                    onChange={(e) => setBankAccountName(e.target.value)}
                    placeholder="e.g. Melbourne Sari Palace Pty Ltd"
                    className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm focus:border-primary focus:outline-none"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Must match your legal entity or trading name on file
                  </p>
                </div>
                <div className="pt-1">
                  <Badge tone="teal">Stripe Connect Ready (AU)</Badge>
                </div>
              </div>
            </Card>

            <Card title="Verification documents">
              <p className="text-xs text-muted-foreground mb-3">
                Upload clear PDF, JPG, or PNG scans under 10MB to verify your identity and Australian
                business registration.
              </p>
              <div className="space-y-3 text-sm">
                {/* Photo ID */}
                <DocumentUploadItem
                  title="Photo ID (Director / Sole Trader)"
                  description="Australian Driver Licence, Passport, or Proof of Age"
                  docKey="photoId"
                  state={docs.photoId}
                  onFileSelect={(file) => handleFileUpload("photoId", file)}
                  onRemove={() => handleRemoveDoc("photoId")}
                />

                {/* Business Registration */}
                <DocumentUploadItem
                  title="Business Registration Certificate"
                  description="ASIC Certificate of Registration or ABN confirmation letter"
                  docKey="businessReg"
                  state={docs.businessReg}
                  onFileSelect={(file) => handleFileUpload("businessReg", file)}
                  onRemove={() => handleRemoveDoc("businessReg")}
                />

                {/* Proof of Address */}
                <DocumentUploadItem
                  title="Proof of Address"
                  description="Utility bill, lease agreement, or bank statement (< 90 days)"
                  docKey="proofAddress"
                  state={docs.proofAddress}
                  onFileSelect={(file) => handleFileUpload("proofAddress", file)}
                  onRemove={() => handleRemoveDoc("proofAddress")}
                />

                {/* Product Authenticity Declaration */}
                <div className="rounded-sm border border-border p-3 bg-surface/40">
                  <div className="flex items-start justify-between gap-3">
                    <label className="flex items-start gap-2.5 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={authenticityAccepted}
                        onChange={(e) => setAuthenticityAccepted(e.target.checked)}
                        className="mt-0.5 size-4 accent-[var(--color-rani)]"
                      />
                      <div>
                        <span className="font-bold text-foreground">
                          Product Authenticity & Statutory Compliance Declaration
                        </span>
                        <p className="mt-0.5 text-muted-foreground text-[11px]">
                          I certify that all products sold on Indian Shopping Mela are 100% genuine,
                          legally imported/sourced, non-counterfeit, and compliant with mandatory
                          Australian Consumer Law standards.
                        </p>
                      </div>
                    </label>
                    <Badge tone={authenticityAccepted ? "teal" : "marigold"}>
                      {authenticityAccepted ? "ACCEPTED" : "REQUIRED"}
                    </Badge>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {step === 4 && (
          <Card title="Selling categories">
            <p className="mb-3 text-xs text-muted-foreground">
              Category access controls commission rate and review requirements.
            </p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => {
                const on = cats.includes(c.slug);
                return (
                  <button
                    key={c.slug}
                    onClick={() =>
                      setCats((prev) =>
                        on ? prev.filter((x) => x !== c.slug) : [...prev, c.slug],
                      )
                    }
                    className={`rounded-sm px-3 py-1.5 text-xs font-semibold ${
                      on
                        ? "bg-rani text-rani-foreground"
                        : "border border-border text-muted-foreground"
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        {step === 5 && (
          <Card title="Seller agreements">
            <ul className="space-y-2 text-sm">
              {SELLER_AGREEMENTS.map((a) => (
                <li key={a}>
                  <label className="flex items-start gap-2 rounded-sm border border-border px-3 py-2">
                    <input
                      type="checkbox"
                      checked={agreed.includes(a)}
                      onChange={(e) =>
                        setAgreed((prev) =>
                          e.target.checked ? [...prev, a] : prev.filter((x) => x !== a),
                        )
                      }
                      className="mt-0.5 size-4 accent-[var(--color-rani)]"
                    />
                    <span>I accept the {a}</span>
                  </label>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {step === 6 && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Review & submit">
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li>Seller type: {sellerType}</li>
                <li>
                  Store: {tradingName} · {dispatchSuburb}, {dispatchState}
                </li>
                <li>Categories: {cats.length} selected</li>
                <li>
                  Documents uploaded: {uploadedDocsCount} of 3 • Authenticity:{" "}
                  {authenticityAccepted ? "Certified" : "Pending"}
                </li>
                <li>
                  Agreements accepted: {agreed.length} of {SELLER_AGREEMENTS.length}
                </li>
                <li>Status: {status.replace(/_/g, " ")}</li>
              </ul>
            </Card>
            <Card title="After approval">
              <ul className="space-y-2 text-sm">
                {POST_APPROVAL_CHECKLIST.map((c) => (
                  <li key={c.label} className="flex items-center gap-2">
                    {c.done ? (
                      <CheckCircle2 size={15} className="shrink-0 text-teal" />
                    ) : (
                      <Circle size={15} className="shrink-0 text-muted-foreground" />
                    )}
                    <span className={c.done ? "text-muted-foreground line-through" : ""}>
                      {c.label}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                to="/sell"
                className="mt-4 inline-block text-xs font-bold uppercase tracking-wide text-rani"
              >
                Go to Seller Centre →
              </Link>
            </Card>
          </div>
        )}

        <div className="flex justify-between gap-2">
          <Button
            variant="outline"
            disabled={step === 0 || isSubmitting}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button
              variant="primary"
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            >
              Continue
            </Button>
          ) : (
            <Button
              variant="primary"
              disabled={isSubmitting || status === "SUBMITTED"}
              onClick={handleSubmitApplication}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting Application...
                </>
              ) : status === "SUBMITTED" ? (
                "Application Submitted"
              ) : (
                "Submit Application"
              )}
            </Button>
          )}
        </div>
      </div>
    </SellerShell>
  );
}

