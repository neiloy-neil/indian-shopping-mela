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
} from "./api/cart";

export type CartLine = {
  id: string;
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
  addToCart: (
    id: string,
    opts?: {
      qty?: number | undefined;
      size?: string | undefined;
      colour?: string | undefined;
      variantId?: string | undefined;
    }
  ) => void;
  setQty: (id: string, qty: number) => void;
  removeFromCart: (id: string) => void;
  toggleWishlist: (id: string) => void;
  isWishlisted: (id: string) => boolean;
  subtotal: number;
  refreshCartFromServer: () => Promise<void>;
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

  const updateCart = useCallback((updater: (prev: CartLine[]) => CartLine[]) => {
    setCart((prev) => {
      const next = updater(prev);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore storage quota errors
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
      const serverCart = await getCartServerFn({ data: { guestToken: token } });
      if (serverCart && serverCart.items.length > 0) {
        const mappedLines: CartLine[] = serverCart.items.map((item) => ({
          id: item.productId,
          variantId: item.variantId,
          qty: item.quantity,
          size: item.variantTitle,
          colour: undefined,
        }));
        updateCart(() => mappedLines);
      }
    } catch (err) {
      console.warn("Could not sync cart from database:", err);
    }
  }, [updateCart]);

  useEffect(() => {
    // Initial sync
    refreshCartFromServer();
  }, [refreshCartFromServer]);

  const addToCart = useCallback<Ctx["addToCart"]>(
    (id, opts) => {
      updateCart((prev) => {
        const existing = prev.find((l) => l.id === id);
        if (existing) {
          return prev.map((l) =>
            l.id === id ? { ...l, qty: l.qty + (opts?.qty ?? 1) } : l
          );
        }
        return [
          ...prev,
          {
            id,
            qty: opts?.qty ?? 1,
            size: opts?.size,
            colour: opts?.colour,
            variantId: opts?.variantId ?? id,
          },
        ];
      });

      // Background server mutation
      if (typeof window !== "undefined") {
        const token = getOrCreateGuestToken();
        addToCartServerFn({
          data: {
            guestToken: token,
            variantId: opts?.variantId ?? id,
            quantity: opts?.qty ?? 1,
          },
        }).catch((err) => {
          console.warn("Background addToCartServerFn failed:", err);
        });
      }
    },
    [updateCart]
  );

  const setQty = useCallback(
    (id: string, qty: number) => {
      updateCart((prev) =>
        qty <= 0
          ? prev.filter((l) => l.id !== id)
          : prev.map((l) => (l.id === id ? { ...l, qty } : l))
      );
    },
    [updateCart]
  );

  const removeFromCart = useCallback(
    (id: string) => {
      updateCart((prev) => prev.filter((l) => l.id !== id));
    },
    [updateCart]
  );

  const toggleWishlist = useCallback(
    (id: string) => {
      updateWishlist((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    },
    [updateWishlist]
  );

  const value = useMemo<Ctx>(() => {
    const cartCount = cart.reduce((n, l) => n + l.qty, 0);
    const subtotal = cart.reduce(
      (n, l) => n + (productById(l.id)?.price ?? 0) * l.qty,
      0
    );
    return {
      cart,
      wishlist,
      cartCount,
      guestToken,
      addToCart,
      setQty,
      removeFromCart,
      toggleWishlist,
      isWishlisted: (id: string) => wishlist.includes(id),
      subtotal,
      refreshCartFromServer,
    };
  }, [
    cart,
    wishlist,
    guestToken,
    addToCart,
    setQty,
    removeFromCart,
    toggleWishlist,
    refreshCartFromServer,
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
