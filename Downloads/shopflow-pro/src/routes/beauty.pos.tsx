import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/beauty/pos")({ component: BeautyPosRedirect });

function BeautyPosRedirect() {
  const { loading, session, role, shop } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!session) return <Navigate to="/login" />;
  if (role === "admin") return <Navigate to="/admin" />;
  if (shop?.slug === "beauty") return <Navigate to="/pos" />;
  return <Navigate to="/" />;
}
