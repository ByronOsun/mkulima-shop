import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "employee";
export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  shop_id: string | null;
}
export interface Shop {
  id: string;
  name: string;
  slug: string;
  contact_info: string | null;
  accent: string;
}

interface AuthCtx {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  shop: Shop | null;
  role: Role | null;
  loading: boolean;
  signIn: (email: string, pin: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) {
        setProfile(null); setShop(null); setRole(null);
      } else {
        // Defer profile fetch
        setTimeout(() => loadContext(s.user.id), 0);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) loadContext(data.session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadContext = async (userId: string) => {
    const [{ data: prof }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    setProfile(prof as Profile | null);
    const r = roles?.find((x) => x.role === "admin") ? "admin" : roles?.[0]?.role ?? null;
    setRole(r as Role | null);
    if (prof?.shop_id) {
      const { data: s } = await supabase.from("shops").select("*").eq("id", prof.shop_id).maybeSingle();
      setShop(s as Shop | null);
    } else setShop(null);
    // Update last_login best effort
    await supabase.from("profiles").update({ last_login: new Date().toISOString() }).eq("id", userId);
  };

  const signIn = async (email: string, pin: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pin });
    if (error) return { error: error.message };
    return {};
  };
  const signOut = async () => { await supabase.auth.signOut(); };

  return (
    <Ctx.Provider value={{ user: session?.user ?? null, session, profile, shop, role, loading, signIn, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
