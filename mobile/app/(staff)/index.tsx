import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Redirect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ScreenShell } from "../../src/components/screen-shell";
import { fetchStaffOverview } from "../../src/lib/mobile-api";
import { useMobileMe } from "../../src/hooks/use-mobile-me";
import { colors, radii, spacing, typography } from "../../src/theme/tokens";

export default function StaffDashboardScreen() {
  const { me, query } = useMobileMe();

  const overviewQuery = useQuery({
    queryKey: ["mobile-staff-overview"],
    queryFn: fetchStaffOverview,
    enabled: Boolean(me?.role === "staff"),
    refetchInterval: 15_000
  });

  if (query.isLoading || !me) {
    return (
      <ScreenShell title="Staff Panel" subtitle="Yetki durumu kontrol ediliyor.">
        <View style={styles.loaderCard}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </ScreenShell>
    );
  }

  if (me.role !== "staff") {
    return <Redirect href={"/(participant)" as never} />;
  }

  return (
    <ScreenShell
      title="Staff Panel"
      subtitle="Live operasyon, çekiliş ve katılımcı durumunu tek panelde izle."
    >
      <View style={styles.metricRow}>
        <Metric label="Attendees" value={String(overviewQuery.data?.stats.attendees ?? 0)} />
        <Metric label="Questions" value={String(overviewQuery.data?.stats.questions ?? 0)} />
        <Metric label="Active Polls" value={String(overviewQuery.data?.stats.activePolls ?? 0)} />
      </View>
      <View style={styles.metricRow}>
        <Metric label="Reactions" value={String(overviewQuery.data?.stats.reactions ?? 0)} />
        <Metric label="Raffle Draws" value={String(overviewQuery.data?.stats.raffleDraws ?? 0)} />
        <Metric label="Feedbacks" value={String(overviewQuery.data?.stats.feedbacks ?? 0)} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Analytics Snapshot</Text>
        {overviewQuery.isLoading ? (
          <ActivityIndicator color={colors.accent} size="small" />
        ) : overviewQuery.data?.latestAnalytics ? (
          <>
            <Text style={styles.cardText}>
              Son analiz: {new Date(overviewQuery.data.latestAnalytics.created_at).toLocaleString("tr-TR")}
            </Text>
            <Text style={styles.cardText}>
              Toplam feedback: {overviewQuery.data.latestAnalytics.total_feedbacks}
            </Text>
          </>
        ) : (
          <Text style={styles.cardText}>Henüz analytics kaydı bulunmuyor.</Text>
        )}
      </View>
    </ScreenShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
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
  metricRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm
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
    fontSize: 22,
    fontWeight: "700"
  },
  metricLabel: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "700"
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    marginTop: spacing.sm,
    padding: spacing.md
  },
  cardTitle: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: spacing.sm
  },
  cardText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 19
  }
});
