import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
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
  ) => void;
  setQty: (id: string, qty: number) => void;
  removeFromCart: (id: string) => void;
  toggleWishlist: (id: string) => void;
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
  if (!token) {
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
      }
    });

    return () => {
      authSub?.subscription?.unsubscribe();
    };
  }, []);

  const updateCart = useCallback((updater: (prev: CartLine[]) => CartLine[]) => {
    setCart((prev) => {
      const next = updater(prev);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore quota error
        }
      }
      return next;
    });
  }, []);

  const updateWishlist = useCallback((updater: (prev: string[]) => string[]) => {
    setWishlist((prev) => {
      const next = updater(prev);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
      }
      return next;
    });
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
        updateCart(() => mappedLines);
      } else if (serverCart && serverCart.items.length === 0 && userId) {
        // Clear local cache if remote DB cart is empty
        updateCart(() => []);
      }
    } catch (err) {
      console.warn("Could not sync cart from database:", err);
    }
  }, [userId, updateCart]);

  const refreshWishlistFromServer = useCallback(async () => {
    if (!userId || typeof window === "undefined") return;
    try {
      const res = await getWishlistServerFn({ data: { userId } });
      if (res?.productIds) {
        updateWishlist(() => res.productIds);
      }
    } catch (err) {
      console.warn("Could not sync wishlist from database:", err);
    }
  }, [userId, updateWishlist]);

  useEffect(() => {
    refreshCartFromServer();
    refreshWishlistFromServer();
  }, [refreshCartFromServer, refreshWishlistFromServer]);

  const addToCart = useCallback<Ctx["addToCart"]>(
    (id, opts) => {
      const qtyToAdd = opts?.qty ?? 1;
      const variantId = opts?.variantId ?? id;

      updateCart((prev) => {
        const existing = prev.find((l) => l.variantId === variantId || l.id === id);
        if (existing) {
          return prev.map((l) =>
            l.variantId === variantId || l.id === id ? { ...l, qty: l.qty + qtyToAdd } : l,
          );
        }
        return [
          ...prev,
          {
            id,
            qty: qtyToAdd,
            size: opts?.size,
            colour: opts?.colour,
            variantId,
          },
        ];
      });

      // Background authoritative server mutation
      if (typeof window !== "undefined") {
        const token = getOrCreateGuestToken();
        addToCartServerFn({
          data: {
            userId: userId ?? undefined,
            guestToken: userId ? undefined : token,
            variantId,
            quantity: qtyToAdd,
          },
        }).catch((err) => {
          console.warn("Background addToCartServerFn failed:", err);
        });
      }
    },
    [userId, updateCart],
  );

  const setQty = useCallback(
    (id: string, qty: number) => {
      const line = cart.find((l) => l.id === id || l.variantId === id);
      const lineId = line?.lineId;

      updateCart((prev) =>
        qty <= 0
          ? prev.filter((l) => l.id !== id && l.variantId !== id)
          : prev.map((l) => (l.id === id || l.variantId === id ? { ...l, qty } : l)),
      );

      if (lineId && typeof window !== "undefined") {
        updateCartQtyServerFn({
          data: { lineId, quantity: qty },
        }).catch((err) => {
          console.warn("Background updateCartQtyServerFn failed:", err);
        });
      }
    },
    [cart, updateCart],
  );

  const removeFromCart = useCallback(
    (id: string) => {
      const line = cart.find((l) => l.id === id || l.variantId === id);
      const lineId = line?.lineId;

      updateCart((prev) => prev.filter((l) => l.id !== id && l.variantId !== id));

      if (lineId && typeof window !== "undefined") {
        removeFromCartServerFn({
          data: { lineId },
        }).catch((err) => {
          console.warn("Background removeFromCartServerFn failed:", err);
        });
      }
    },
    [cart, updateCart],
  );

  const toggleWishlist = useCallback(
    (id: string) => {
      updateWishlist((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

      if (userId && typeof window !== "undefined") {
        toggleWishlistServerFn({
          data: { userId, productId: id },
        }).catch((err) => {
          console.warn("Background toggleWishlistServerFn failed:", err);
        });
      }
    },
    [userId, updateWishlist],
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
