import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { PRODUCTS, productById } from "./ism-data";
import {
  addToCartServerFn,
  getCartServerFn,
  removeFromCartServerFn,
  updateCartQtyServerFn,
  mergeGuestCartServerFn,
  getWishlistServerFn,
  toggleWishlistServerFn,
} from "./api/cart";
import { supabase } from "./supabase/client";

export type CartLine = {
  id: string; // product id or line id
  lineId?: string | undefined;
  qty: number;
  size?: string | undefined;
  colour?: string | undefined;
  variantId?: string | undefined;
};

type Ctx = {
  cart: CartLine[];
  wishlist: string[];
  cartCount: number;
  guestToken: string;
  userId: string | null;
  addToCart: (
    id: string,
    opts?: {
      qty?: number | undefined;
      size?: string | undefined;
      colour?: string | undefined;
      variantId?: string | undefined;
    },
  ) => Promise<void>;
  setQty: (id: string, qty: number) => Promise<void>;
  removeFromCart: (id: string) => Promise<void>;
  toggleWishlist: (id: string) => Promise<void>;
  isWishlisted: (id: string) => boolean;
  subtotal: number;
  refreshCartFromServer: () => Promise<void>;
  refreshWishlistFromServer: () => Promise<void>;
};

const IsmContext = createContext<Ctx | null>(null);

const CART_STORAGE_KEY = "ism_cart_v1";
const WISHLIST_STORAGE_KEY = "ism_wishlist_v1";
const GUEST_TOKEN_KEY = "ism_guest_token_v1";

