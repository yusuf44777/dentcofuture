import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_KEY");
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: {
      getItem: async (key: string) => {
        if (Platform.OS === "web" && typeof window !== "undefined") {
          return window.localStorage.getItem(key);
        }

        return SecureStore.getItemAsync(key);
      },
      setItem: async (key: string, value: string) => {
        if (Platform.OS === "web" && typeof window !== "undefined") {
          window.localStorage.setItem(key, value);
          return;
        }

        await SecureStore.setItemAsync(key, value);
      },
      removeItem: async (key: string) => {
        if (Platform.OS === "web" && typeof window !== "undefined") {
          window.localStorage.removeItem(key);
          return;
        }

        await SecureStore.deleteItemAsync(key);
      }
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});
