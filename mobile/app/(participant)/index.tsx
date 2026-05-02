import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Gamepad2, Star, Zap } from "lucide-react-native";
import { ScreenShell } from "../../src/components/screen-shell";
import { fetchLiveState } from "../../src/lib/mobile-api";
import { useMobileMe } from "../../src/hooks/use-mobile-me";
import { colors, radii, spacing, typography } from "../../src/theme/tokens";
import { getOutlierTitle } from "../../src/lib/outlier-quiz";

type ProgramItem = {
  time: string;
  title: string;
  type: "talk" | "break";
  speaker?: string;
};

const PROGRAM_FLOW: ProgramItem[] = [
  { time: "10:30-11:00", title: "Kapı Açılışı", type: "break" },
  { time: "11:00-11:20", title: "Açılış Konuşması", type: "talk" },
  { time: "11:20-12:00", title: "1. Konuşmacı: Dr. Sina Saygılı", type: "talk" },
  { time: "12:00-12:10", title: "Networking + Kahve Arası", type: "break" },
  { time: "12:10-12:50", title: "2. Konuşmacı: Doç. Dr. Gaye Keser", type: "talk" },
  { time: "12:50-13:00", title: "Networking + Kahve Arası", type: "break" },
  { time: "13:00-13:40", title: "3. Konuşmacı: Prof. Dr. Alper Alkan", type: "talk" },
  { time: "13:40-14:20", title: "Yemek Arası + Networking", type: "break" },
  { time: "14:20-15:00", title: "4. Konuşmacı: Dr. Esra Bozbay", type: "talk" },
  { time: "15:00-15:10", title: "Networking + Kahve Arası", type: "break" },
  { time: "15:10-15:50", title: "5. Konuşmacı: Dt. Kerem İnan", type: "talk" },
  { time: "15:50-16:10", title: "Kapanış ve Ödül Takdimi", type: "break" }
];

