import Stripe from "stripe";

let _stripeInstance: Stripe | null = null;

export const getStripeServer = (): Stripe => {
  if (!_stripeInstance) {
    const key = typeof process !== "undefined" && process.env ? process.env["STRIPE_SECRET_KEY"] : undefined;
    if (!key || key.trim() === "" || key === "mock_stripe_placeholder") {
      if (typeof process !== "undefined" && process.env && process.env["NODE_ENV"] === "production") {
        throw new Error("STRIPE_SECRET_KEY must be configured in production runtime.");
      }
      _stripeInstance = new Stripe("dev_mock_stripe_key", {
        apiVersion: "2025-02-24.acacia" as any,
      });
    } else {
      _stripeInstance = new Stripe(key, {
        apiVersion: "2025-02-24.acacia" as any,
      });
    }
  }
  return _stripeInstance;
};

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const instance = getStripeServer();
    const value = (instance as any)[prop];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
