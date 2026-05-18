import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Activity } from "lucide-react";
import { usernameFromEmail } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";

type Log = Tables<"activity_logs">;

export function ActivityFeed() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const load = async () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
      const { data } = await supabase
        .from("activity_logs")
        .select("*")
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: false })
        .limit(50);
      const arr = (data ?? []) as Log[];
      setLogs(arr);
      const ids = Array.from(new Set(arr.map((l) => l.employee_id).filter(Boolean))) as string[];
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
        setNames(Object.fromEntries((profs ?? []).map((p) => [p.id, usernameFromEmail(p.email)])));
      }
    };
    load();
    const ch = supabase.channel("admin-activity").on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_logs" }, () => load()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3"><Activity className="h-4 w-4" /><h3 className="font-semibold">Live Activity</h3></div>
      <div className="space-y-2 max-h-[300px] sm:max-h-[400px] overflow-auto">
        {logs.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
        {logs.map((l) => (
          <div key={l.id} className="text-sm border-b last:border-0 pb-2">
            <p><span className="font-medium">{names[l.employee_id ?? ""] ?? "Unknown"}</span> · {l.action}</p>
            <p className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleTimeString()} {l.details && typeof l.details === "object" && "total" in (l.details as object) ? `· KES ${(l.details as { total: number }).total}` : ""}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
