import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ScreenShell } from "../../src/components/screen-shell";
import { fetchLeaderboard, fetchLiveState } from "../../src/lib/mobile-api";
import { useMobileMe } from "../../src/hooks/use-mobile-me";
import { colors, radii, spacing, typography } from "../../src/theme/tokens";

export default function ParticipantHomeScreen() {
  const router = useRouter();
  const { me, query } = useMobileMe();

  const liveQuery = useQuery({
    queryKey: ["mobile-live-state-home"],
    queryFn: fetchLiveState,
    enabled: Boolean(me && me.role === "participant"),
    refetchInterval: 12_000
  });

  const leaderboardQuery = useQuery({
    queryKey: ["mobile-leaderboard"],
    queryFn: fetchLeaderboard,
    enabled: Boolean(me && me.role === "participant"),
    refetchInterval: 20_000
  });

  if (query.isLoading || !me) {
    return (
      <ScreenShell title="Katılımcı Merkezi" subtitle="Profil hazırlanıyor.">
        <View style={styles.loaderCard}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loaderText}>Rol ve katılımcı bilgisi yükleniyor.</Text>
        </View>
      </ScreenShell>
    );
  }

  if (me.role === "staff") {
    return <Redirect href={"/(staff)" as never} />;
  }

  return (
    <ScreenShell
      title="Katılımcı Merkezi"
      subtitle="Live oturum, networking ve oyun puanlarını tek akışta takip edin."
    >
      <View style={styles.metricRow}>
        <MetricCard label="Puanın" value={String(me.attendee?.points ?? 0)} />
        <MetricCard label="Live Soru" value={String(liveQuery.data?.questions.length ?? 0)} />
        <MetricCard label="Liderlik" value={String(leaderboardQuery.data?.me?.rank ?? "-")} />
      </View>

      {!me.attendee ? (
        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>Onboarding Gerekli</Text>
          <Text style={styles.warningText}>Live ve networking modüllerini kullanmak için profil bilgilerini tamamlayın.</Text>
          <Pressable
            style={({ pressed }) => [styles.ctaButton, pressed ? styles.pressed : null]}
            onPress={() => {
              router.push("/(participant)/more" as never);
            }}
          >
            <Text style={styles.ctaButtonText}>Profili Tamamla</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.panelCard}>
        <Text style={styles.panelTitle}>Canlı Durum Özeti</Text>
        <Text style={styles.panelText}>Aktif anket: {liveQuery.data?.activePoll?.question ?? "Yok"}</Text>
        <Text style={styles.panelText}>Toplam reaksiyon: {Object.values(liveQuery.data?.reactionCounts ?? {}).reduce((sum, item) => sum + item, 0)}</Text>
      </View>

      <View style={styles.panelCard}>
        <Text style={styles.panelTitle}>Top 5 Liderlik</Text>
        {(leaderboardQuery.data?.leaderboard ?? []).slice(0, 5).map((item, index) => (
          <View key={item.id} style={styles.rankRow}>
            <Text style={styles.rankText}>{index + 1}. {item.name}</Text>
            <Text style={styles.rankPoints}>{item.points}</Text>
          </View>
        ))}
      </View>
    </ScreenShell>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loaderCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl
  },
  loaderText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 14,
    marginTop: spacing.sm
  },
  metricRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg
  },
  metricCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    flex: 1,
    padding: spacing.md
  },
  metricValue: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 24,
    fontWeight: "700"
  },
  metricLabel: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "700"
  },
  warningCard: {
    backgroundColor: "#FFF3D6",
    borderRadius: radii.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg
  },
  warningTitle: {
    color: colors.warning,
    fontFamily: typography.body,
    fontSize: 14,
    fontWeight: "800"
  },
  warningText: {
    color: colors.warning,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.xs
  },
  ctaButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.copper,
    borderRadius: radii.pill,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10
  },
  ctaButtonText: {
    color: "#FFFFFF",
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800"
  },
  panelCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
    padding: spacing.md
  },
  panelTitle: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: spacing.sm
  },
  panelText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 18
  },
  rankRow: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8
  },
  rankText: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "700"
  },
  rankPoints: {
    color: colors.accent,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800"
  },
  pressed: {
    opacity: 0.82
  }
});
