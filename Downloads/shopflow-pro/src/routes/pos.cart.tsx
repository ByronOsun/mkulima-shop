import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Cart } from "@/components/Cart";
import { useCart } from "@/lib/useCart";
import { ArrowLeft } from "lucide-react";
import { CheckoutModal } from "@/components/CheckoutModal";
import { useState } from "react";

export const Route = createFileRoute("/pos/cart")({ component: CartPage });

function CartPage() {
  const navigate = useNavigate();
  const [cart, setCart] = useCart();
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <header className="px-4 py-3 flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/pos" })}>
          <ArrowLeft className="h-4 w-4 mr-1" />Back to POS
        </Button>
        <h2 className="text-lg font-semibold">Shopping Cart ({cart.length})</h2>
        <div className="w-24" />
      </header>

      <main className="flex-1 min-h-0 p-4">
        <div className="max-w-3xl mx-auto h-full">
          <Cart items={cart} onChange={setCart} onCheckout={() => setCheckoutOpen(true)} />
        </div>
      </main>

      <CheckoutModal
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        items={cart}
        onComplete={(id) => {
          setCart([]);
          setCheckoutOpen(false);
          navigate({ to: "/receipt/$id", params: { id } });
        }}
      />
    </div>
  );
}
