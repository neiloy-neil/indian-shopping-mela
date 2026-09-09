import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ShopLayout } from "@/components/ism/ShopLayout";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/signin")({
  head: () => ({
    meta: [
      { title: "Sign In — Indian Shopping Mela" },
      {
        name: "description",
        content: "Sign in to your Indian Shopping Mela customer account, orders and wishlist.",
      },
      { property: "og:title", content: "Sign In — Indian Shopping Mela" },
      {
        property: "og:description",
        content: "Access your ISM orders, tracking, returns and wishlist.",
      },
    ],
  }),
  component: SignInPage,
});

function SignInPage() {
  const navigate = useNavigate();
  const { signIn, signUp, resetPassword } = useAuth();

  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "signin") {
        await signIn(email, password);
        toast.success(`Welcome back!`);
        navigate({ to: "/account", search: { tab: "overview" } });
      } else if (mode === "signup") {
        const result = await signUp(email, password, fullName, phone);
        if (result.requiresEmailVerification) {
          toast.success("Account created! Please check your email to verify.");
        } else {
          toast.success("Account created successfully!");
          navigate({ to: "/account", search: { tab: "overview" } });
        }
      } else if (mode === "forgot") {
        await resetPassword(email);
        toast.success("Password reset instructions sent to your email.");
        setMode("signin");
      }
    } catch (err: any) {
      toast.error(err?.message || "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ShopLayout>
      <div className="ism-container flex justify-center py-14">
        <div className="w-full max-w-md rounded-md border border-border bg-card p-7 shadow-sm">
          <div className="flex border-b border-border pb-3">
            <button
              onClick={() => setMode("signin")}
              className={`flex-1 pb-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                mode === "signin"
                  ? "border-b-2 border-rani text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`flex-1 pb-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                mode === "signup"
                  ? "border-b-2 border-rani text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Create Account
            </button>
          </div>

          <h1 className="mt-5 font-display text-xl font-bold text-primary">
            {mode === "signin" && "Welcome back to the Mela"}
            {mode === "signup" && "Create your ISM Account"}
            {mode === "forgot" && "Reset your password"}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {mode === "signin" && "Access your Australian Indian marketplace orders & wishlist."}
            {mode === "signup" && "Enjoy fast multi-vendor checkout and package tracking."}
            {mode === "forgot" && "Enter your registered email to receive a password reset link."}
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {mode === "signup" && (
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Full Name <span className="text-rani">*</span>
                </label>
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 h-11 w-full rounded-sm border border-input bg-surface px-3 text-sm outline-none focus:border-rani"
                />
              </div>
            )}

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Email address <span className="text-rani">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 h-11 w-full rounded-sm border border-input bg-surface px-3 text-sm outline-none focus:border-rani"
              />
            </div>

            {mode === "signup" && (
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Mobile Number (optional)
                </label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0400 000 000"
                  className="mt-1 h-11 w-full rounded-sm border border-input bg-surface px-3 text-sm outline-none focus:border-rani"
                />
              </div>
            )}

            {mode !== "forgot" && (
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    Password <span className="text-rani">*</span>
                  </label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
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
                  className="mt-1 h-11 w-full rounded-sm border border-input bg-surface px-3 text-sm outline-none focus:border-rani"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-sm bg-rani py-3 text-sm font-bold uppercase tracking-wide text-rani-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading
                ? "Processing..."
                : mode === "signin"
                  ? "Sign In"
                  : mode === "signup"
                    ? "Create Account"
                    : "Send Reset Link"}
            </button>
          </form>

          {mode === "forgot" && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="text-xs font-semibold text-primary hover:underline"
              >
                ← Back to sign in
              </button>
            </div>
          )}

          <div className="mt-6 space-y-2 border-t border-border pt-5 text-sm">
            <p className="text-xs text-muted-foreground">Seller & Admin portals:</p>
            <Link to="/sell" className="block text-xs font-semibold text-primary hover:text-rani">
              → Seller dashboard & store onboarding
            </Link>
            <Link to="/admin" className="block text-xs font-semibold text-primary hover:text-rani">
              → Marketplace admin governance
            </Link>
          </div>
        </div>
      </div>
    </ShopLayout>
  );
}
