import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Crown, Gamepad2, Music2, Star, Trophy, Zap } from "lucide-react-native";
import { WebView } from "react-native-webview";
import { ScreenShell } from "../../src/components/screen-shell";
import { fetchLeaderboard, fetchLiveState } from "../../src/lib/mobile-api";
import { useMobileMe } from "../../src/hooks/use-mobile-me";
import { colors, radii, spacing, typography } from "../../src/theme/tokens";
import { getOutlierTitle } from "../../src/lib/outlier-quiz";

const SPOTIFY_PLAYLIST_ID = "2iLymYqtGacjpfbJBSxOjA";
const SPOTIFY_EMBED_URI =
  `https://open.spotify.com/embed/playlist/${SPOTIFY_PLAYLIST_ID}?utm_source=generator&theme=0`;
const SPOTIFY_WEB_URI = `https://open.spotify.com/playlist/${SPOTIFY_PLAYLIST_ID}`;
const SPOTIFY_APP_URI = `spotify:playlist:${SPOTIFY_PLAYLIST_ID}`;

const RANK_COLORS = ["#C9A96E", "#A8A9AD", "#B87333"];

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

  const myRank = leaderboardQuery.data?.me?.rank;
  const myPoints = me.attendee?.points ?? 0;
  const outlierScore = me.attendee?.outlier_score ?? 0;
  const outlierTitle = outlierScore > 0 ? getOutlierTitle(outlierScore) : null;
  const liveQuestionCount = liveQuery.data?.questions.length ?? 0;
  const activePoll = liveQuery.data?.activePoll;

  const openSpotifyPlaylist = async () => {
    try {
      const canOpenSpotifyApp = await Linking.canOpenURL(SPOTIFY_APP_URI);
      if (canOpenSpotifyApp) {
        await Linking.openURL(SPOTIFY_APP_URI);
        return;
      }

      await Linking.openURL(SPOTIFY_WEB_URI);
    } catch {
      await Linking.openURL(SPOTIFY_WEB_URI);
    }
  };

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
          label="Sıralama"
          value={myRank ? `#${myRank}` : "—"}
          icon={<Trophy color="#C9A96E" size={14} />}
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
            <Text style={styles.plaqueBlastLabel}>BLOCKERINO</Text>
          </View>
          <Text style={styles.plaqueBlastSubtitle}>Gömülü Blockerino'yu aç, oynayıp skorunu liderliğe gönder.</Text>
        </View>
        <Text style={styles.plaqueBlastAction}>Oyunu Aç ›</Text>
      </Pressable>

      {/* Spotify Playlist */}
      <View style={styles.spotifyCard}>
        <View style={styles.spotifyHeader}>
          <Music2 color={colors.copper} size={14} />
          <Text style={styles.spotifyLabel}>ETKİNLİK PLAYLİSTİ</Text>
        </View>
        <View style={styles.spotifyWebViewWrap}>
          <WebView
            source={{ uri: SPOTIFY_EMBED_URI }}
            style={styles.spotifyWebView}
            scrollEnabled={false}
            javaScriptEnabled
            domStorageEnabled
            thirdPartyCookiesEnabled
            sharedCookiesEnabled
            allowsProtectedMedia
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            setSupportMultipleWindows={false}
            onShouldStartLoadWithRequest={(request) => {
              const requestUrl = request.url ?? "";

              if (requestUrl.startsWith("https://open.spotify.com/embed/")) {
                return true;
              }

              if (requestUrl.startsWith("https://open.spotify.com/")) {
                void Linking.openURL(requestUrl);
                return false;
              }

              return true;
            }}
          />
        </View>
        <View style={styles.spotifyFooter}>
          <Text style={styles.spotifyHint}>Çalmazsa Spotify uygulamasında aç.</Text>
          <Pressable
            style={({ pressed }) => [styles.spotifyOpenButton, pressed ? styles.pressed : null]}
            onPress={() => {
              void openSpotifyPlaylist();
            }}
          >
            <Text style={styles.spotifyOpenButtonText}>Spotify&apos;da Aç</Text>
          </Pressable>
        </View>
      </View>

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

      {/* Leaderboard */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Crown color={colors.copper} size={16} />
          <Text style={styles.cardTitle}>Liderlik Tablosu</Text>
        </View>
        {leaderboardQuery.isLoading ? (
          <ActivityIndicator color={colors.accent} size="small" />
        ) : (
          (leaderboardQuery.data?.leaderboard ?? []).slice(0, 5).map((item, index) => (
            <View key={item.id} style={styles.rankRow}>
              <View style={styles.rankLeft}>
                <Text style={[styles.rankNumber, { color: RANK_COLORS[index] ?? colors.inkMuted }]}>
                  {index + 1}
                </Text>
                <Text style={styles.rankName}>{item.name}</Text>
              </View>
              <View style={[styles.rankBadge, index === 0 ? styles.rankBadgeGold : null]}>
                <Text style={[styles.rankPoints, index === 0 ? styles.rankPointsGold : null]}>
                  {item.points}
                </Text>
              </View>
            </View>
          ))
        )}
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
  spotifyCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(201,169,110,0.2)",
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    overflow: "hidden"
  },
  spotifyHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs
  },
  spotifyLabel: {
    color: colors.copper,
    fontFamily: typography.body,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5
  },
  spotifyWebViewWrap: {
    height: 152,
    overflow: "hidden"
  },
  spotifyWebView: {
    flex: 1,
    backgroundColor: "transparent"
  },
  spotifyFooter: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm
  },
  spotifyHint: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 11
  },
  spotifyOpenButton: {
    backgroundColor: "rgba(29,185,84,0.2)",
    borderColor: "rgba(29,185,84,0.45)",
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 7
  },
  spotifyOpenButtonText: {
    color: "#1DB954",
    fontFamily: typography.body,
    fontSize: 11,
    fontWeight: "800"
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
  card: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(139,92,246,0.15)",
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.sm
  },
  cardTitle: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 17,
    fontWeight: "700"
  },
  rankRow: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 9
  },
  rankLeft: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  rankNumber: {
    fontFamily: typography.display,
    fontSize: 13,
    fontWeight: "800",
    width: 20
  },
  rankName: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "700"
  },
  rankBadge: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 3
  },
  rankBadgeGold: {
    backgroundColor: "rgba(201,169,110,0.15)",
    borderColor: "rgba(201,169,110,0.3)",
    borderWidth: 1
  },
  rankPoints: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "800"
  },
  rankPointsGold: {
    color: colors.copper
  },
  pressed: {
    opacity: 0.82
  }
});
