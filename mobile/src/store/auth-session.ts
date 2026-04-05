import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import type { MobileMe } from "../lib/mobile-contracts";

const AUTH_SESSION_KEY = "dentco_mobile_auth_session_v1";

type StoredAuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
  email?: string;
};

type AuthSessionState = {
  hydrated: boolean;
  session: StoredAuthSession | null;
  me: MobileMe | null;
  hydrate: () => Promise<void>;
  setSession: (session: StoredAuthSession | null) => Promise<void>;
  setMe: (me: MobileMe | null) => void;
  clear: () => Promise<void>;
};

function parseStoredSession(raw: string | null): StoredAuthSession | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredAuthSession;
    if (!parsed || typeof parsed.accessToken !== "string" || typeof parsed.refreshToken !== "string") {
      return null;
    }

    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      expiresAt: typeof parsed.expiresAt === "number" ? parsed.expiresAt : undefined,
      email: typeof parsed.email === "string" ? parsed.email : undefined
    };
  } catch {
    return null;
  }
}

export const useAuthSessionStore = create<AuthSessionState>((set) => ({
  hydrated: false,
  session: null,
  me: null,
  hydrate: async () => {
    const raw = await SecureStore.getItemAsync(AUTH_SESSION_KEY);
    set({
      hydrated: true,
      session: parseStoredSession(raw)
    });
  },
  setSession: async (session) => {
    if (session) {
      await SecureStore.setItemAsync(AUTH_SESSION_KEY, JSON.stringify(session));
    } else {
      await SecureStore.deleteItemAsync(AUTH_SESSION_KEY);
    }

    set({
      session,
      me: session ? null : null
    });
  },
  setMe: (me) => {
    set({ me });
  },
  clear: async () => {
    await SecureStore.deleteItemAsync(AUTH_SESSION_KEY);
    set({ session: null, me: null });
  }
}));

export type { StoredAuthSession };
