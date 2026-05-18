import type { Tables } from "@/integrations/supabase/types";

export type Product = Tables<"products">;
export type PaymentMode = "cash" | "atm" | "mpesa";

export type CartBottleItem = {
	kind: "bottle";
	product: Product;
	quantity: number;
};

export type CartCrateItem = {
	kind: "crate";
	id: string;
	pricing: "retail" | "wholesale";
	crateCount: number;
	packSize: number;
	mix: Array<{ product: Product; quantity: number }>;
};

export type CartItem = CartBottleItem | CartCrateItem;
