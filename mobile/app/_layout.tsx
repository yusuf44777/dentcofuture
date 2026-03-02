import { useEffect } from "react";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "../src/theme/tokens";
import { useNetworkingSessionStore } from "../src/store/networking-session";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 12_000,
      gcTime: 60_000
    }
  }
});

function SessionBootstrap() {
  const hydrate = useNetworkingSessionStore((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionBootstrap />
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            animation: "fade",
            contentStyle: { backgroundColor: colors.background },
            headerShown: false
          }}
        />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
