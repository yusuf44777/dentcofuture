import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Redirect } from "expo-router";
import { ScreenShell } from "../src/components/screen-shell";
import { useNetworkingSessionStore } from "../src/store/networking-session";
import { colors, radii, spacing, typography } from "../src/theme/tokens";

export default function IndexScreen() {
  const hydrated = useNetworkingSessionStore((state) => state.hydrated);
  const profileId = useNetworkingSessionStore((state) => state.profileId);

  if (!hydrated) {
    return (
      <ScreenShell
        title="Klinik çevreni büyüt"
        subtitle="Cihaz profili yüklenirken networking uygulaması seni hazır duruma getiriyor."
      >
        <View style={styles.loaderCard}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loaderTitle}>Profil yükleniyor</Text>
          <Text style={styles.loaderText}>
            SecureStore içindeki son profil kontrol ediliyor.
          </Text>
        </View>
      </ScreenShell>
    );
  }

  return <Redirect href={profileId ? "/discovery" : "/onboarding"} />;
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
  }
});
