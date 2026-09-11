import { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  User,
  Store,
  ShieldCheck,
  Lock,
  ArrowRight,
  Sparkles,
  Building2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { ShopLayout } from "@/components/ism/ShopLayout";
import { useAuth } from "@/hooks/use-auth";

export type PortalType = "customer" | "seller" | "admin";
export type AuthMode = "signin" | "signup" | "forgot";

type SignInSearch = {
  redirect?: string | undefined;
  portal?: PortalType | undefined;
  mode?: AuthMode | undefined;
};

export const Route = createFileRoute("/signin")({
  validateSearch: (s: Record<string, unknown>): SignInSearch => {
    let portal: PortalType | undefined = undefined;
    if (s["portal"] === "customer" || s["portal"] === "seller" || s["portal"] === "admin") {
      portal = s["portal"];
    } else if (typeof s["redirect"] === "string") {
      if (s["redirect"].startsWith("/admin")) portal = "admin";
      else if (s["redirect"].startsWith("/sell")) portal = "seller";
      else portal = "customer";
    }

    let mode: AuthMode | undefined = undefined;
    if (s["mode"] === "signin" || s["mode"] === "signup" || s["mode"] === "forgot") {
      mode = s["mode"];
    }

    return {
      redirect:
        typeof s["redirect"] === "string" && s["redirect"].startsWith("/")
          ? s["redirect"]
          : undefined,
      portal,
      mode,
    };
  },
  head: () => ({
    meta: [
      { title: "Sign In & Portals — Indian Shopping Mela" },
      {
        name: "description",
        content:
          "Access your Indian Shopping Mela customer account, Seller Centre merchant portal, or platform admin governance.",
      },
      { property: "og:title", content: "Sign In & Portals — Indian Shopping Mela" },
      {
        property: "og:description",
        content:
          "Dedicated authentication panels for Australian customers, verified Indian marketplace sellers, and operations staff.",
      },
    ],
  }),
  component: SignInPage,
});

function SignInPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { user, signIn, signUp, resetPassword } = useAuth();

  // Active portal tab: customer, seller, or admin
  const [portal, setPortal] = useState<PortalType>(() => {
    if (search.portal) return search.portal;
    if (search.redirect?.startsWith("/admin")) return "admin";
    if (search.redirect?.startsWith("/sell")) return "seller";
    return "customer";
  });

  // Active mode inside portal: signin, signup, forgot
  const [mode, setMode] = useState<AuthMode>(() => {
    if (search.mode) return search.mode;
    return "signin";
  });

  // Controlled form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  // Sync state if search params change
  useEffect(() => {
    if (search.portal && search.portal !== portal) {
      setPortal(search.portal);
    }
  }, [search.portal]);

  // If already authenticated and matches requested portal, route appropriately
  useEffect(() => {
    if (!user) return;

    if (search.redirect) {
      navigate({ to: search.redirect as any });
      return;
    }

    if (
      portal === "admin" &&
      ["admin_super", "admin_finance", "admin_catalogue", "admin_support"].includes(user.role)
    ) {
      navigate({ to: "/admin" });
    } else if (
      portal === "seller" &&
      ["seller_owner", "seller_staff"].includes(user.role)
    ) {
      navigate({ to: "/sell" });
    }
  }, [user, portal, search.redirect, navigate]);

  const handlePortalSwitch = (newPortal: PortalType) => {
    setPortal(newPortal);
    // Admin portal only supports signin and forgot
    if (newPortal === "admin" && mode === "signup") {
      setMode("signin");
    }
    navigate({
      search: {
        ...search,
        portal: newPortal,
        mode: newPortal === "admin" && mode === "signup" ? "signin" : mode,
      },
    });
  };

  const handleModeSwitch = (newMode: AuthMode) => {
    setMode(newMode);
    navigate({
      search: {
        ...search,
        portal,
        mode: newMode,
      },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "signin") {
        const loggedUser = await signIn(email, password);
        toast.success(`Welcome back, ${loggedUser.fullName || loggedUser.email}!`);

        if (search.redirect) {
          navigate({ to: search.redirect as any });
          return;
        }

        // Targeted portal routing
        if (portal === "admin") {
          const isAdmin = [
            "admin_super",
            "admin_finance",
            "admin_catalogue",
            "admin_support",
          ].includes(loggedUser.role);
          if (!isAdmin) {
            toast.error("Access restricted: This account does not hold administrative privileges.");
          }
          navigate({ to: "/admin" });
        } else if (portal === "seller") {
          navigate({ to: "/sell" });
        } else {
          // Customer
          navigate({ to: "/account", search: { tab: "overview" } });
        }
      } else if (mode === "signup") {
        const displayName = portal === "seller" ? businessName || fullName : fullName;
        const result = await signUp(email, password, displayName, phone);

        if (result.requiresEmailVerification) {
          toast.success(
            "Account created! Please check your email inbox to verify your email address.",
          );
        } else {
          toast.success("Account created successfully!");
          if (portal === "seller") {
            // New seller registration -> direct to onboarding workflow
            navigate({ to: "/sell/onboarding" });
          } else if (search.redirect) {
            navigate({ to: search.redirect as any });
          } else {
            navigate({ to: "/account", search: { tab: "overview" } });
          }
        }
      } else if (mode === "forgot") {
        await resetPassword(email);
        toast.success("Password reset instructions sent to your email.");
        setMode("signin");
      }
    } catch (err: any) {
      toast.error(err?.message || "Authentication failed. Please verify your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ShopLayout>
      <div className="ism-container flex flex-col items-center py-10 md:py-14">
        {/* Top Segmented Portal Switcher */}
        <div className="mb-6 flex w-full max-w-xl items-center justify-between rounded-lg border border-border bg-surface p-1 shadow-sm">
          <button
            type="button"
            onClick={() => handlePortalSwitch("customer")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2.5 text-xs font-bold uppercase tracking-wider transition-all ${
              portal === "customer"
                ? "bg-rani text-rani-foreground shadow-sm"
                : "text-muted-foreground hover:bg-card hover:text-foreground"
            }`}
          >
            <User className="h-4 w-4" />
            <span>Customer</span>
          </button>

          <button
            type="button"
            onClick={() => handlePortalSwitch("seller")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2.5 text-xs font-bold uppercase tracking-wider transition-all ${
              portal === "seller"
                ? "bg-rani text-rani-foreground shadow-sm"
                : "text-muted-foreground hover:bg-card hover:text-foreground"
            }`}
          >
            <Store className="h-4 w-4" />
            <span>Seller Centre</span>
          </button>

          <button
            type="button"
            onClick={() => handlePortalSwitch("admin")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2.5 text-xs font-bold uppercase tracking-wider transition-all ${
              portal === "admin"
                ? "bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900"
                : "text-muted-foreground hover:bg-card hover:text-foreground"
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Admin</span>
          </button>
        </div>

        {/* Main Authentication Card */}
        <div className="w-full max-w-md rounded-md border border-border bg-card p-6 shadow-sm md:p-8">
          {/* Submode Switcher (Sign In vs Create Account vs Reset) */}
          {portal !== "admin" ? (
            <div className="flex border-b border-border pb-3">
              <button
                type="button"
                onClick={() => handleModeSwitch("signin")}
                className={`flex-1 pb-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                  mode === "signin"
                    ? "border-b-2 border-rani text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {portal === "seller" ? "Seller Sign In" : "Sign In"}
              </button>
              <button
                type="button"
                onClick={() => handleModeSwitch("signup")}
                className={`flex-1 pb-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                  mode === "signup"
                    ? "border-b-2 border-rani text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {portal === "seller" ? "Register as Seller" : "Create Account"}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                <Lock className="h-3.5 w-3.5 text-rani" />
                Staff Authentication
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                Encrypted Session
              </span>
            </div>
          )}

          {/* Portal & Mode Header */}
          <div className="mt-5">
            <h1 className="font-display text-xl font-bold text-primary">
              {portal === "customer" && (
                <>
                  {mode === "signin" && "Welcome back to the Mela"}
                  {mode === "signup" && "Create your ISM Account"}
                  {mode === "forgot" && "Reset your password"}
                </>
              )}

              {portal === "seller" && (
                <>
                  {mode === "signin" && "Seller Centre Sign In"}
                  {mode === "signup" && "Start Selling on ISM Australia"}
                  {mode === "forgot" && "Reset Seller Password"}
                </>
              )}

              {portal === "admin" && (
                <>
                  {mode === "signin" && "Marketplace Governance Console"}
                  {mode === "forgot" && "Staff Credential Recovery"}
                </>
              )}
            </h1>

            <p className="mt-1 text-xs text-muted-foreground">
              {portal === "customer" && (
                <>
                  {mode === "signin" &&
                    "Access your Australian Indian marketplace orders, returns, and saved items."}
                  {mode === "signup" &&
                    "Enjoy fast multi-vendor checkout, order tracking, and Australian buyer protection."}
                  {mode === "forgot" &&
                    "Enter your registered customer email to receive password reset instructions."}
                </>
              )}

              {portal === "seller" && (
                <>
                  {mode === "signin" &&
                    "Manage your catalog, AusPost/Sendle shipments, daily AUD payouts, and customer inquiries."}
                  {mode === "signup" &&
                    "Reach thousands of Indian shoppers across Australia. 0% listing fee, daily payouts."}
                  {mode === "forgot" &&
                    "Enter your merchant store email to reset your Seller Centre password."}
                </>
              )}

              {portal === "admin" && (
                <>
                  {mode === "signin" &&
                    "Authorized Indian Shopping Mela staff, finance controllers, and catalog moderators only."}
                  {mode === "forgot" &&
                    "Enter your administrative work email to initiate password recovery."}
                </>
              )}
            </p>
          </div>

          {/* Seller Sign-up Highlight Banner */}
          {portal === "seller" && mode === "signup" && (
            <div className="mt-4 rounded-md border border-rani/20 bg-rani/5 p-3 text-xs text-foreground">
              <div className="flex items-center gap-1.5 font-bold text-rani">
                <Sparkles className="h-4 w-4" />
                <span>Fast-track Seller Onboarding</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                After signing up, you will immediately proceed to ABN verification, dispatch
                address setup, and Australian banking details.
              </p>
            </div>
          )}

          {/* Admin Security Notice */}
          {portal === "admin" && (
            <div className="mt-4 rounded-md border border-border bg-surface p-3 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                <span>Administrative Access Notice</span>
              </div>
              <p className="mt-0.5">
                All platform modifications, financial disbursements, and moderation actions are
                cryptographically logged with IP and audit timestamps.
              </p>
            </div>
          )}

          {/* Form */}
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {/* Seller Specific: Business/Trading Name */}
            {portal === "seller" && mode === "signup" && (
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Business or Trading Name <span className="text-rani">*</span>
                </label>
                <div className="relative mt-1">
                  <input
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Royal Silks Sydney"
                    className="h-11 w-full rounded-sm border border-input bg-surface px-3 text-sm outline-none focus:border-rani"
                  />
                  <Building2 className="absolute right-3 top-3 h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            )}

            {/* Customer & Seller Sign-up: Contact Name */}
            {mode === "signup" && (
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  {portal === "seller" ? "Primary Contact / Store Owner Name" : "Full Name"}{" "}
                  <span className="text-rani">*</span>
                </label>
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={portal === "seller" ? "Priya Sharma" : "Aarav Patel"}
                  className="mt-1 h-11 w-full rounded-sm border border-input bg-surface px-3 text-sm outline-none focus:border-rani"
                />
              </div>
            )}

            {/* Email Address */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                {portal === "seller"
                  ? "Business / Merchant Email"
                  : portal === "admin"
                    ? "Staff Work Email"
                    : "Email Address"}{" "}
                <span className="text-rani">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={
                  portal === "seller"
                    ? "orders@mystore.com.au"
                    : portal === "admin"
                      ? "ops@indianshoppingmela.com.au"
                      : "aarav@example.com.au"
                }
                className="mt-1 h-11 w-full rounded-sm border border-input bg-surface px-3 text-sm outline-none focus:border-rani"
              />
            </div>

            {/* Mobile Number for Sign-up */}
            {mode === "signup" && (
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Australian Mobile Number {portal === "seller" ? "(Required)" : "(Optional)"}{" "}
                  {portal === "seller" && <span className="text-rani">*</span>}
                </label>
                <input
                  required={portal === "seller"}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0412 345 678"
                  className="mt-1 h-11 w-full rounded-sm border border-input bg-surface px-3 text-sm outline-none focus:border-rani"
                />
              </div>
            )}

            {/* Password */}
            {mode !== "forgot" && (
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    Password <span className="text-rani">*</span>
                  </label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => handleModeSwitch("forgot")}
                      className="text-[11px] font-semibold text-rani hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1 h-11 w-full rounded-sm border border-input bg-surface px-3 text-sm outline-none focus:border-rani"
                />
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full rounded-sm py-3 text-sm font-bold uppercase tracking-wide transition-opacity hover:opacity-90 disabled:opacity-50 ${
                portal === "admin"
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "bg-rani text-rani-foreground"
              }`}
            >
              {loading
                ? "Processing..."
                : mode === "signin"
                  ? portal === "seller"
                    ? "Sign In to Seller Centre"
                    : portal === "admin"
                      ? "Authenticate Admin Session"
                      : "Sign In"
                  : mode === "signup"
                    ? portal === "seller"
                      ? "Register & Continue Onboarding"
                      : "Create Account"
                    : "Send Password Reset Link"}
            </button>
          </form>

          {/* Mode Switch Helpers */}
          {mode === "forgot" && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => handleModeSwitch("signin")}
                className="text-xs font-semibold text-primary hover:underline"
              >
                ← Back to sign in
              </button>
            </div>
          )}

          {/* Portal Switcher Footer Links */}
          <div className="mt-6 space-y-2.5 border-t border-border pt-5 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Marketplace Portals & Direct Links
            </p>
            <div className="grid gap-2 text-xs">
              {portal !== "customer" && (
                <button
                  type="button"
                  onClick={() => handlePortalSwitch("customer")}
                  className="flex items-center justify-between rounded-sm border border-border bg-surface px-3 py-2 font-semibold text-primary transition-colors hover:border-rani hover:text-rani"
                >
                  <span className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-rani" />
                    Customer Sign In & Account
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}

              {portal !== "seller" && (
                <button
                  type="button"
                  onClick={() => {
                    handlePortalSwitch("seller");
                    handleModeSwitch("signup");
                  }}
                  className="flex items-center justify-between rounded-sm border border-border bg-surface px-3 py-2 font-semibold text-primary transition-colors hover:border-rani hover:text-rani"
                >
                  <span className="flex items-center gap-2">
                    <Store className="h-3.5 w-3.5 text-rani" />
                    Become a Seller on ISM (New Merchant)
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}

              {portal !== "admin" && (
                <button
                  type="button"
                  onClick={() => handlePortalSwitch("admin")}
                  className="flex items-center justify-between rounded-sm border border-border bg-surface px-3 py-2 font-semibold text-primary transition-colors hover:border-slate-800 hover:text-slate-800 dark:hover:border-slate-200 dark:hover:text-slate-200"
                >
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="h-3.5 w-3.5 text-slate-700 dark:text-slate-300" />
                    Marketplace Staff & Governance
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}

              {portal === "seller" && (
                <Link
                  to="/sell/onboarding"
                  className="flex items-center justify-between rounded-sm border border-rani/30 bg-rani/5 px-3 py-2 font-semibold text-rani transition-colors hover:bg-rani/10"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5" />
                    Resume Seller Onboarding Application
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </ShopLayout>
  );
}

