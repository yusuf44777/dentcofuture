import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

const PROFILE_ID_KEY = "dentco_mobile_networking_profile_id";

type NetworkingSessionState = {
  hydrated: boolean;
  profileId: string | null;
  hydrate: () => Promise<void>;
  setProfileId: (profileId: string | null) => Promise<void>;
  reset: () => Promise<void>;
};

export const useNetworkingSessionStore = create<NetworkingSessionState>((set) => ({
  hydrated: false,
  profileId: null,
  hydrate: async () => {
    const storedProfileId = await SecureStore.getItemAsync(PROFILE_ID_KEY);
    set({
      hydrated: true,
      profileId: storedProfileId?.trim() ? storedProfileId.trim() : null
    });
  },
  setProfileId: async (profileId) => {
    if (profileId) {
      await SecureStore.setItemAsync(PROFILE_ID_KEY, profileId);
    } else {
      await SecureStore.deleteItemAsync(PROFILE_ID_KEY);
    }

    set({ profileId });
  },
  reset: async () => {
    await SecureStore.deleteItemAsync(PROFILE_ID_KEY);
    set({ profileId: null });
  }
}));
