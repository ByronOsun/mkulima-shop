import { useEffect, useState } from "react";
import type { CartItem } from "@/lib/types";

const STORAGE_KEY = "pos_cart_v1";

export function useCart() {
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CartItem[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch {}
  }, [cart]);

  return [cart, setCart] as const;
}
