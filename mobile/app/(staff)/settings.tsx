import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Redirect } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { KeyRound, LogOut, ShieldCheck } from "lucide-react-native";
import { ScreenShell } from "../../src/components/screen-shell";
import { requestStaffStepUp, verifyStaffStepUp } from "../../src/lib/mobile-api";
import type { StaffCapability } from "../../src/lib/mobile-contracts";
import { useMobileMe } from "../../src/hooks/use-mobile-me";
import { useAuthSessionStore } from "../../src/store/auth-session";
import { colors, radii, spacing, typography } from "../../src/theme/tokens";

const TEST_CAPABILITY: StaffCapability = "raffle.write";

export default function StaffSettingsScreen() {
  const clear = useAuthSessionStore((state) => state.clear);
  const { me, query } = useMobileMe();
  const [lastStepUpStatus, setLastStepUpStatus] = useState("");

  const testStepUpMutation = useMutation({
    mutationFn: async () => {
      const created = await requestStaffStepUp(TEST_CAPABILITY);
      const verification = await verifyStaffStepUp(created.token, TEST_CAPABILITY);
      return verification.valid;
    },
    onSuccess: (valid) => {
      setLastStepUpStatus(valid ? "Ek doğrulama başarılı." : "Ek doğrulama geçersiz.");
    }
  });

  if (query.isLoading || !me) {
    return (
      <ScreenShell title="Ekip Ayarları" subtitle="Profil hazırlanıyor.">
        <ActivityIndicator color={colors.accent} size="large" />
      </ScreenShell>
    );
  }

  if (me.role !== "staff") {
    return <Redirect href={"/(participant)" as never} />;
  }

  return (
    <ScreenShell
      title="Ekip Ayarları"
      subtitle="Yetkiler, ek doğrulama ve oturum yönetimi."
    >
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <ShieldCheck color={colors.accent} size={16} />
          <Text style={styles.cardTitle}>Rol ve Yetkiler</Text>
        </View>
        <Text style={styles.metaText}>Rol: {me.staffRole?.role ?? "ekip"}</Text>
        <View style={styles.capabilityWrap}>
          {(me.staffRole?.capabilities ?? []).map((capability) => (
            <View key={capability} style={styles.capabilityChip}>
              <Text style={styles.capabilityText}>{capability}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <KeyRound color={colors.copper} size={16} />
          <Text style={styles.cardTitle}>Ek Doğrulama Kontrolü</Text>
        </View>
        <Text style={styles.metaText}>Test yetkisi: {TEST_CAPABILITY}</Text>
        <Pressable
          disabled={testStepUpMutation.isPending}
          style={({ pressed }) => [styles.primaryButton, pressed ? styles.pressed : null]}
          onPress={() => {
            testStepUpMutation.mutate();
          }}
        >
          {testStepUpMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.primaryButtonText}>Ek Doğrulamayı Test Et</Text>
          )}
        </Pressable>
        {lastStepUpStatus ? <Text style={styles.metaText}>{lastStepUpStatus}</Text> : null}
      </View>

      <Pressable
        style={({ pressed }) => [styles.logoutButton, pressed ? styles.pressed : null]}
        onPress={() => {
          void clear();
        }}
      >
        <LogOut color="#FFFFFF" size={14} />
        <Text style={styles.logoutText}>Ekip Oturumunu Kapat</Text>
      </Pressable>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
    padding: spacing.md
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: spacing.sm
  },
  cardTitle: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 18,
    fontWeight: "700",
    marginLeft: spacing.xs
  },
  metaText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: spacing.xs
  },
  capabilityWrap: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  capabilityChip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    marginBottom: spacing.xs,
    marginRight: spacing.xs,
    paddingHorizontal: 11,
    paddingVertical: 7
  },
  capabilityText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "700"
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: spacing.md
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800"
  },
  logoutButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.danger,
    borderRadius: radii.pill,
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    paddingVertical: 10
  },
  logoutText: {
    color: "#FFFFFF",
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800",
    marginLeft: spacing.xs
  },
  pressed: {
    opacity: 0.82
  }
});
