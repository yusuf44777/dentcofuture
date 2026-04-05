"use client";
import { useState, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Attendee } from "@/lib/types";

const STORAGE_KEY = "dentco_outliers_attendee_id";

export function useAttendee() {
  const [attendee, setAttendee] = useState<Attendee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = localStorage.getItem(STORAGE_KEY);
    if (!id) { setLoading(false); return; }

    const sb = createSupabaseBrowserClient();
    sb.from("attendees")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data }) => {
        setAttendee(data as Attendee | null);
        setLoading(false);
      });
  }, []);

  const setAttendeeId = (id: string) => {
    localStorage.setItem(STORAGE_KEY, id);
  };

  const clearAttendee = () => {
    localStorage.removeItem(STORAGE_KEY);
    setAttendee(null);
  };

  return { attendee, loading, setAttendeeId, setAttendee, clearAttendee };
}

export function getStoredAttendeeId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}
