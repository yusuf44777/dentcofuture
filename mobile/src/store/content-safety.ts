import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

const CONTENT_SAFETY_TERMS_KEY = "dentco_mobile_content_safety_terms_v1";

type ContentSafetyState = {
  hydrated: boolean;
  acceptedAt: string | null;
  hydrate: () => Promise<void>;
  accept: () => Promise<void>;
  reset: () => Promise<void>;
};

export const useContentSafetyStore = create<ContentSafetyState>((set) => ({
  hydrated: false,
  acceptedAt: null,
  hydrate: async () => {
    try {
      const acceptedAt = await SecureStore.getItemAsync(CONTENT_SAFETY_TERMS_KEY);
      set({
        hydrated: true,
        acceptedAt: acceptedAt?.trim() ? acceptedAt : null
      });
    } catch {
      set({
        hydrated: true,
        acceptedAt: null
      });
    }
  },
  accept: async () => {
    const acceptedAt = new Date().toISOString();
    await SecureStore.setItemAsync(CONTENT_SAFETY_TERMS_KEY, acceptedAt);
    set({ acceptedAt });
  },
  reset: async () => {
    await SecureStore.deleteItemAsync(CONTENT_SAFETY_TERMS_KEY);
    set({ acceptedAt: null });
  }
}));