export default function ParticipantHomeScreen() {
  const router = useRouter();
  const { me, query } = useMobileMe();

  const liveQuery = useQuery({
    queryKey: ["mobile-live-state-home"],
    queryFn: fetchLiveState,
    enabled: Boolean(me && me.role === "participant"),
    refetchInterval: 12_000
  });

  if (query.isLoading || !me) {
    return (
      <ScreenShell title="Hoş Geldin" subtitle="Profil hazırlanıyor...">
        <View style={styles.loaderCard}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loaderText}>Yükleniyor...</Text>
        </View>
      </ScreenShell>
    );
  }

  if (me.role === "staff") {
    return <Redirect href={"/(staff)" as never} />;
  }

  const myPoints = me.attendee?.points ?? 0;
  const outlierScore = me.attendee?.outlier_score ?? 0;
  const outlierTitle = outlierScore > 0 ? getOutlierTitle(outlierScore) : null;
  const liveQuestionCount = liveQuery.data?.questions.length ?? 0;
  const activePoll = liveQuery.data?.activePoll;

  return (
    <ScreenShell
      title={me.attendee?.name ? `Merhaba, ${me.attendee.name.split(" ")[0]}` : "Merkez"}
      subtitle={outlierTitle ? `${outlierTitle} · DentCo Outliers 2026` : "DentCo Outliers 2026 · İstanbul"}
    >
      {!me.attendee ? (
        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>Profil tamamlanmadı</Text>
          <Text style={styles.warningText}>Canlı, oyun ve Outliers modüllerini açmak için profilini tamamla.</Text>
          <Pressable
            style={({ pressed }) => [styles.ctaButton, pressed ? styles.pressed : null]}
            onPress={() => router.push("/(participant)/more" as never)}
          >
            <Text style={styles.ctaButtonText}>Profili Tamamla →</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Metric Row */}
      <View style={styles.metricRow}>
        <MetricCard
          label="Puanın"
          value={String(myPoints)}
          icon={<Star color={colors.copper} size={14} />}
          accent={colors.copper}
        />
        <MetricCard
          label="Canlı Soru"
          value={String(liveQuestionCount)}
          icon={<Zap color={colors.accent} size={14} />}
          accent={colors.accent}
        />
        <MetricCard
          label="Program"
          value={String(PROGRAM_FLOW.length)}
          icon={<CalendarDays color="#C9A96E" size={14} />}
          accent="#C9A96E"
        />
      </View>

      <Pressable
        style={({ pressed }) => [styles.plaqueBlastCard, pressed ? styles.pressed : null]}
        onPress={() => router.push("/(participant)/game" as never)}
      >
        <View style={styles.plaqueBlastCopy}>
          <View style={styles.plaqueBlastTitleRow}>
            <Gamepad2 color={colors.accent} size={16} />
            <Text style={styles.plaqueBlastLabel}>DENTBLAST</Text>
          </View>
          <Text style={styles.plaqueBlastSubtitle}>Dentblast'ı aç, oynayıp skorunu kaydet.</Text>
        </View>
        <Text style={styles.plaqueBlastAction}>Oyunu Aç ›</Text>
      </Pressable>

      {/* Active Poll Banner */}
      {activePoll ? (
        <Pressable
          style={({ pressed }) => [styles.pollBanner, pressed ? styles.pressed : null]}
          onPress={() => router.push("/(participant)/live" as never)}
        >
          <View style={styles.liveDot} />
          <View style={styles.pollBannerText}>
            <Text style={styles.pollBannerTag}>AKTİF ANKET</Text>
            <Text style={styles.pollBannerQuestion} numberOfLines={1}>{activePoll.question}</Text>
          </View>
          <Text style={styles.pollBannerArrow}>›</Text>
        </Pressable>
      ) : null}

      {/* Program Flow */}
      <View style={styles.programCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderTitle}>
            <CalendarDays color={colors.copper} size={16} />
            <Text style={styles.cardTitle}>Program Akışı</Text>
          </View>
          <Text style={styles.programKicker}>Günün akışı</Text>
        </View>

        {PROGRAM_FLOW.map((item) => {
          const isTalk = item.type === "talk";
          return (
            <View
              key={`${item.time}-${item.title}`}
              style={[styles.programRow, isTalk ? styles.programRowTalk : null]}
            >
              <Text style={[styles.programTime, isTalk ? styles.programTimeTalk : null]}>
                {item.time}
              </Text>
              <View style={styles.programContent}>
                <Text style={[styles.programTitle, isTalk ? styles.programTitleTalk : null]}>
                  {item.title}
                </Text>
                {item.speaker ? (
                  <Text style={styles.programSpeaker}>{item.speaker}</Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </ScreenShell>
  );
}

function MetricCard({
  label,
  value,
  icon,
  accent
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <View style={[styles.metricCard, { borderColor: `${accent}30` }]}>
      <View style={styles.metricIconRow}>{icon}</View>
      <Text style={[styles.metricValue, { color: accent }]}>{value}</Text>
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
  warningCard: {
    backgroundColor: "rgba(245,158,11,0.1)",
    borderColor: "rgba(245,158,11,0.25)",
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.lg,
    padding: spacing.lg
  },
  warningTitle: {
    color: colors.warning,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800"
  },
  warningText: {
    color: colors.warning,
    fontFamily: typography.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    opacity: 0.85
  },
  ctaButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.warning,
    borderRadius: radii.pill,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8
  },
  ctaButtonText: {
    color: "#1A1000",
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "800"
  },
  metricRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  metricCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    padding: spacing.sm
  },
  metricIconRow: {
    marginBottom: 6
  },
  metricValue: {
    fontFamily: typography.display,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 26
  },
  metricLabel: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
    marginTop: 2
  },
  plaqueBlastCard: {
    alignItems: "center",
    backgroundColor: "rgba(139,92,246,0.11)",
    borderColor: "rgba(139,92,246,0.35)",
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.md,
    padding: spacing.md
  },
  plaqueBlastCopy: {
    flex: 1
  },
  plaqueBlastTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs
  },
  plaqueBlastLabel: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 16,
    fontWeight: "800"
  },
  plaqueBlastSubtitle: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
    marginTop: 6
  },
  plaqueBlastAction: {
    color: colors.accent,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "800",
    marginLeft: spacing.sm
  },
  programCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(201,169,110,0.2)",
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md
  },
  pollBanner: {
    alignItems: "center",
    backgroundColor: "rgba(139,92,246,0.1)",
    borderColor: "rgba(139,92,246,0.3)",
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  liveDot: {
    backgroundColor: "#F87171",
    borderRadius: 999,
    height: 8,
    marginRight: 10,
    width: 8
  },
  pollBannerText: {
    flex: 1
  },
  pollBannerTag: {
    color: colors.accent,
    fontFamily: typography.body,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1
  },
  pollBannerQuestion: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2
  },
  pollBannerArrow: {
    color: colors.accent,
    fontSize: 22,
    fontWeight: "300",
    marginLeft: spacing.xs
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm
  },
  cardHeaderTitle: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs
  },
  cardTitle: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 17,
    fontWeight: "700"
  },
  programKicker: {
    color: colors.copper,
    fontFamily: typography.body,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
    textTransform: "uppercase"
  },
  programRow: {
    backgroundColor: "rgba(255,255,255,0.025)",
    borderColor: "rgba(139,92,246,0.16)",
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 12
  },
  programRowTalk: {
    borderColor: "rgba(139,92,246,0.3)"
  },
  programTime: {
    color: "rgba(180,170,255,0.45)",
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 18,
    width: 86
  },
  programTimeTalk: {
    color: "rgba(180,170,255,0.68)"
  },
  programContent: {
    flex: 1
  },
  programTitle: {
    color: "rgba(255,255,255,0.52)",
    fontFamily: typography.body,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20
  },
  programTitleTalk: {
    color: colors.ink
  },
  programSpeaker: {
    color: "rgba(180,170,255,0.5)",
    fontFamily: typography.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2
  },
  pressed: {
    opacity: 0.82
  }
});
