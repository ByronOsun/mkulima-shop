import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Lock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { signIn, session, role, shop, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) {
      if (role === "admin") {
        navigate({ to: "/admin" });
        return;
      }
      if (shop?.slug === "depot") {
        navigate({ to: "/depot/pos" });
        return;
      }
      if (shop?.slug === "beauty") {
        navigate({ to: "/beauty/pos" });
        return;
      }
      navigate({ to: "/pos" });
    }
  }, [session, role, shop, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(email.trim().toLowerCase(), pin);
    setBusy(false);
    if (error) toast.error("Login failed", { description: "Check your email and PIN." });
  };

  return (
    <div className="min-h-screen flex items-start justify-center bg-gradient-to-br from-background to-muted px-4 pt-8 pb-10 md:items-center md:pt-0">
      <Card className="w-full max-w-sm sm:max-w-[800px] shadow-xl rounded-2xl">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShoppingBag className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Point Of Sale Terminal</CardTitle>
          <CardDescription>Sign in</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@multishop.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pin">PIN</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="pin" type="password" inputMode="numeric" pattern="[0-9]*" maxLength={6} className="pl-9" value={pin} onChange={(e) => setPin(e.target.value)} required />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
