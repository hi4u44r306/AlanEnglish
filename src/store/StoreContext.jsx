import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { storeSupabase } from "./storeSupabase";

const CART_KEY = "ae-store-cart-v1";
const StoreContext = createContext(null);

const readCart = () => {
    if (typeof window === "undefined") return [];
    try {
        const parsed = JSON.parse(window.localStorage.getItem(CART_KEY) || "[]");
        return Array.isArray(parsed) ? parsed.filter(item => Number(item?.packageId) > 0 && Number(item?.quantity) > 0) : [];
    } catch { return []; }
};

export function StoreProvider({ children }) {
    const [session, setSession] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [cart, setCart] = useState(readCart);

    useEffect(() => {
        let mounted = true;
        storeSupabase.auth.getSession().then(({ data }) => {
            if (mounted) { setSession(data.session || null); setAuthLoading(false); }
        });
        const { data: listener } = storeSupabase.auth.onAuthStateChange((_event, nextSession) => {
            setSession(nextSession || null); setAuthLoading(false);
        });
        return () => { mounted = false; listener.subscription.unsubscribe(); };
    }, []);

    useEffect(() => {
        window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
    }, [cart]);

    const addToCart = useCallback((product, quantity = 1) => {
        const packageId = Number(product.id);
        const maximum = Math.min(20, Math.max(1, Number(product.max_quantity_per_order || 10)));
        setCart(current => {
            const existing = current.find(item => item.packageId === packageId);
            const nextQuantity = Math.min(maximum, Number(existing?.quantity || 0) + Number(quantity || 1));
            const next = { packageId, quantity: nextQuantity, name: product.name, price: Number(product.standard_price_twd || product.display_price_twd), coverUrl: product.cover_url || "", maximum };
            return existing ? current.map(item => item.packageId === packageId ? next : item) : [...current, next];
        });
    }, []);

    const updateQuantity = useCallback((packageId, quantity) => {
        setCart(current => current.map(item => item.packageId === Number(packageId)
            ? { ...item, quantity: Math.min(item.maximum || 10, Math.max(1, Number(quantity) || 1)) }
            : item));
    }, []);
    const removeFromCart = useCallback(packageId => setCart(current => current.filter(item => item.packageId !== Number(packageId))), []);
    const clearCart = useCallback(() => setCart([]), []);
    const signOut = useCallback(() => storeSupabase.auth.signOut(), []);

    const value = useMemo(() => ({
        session, user: session?.user || null, authLoading, cart,
        cartCount: cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
        addToCart, updateQuantity, removeFromCart, clearCart, signOut
    }), [session, authLoading, cart, addToCart, updateQuantity, removeFromCart, clearCart, signOut]);

    return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export const useStore = () => {
    const value = useContext(StoreContext);
    if (!value) throw new Error("useStore must be used inside StoreProvider");
    return value;
};
