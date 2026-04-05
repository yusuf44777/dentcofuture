"use client";
import { useEffect, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { RealtimeChannel } from "@supabase/supabase-js";

type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

interface SubscriptionConfig {
  table: string;
  event?: RealtimeEvent;
  filter?: string;
  onData: (payload: { eventType: string; new: unknown; old: unknown }) => void;
}

export function useRealtime(configs: SubscriptionConfig[]) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (configs.length === 0) return;

    const sb = createSupabaseBrowserClient();
    const channelName = `realtime-${configs.map(c => c.table).join("-")}-${Date.now()}`;
    let channel = sb.channel(channelName);

    for (const config of configs) {
      channel = channel.on(
        "postgres_changes" as never,
        {
          event: config.event ?? "*",
          schema: "public",
          table: config.table,
          ...(config.filter ? { filter: config.filter } : {})
        } as never,
        (payload: { eventType: string; new: unknown; old: unknown }) => {
          config.onData(payload);
        }
      );
    }

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      sb.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
