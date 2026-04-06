import { useEffect } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Redirect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ScreenShell } from "../src/components/screen-shell";
import { fetchMobileMe } from "../src/lib/mobile-api";
import { useAuthSessionStore } from "../src/store/auth-session";
import { colors, radii, spacing, typography } from "../src/theme/tokens";

export default function IndexScreen() {
  const hydrated = useAuthSessionStore((state) => state.hydrated);
  const session = useAuthSessionStore((state) => state.session);
  const setMe = useAuthSessionStore((state) => state.setMe);
  const clear = useAuthSessionStore((state) => state.clear);

  const meQuery = useQuery({
    queryKey: ["mobile-me", session?.accessToken],
    queryFn: fetchMobileMe,
    enabled: hydrated && Boolean(session),
    retry: 1,
    staleTime: 30_000
  });

  useEffect(() => {
    if (meQuery.data) {
      setMe(meQuery.data);
    }
  }, [meQuery.data, setMe]);

  if (!hydrated) {
    return (
      <ScreenShell
        title="DentCo Outlier"
        subtitle="Uygulama güvenli oturum ve rol durumunu hazırlıyor."
      >
        <View style={styles.loaderCard}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loaderTitle}>Oturum hazırlanıyor</Text>
          <Text style={styles.loaderText}>Giriş bilgileri güvenli depodan okunuyor.</Text>
        </View>
      </ScreenShell>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  if (meQuery.isLoading) {
    return (
      <ScreenShell
        title="DentCo Outlier"
        subtitle="Rol bilgisi doğrulanıyor."
      >
        <View style={styles.loaderCard}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loaderTitle}>Profil kontrolü yapılıyor</Text>
          <Text style={styles.loaderText}>Katılımcı ve ekip yetkileri yükleniyor.</Text>
        </View>
      </ScreenShell>
    );
  }

  if (meQuery.isError || !meQuery.data) {
    return (
      <ScreenShell
        title="Oturum Doğrulanamadı"
        subtitle="Güvenli girişin devamı için tekrar oturum açmanız gerekiyor."
      >
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>
            {meQuery.error instanceof Error ? meQuery.error.message : "Profil doğrulaması başarısız."}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.resetButton, pressed ? styles.resetButtonPressed : null]}
            onPress={() => {
              void clear();
            }}
          >
            <Text style={styles.resetButtonText}>Tekrar Giriş Yap</Text>
          </Pressable>
        </View>
      </ScreenShell>
    );
  }

  return (
    <Redirect
      href={(meQuery.data.role === "staff" ? "/(staff)" : "/(participant)") as never}
    />
  );
}

const styles = StyleSheet.create({
  loaderCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl
  },
  loaderTitle: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 20,
    fontWeight: "700",
    marginTop: spacing.md
  },
  loaderText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.sm,
    textAlign: "center"
  },
  errorCard: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.lg,
    padding: spacing.lg
  },
  errorText: {
    color: colors.danger,
    fontFamily: typography.body,
    fontSize: 14,
    lineHeight: 20
  },
  resetButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.danger,
    borderRadius: radii.pill,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10
  },
  resetButtonPressed: {
    opacity: 0.8
  },
  resetButtonText: {
    color: "#FFFFFF",
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800"
  }
});