export function getOrCreateGuestToken(): string {
  if (typeof window === "undefined") return "ssr-guest-token";
  let token = localStorage.getItem(GUEST_TOKEN_KEY);
  // Validate token format: alphanumeric, underscore, hyphen, 8-64 chars
  if (!token || !/^[a-zA-Z0-9_-]{8,64}$/.test(token)) {
    token =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `guest_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(GUEST_TOKEN_KEY, token);
  }
  return token;
}

export function IsmProvider({ children }: { children: ReactNode }) {
  const [guestToken] = useState<string>(() => getOrCreateGuestToken());
  const [userId, setUserId] = useState<string | null>(null);

  const [cart, setCart] = useState<CartLine[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [wishlist, setWishlist] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem(WISHLIST_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const updateCartCache = useCallback((lines: CartLine[]) => {
    setCart(lines);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
      } catch {
        // ignore storage quota errors
      }
    }
  }, []);

  const updateWishlistCache = useCallback((ids: string[]) => {
    setWishlist(ids);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(ids));
      } catch {
        // ignore
      }
    }
  }, []);

  const refreshCartFromServer = useCallback(async () => {
    if (typeof window === "undefined") return;
    try {
      const token = getOrCreateGuestToken();
      const serverCart = await getCartServerFn({
        data: {
          userId: userId ?? undefined,
          guestToken: userId ? undefined : token,
        },
      });

      if (serverCart && serverCart.items.length > 0) {
        const mappedLines: CartLine[] = serverCart.items.map((item) => ({
          id: item.productId,
          lineId: item.lineId,
          variantId: item.variantId,
          qty: item.quantity,
          size: item.variantTitle,
          colour: undefined,
        }));
        updateCartCache(mappedLines);
      } else if (serverCart && serverCart.items.length === 0 && userId) {
        // Clear local cache if remote DB cart is empty
        updateCartCache([]);
      }
    } catch (err) {
      console.warn("Could not sync cart from database:", err);
    }
  }, [userId, updateCartCache]);

  const refreshWishlistFromServer = useCallback(async () => {
    if (!userId || typeof window === "undefined") return;
    try {
      const res = await getWishlistServerFn({ data: { userId } });
      if (res?.productIds) {
        updateWishlistCache(res.productIds);
      }
    } catch (err) {
      console.warn("Could not sync wishlist from database:", err);
    }
  }, [userId, updateWishlistCache]);

  // Track Supabase Auth user session changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id ?? null);
    });

    const { data: authSub } = supabase.auth.onAuthStateChange(async (event, session) => {
      const newUserId = session?.user?.id ?? null;
      setUserId(newUserId);

      // On Sign-In: Merge guest cart into user account cart
      if (
        (event === "SIGNED_IN" || event === "USER_UPDATED") &&
        newUserId &&
        typeof window !== "undefined"
      ) {
        const token = getOrCreateGuestToken();
        try {
          await mergeGuestCartServerFn({ data: { userId: newUserId, guestToken: token } });
        } catch (err) {
          console.warn("Guest cart merge warning:", err);
        }
        await refreshCartFromServer();
        await refreshWishlistFromServer();
      }
    });

    return () => {
      authSub?.subscription?.unsubscribe();
    };
  }, [refreshCartFromServer, refreshWishlistFromServer]);

  useEffect(() => {
    refreshCartFromServer();
    refreshWishlistFromServer();
  }, [refreshCartFromServer, refreshWishlistFromServer]);

  const addToCart = useCallback<Ctx["addToCart"]>(
    async (id, opts) => {
      const qtyToAdd = opts?.qty ?? 1;
      const variantId = opts?.variantId ?? id;

      let previousSnapshot: CartLine[] = [];
      setCart((prev) => {
        previousSnapshot = prev;
        const existing = prev.find((l) => l.variantId === variantId || l.id === id);
        const next = existing
          ? prev.map((l) =>
              l.variantId === variantId || l.id === id ? { ...l, qty: l.qty + qtyToAdd } : l,
            )
          : [
              ...prev,
              {
                id,
                qty: qtyToAdd,
                size: opts?.size,
                colour: opts?.colour,
                variantId,
              },
            ];
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next));
          } catch {}
        }
        return next;
      });

      // Authoritative database mutation
      if (typeof window !== "undefined") {
        const token = getOrCreateGuestToken();
        try {
          await addToCartServerFn({
            data: {
              userId: userId ?? undefined,
              guestToken: userId ? undefined : token,
              variantId,
              quantity: qtyToAdd,
            },
          });
          await refreshCartFromServer();
        } catch (err: any) {
          console.error("addToCartServerFn failed:", err);
          // Revert optimistic state on failure
          updateCartCache(previousSnapshot);
          const errorMsg =
            err?.message || "Could not add item to cart. Please check stock availability.";
          toast.error(errorMsg);
          await refreshCartFromServer();
        }
      }
    },
    [userId, refreshCartFromServer, updateCartCache],
  );

  const setQty = useCallback(
    async (id: string, qty: number) => {
      let previousSnapshot: CartLine[] = [];
      let targetLineId: string | undefined;

      setCart((prev) => {
        previousSnapshot = prev;
        const line = prev.find((l) => l.id === id || l.variantId === id);
        targetLineId = line?.lineId;

        const next =
          qty <= 0
            ? prev.filter((l) => l.id !== id && l.variantId !== id)
            : prev.map((l) => (l.id === id || l.variantId === id ? { ...l, qty } : l));

        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next));
          } catch {}
        }
        return next;
      });

      if (typeof window !== "undefined") {
        try {
          if (targetLineId) {
            await updateCartQtyServerFn({
              data: { lineId: targetLineId, quantity: qty },
            });
            await refreshCartFromServer();
          } else {
            await refreshCartFromServer();
          }
        } catch (err: any) {
          console.error("updateCartQtyServerFn failed:", err);
          updateCartCache(previousSnapshot);
          const errorMsg = err?.message || "Could not update item quantity.";
          toast.error(errorMsg);
          await refreshCartFromServer();
        }
      }
    },
    [refreshCartFromServer, updateCartCache],
  );

  const removeFromCart = useCallback(
    async (id: string) => {
      let previousSnapshot: CartLine[] = [];
      let targetLineId: string | undefined;

      setCart((prev) => {
        previousSnapshot = prev;
        const line = prev.find((l) => l.id === id || l.variantId === id);
        targetLineId = line?.lineId;

        const next = prev.filter((l) => l.id !== id && l.variantId !== id);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next));
          } catch {}
        }
        return next;
      });

      if (typeof window !== "undefined") {
        try {
          if (targetLineId) {
            await removeFromCartServerFn({
              data: { lineId: targetLineId },
            });
            await refreshCartFromServer();
          }
        } catch (err: any) {
          console.error("removeFromCartServerFn failed:", err);
          updateCartCache(previousSnapshot);
          const errorMsg = err?.message || "Could not remove item from cart.";
          toast.error(errorMsg);
          await refreshCartFromServer();
        }
      }
    },
    [refreshCartFromServer, updateCartCache],
  );

  const toggleWishlist = useCallback(
    async (id: string) => {
      let previousSnapshot: string[] = [];

      setWishlist((prev) => {
        previousSnapshot = prev;
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(next));
          } catch {}
        }
        return next;
      });

      if (userId && typeof window !== "undefined") {
        try {
          await toggleWishlistServerFn({
            data: { userId, productId: id },
          });
        } catch (err: any) {
          console.error("toggleWishlistServerFn failed:", err);
          updateWishlistCache(previousSnapshot);
          toast.error(err?.message || "Could not update wishlist.");
          await refreshWishlistFromServer();
        }
      }
    },
    [userId, refreshWishlistFromServer, updateWishlistCache],
  );

  const value = useMemo<Ctx>(() => {
    const cartCount = cart.reduce((n, l) => n + l.qty, 0);
    const subtotal = cart.reduce((n, l) => n + (productById(l.id)?.price ?? 0) * l.qty, 0);
    return {
      cart,
      wishlist,
      cartCount,
      guestToken,
      userId,
      addToCart,
      setQty,
      removeFromCart,
      toggleWishlist,
      isWishlisted: (id: string) => wishlist.includes(id),
      subtotal,
      refreshCartFromServer,
      refreshWishlistFromServer,
    };
  }, [
    cart,
    wishlist,
    guestToken,
    userId,
    addToCart,
    setQty,
    removeFromCart,
    toggleWishlist,
    refreshCartFromServer,
    refreshWishlistFromServer,
  ]);

  return <IsmContext.Provider value={value}>{children}</IsmContext.Provider>;
}

export function useIsm() {
  const ctx = useContext(IsmContext);
  if (!ctx) throw new Error("useIsm must be used inside IsmProvider");
  return ctx;
}

export const cartProducts = (cart: CartLine[]) =>
  cart
    .map((line) => ({
      line,
      product: PRODUCTS.find((p) => p.id === line.id)!,
    }))
    .filter((x) => Boolean(x.product));
