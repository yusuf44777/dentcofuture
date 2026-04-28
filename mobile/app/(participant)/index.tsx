import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Gamepad2, Heart, Images, MessageCircle, Play, RefreshCw, Star, Zap } from "lucide-react-native";
import { ScreenShell } from "../../src/components/screen-shell";
import { fetchLiveState, fetchNetworkingGalleryFeed } from "../../src/lib/mobile-api";
import { useMobileMe } from "../../src/hooks/use-mobile-me";
import { colors, radii, spacing, typography } from "../../src/theme/tokens";
import { getOutlierTitle } from "../../src/lib/outlier-quiz";

function formatGalleryDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export default function ParticipantHomeScreen() {
  const router = useRouter();
  const { me, query } = useMobileMe();

  const liveQuery = useQuery({
    queryKey: ["mobile-live-state-home"],
    queryFn: fetchLiveState,
    enabled: Boolean(me && me.role === "participant"),
    refetchInterval: 12_000
  });

  const galleryFeedQuery = useQuery({
    queryKey: ["mobile-home-gallery-feed"],
    queryFn: () => fetchNetworkingGalleryFeed(6),
    enabled: Boolean(me && me.role === "participant" && me.attendee),
    refetchInterval: 18_000
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
  const activityPosts = galleryFeedQuery.data?.posts ?? [];

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
          label="Paylaşım"
          value={String(activityPosts.length)}
          icon={<Images color="#C9A96E" size={14} />}
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
          <Text style={styles.plaqueBlastSubtitle}>Gömülü Blockerino'yu aç, oynayıp skorunu kaydet.</Text>
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

      {/* Activity Feed */}
      <View style={styles.activityCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderTitle}>
            <Images color={colors.copper} size={16} />
            <Text style={styles.cardTitle}>Etkinlik Akışı</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}
            onPress={() => {
              void galleryFeedQuery.refetch();
            }}
          >
            <RefreshCw color={colors.inkMuted} size={15} />
          </Pressable>
        </View>

        {galleryFeedQuery.isLoading ? (
          <View style={styles.activityState}>
            <ActivityIndicator color={colors.accent} size="small" />
            <Text style={styles.loaderText}>Akış yükleniyor...</Text>
          </View>
        ) : null}

        {galleryFeedQuery.isError ? (
          <View style={styles.activityErrorCard}>
            <Text style={styles.activityErrorText}>
              {galleryFeedQuery.error instanceof Error
                ? galleryFeedQuery.error.message
                : "Etkinlik akışı alınamadı."}
            </Text>
          </View>
        ) : null}

        {!galleryFeedQuery.isLoading && activityPosts.length === 0 ? (
          <Text style={styles.activityEmptyText}>Henüz etkinlik paylaşımı yok.</Text>
        ) : null}

        {activityPosts.slice(0, 4).map((post) => {
          const firstMedia =
            post.mediaItems && post.mediaItems.length > 0
              ? post.mediaItems[0]
              : {
                  id: post.id,
                  mediaType: post.mediaType,
                  publicUrl: post.publicUrl
                };
          const avatarLetter = post.uploaderName.trim().charAt(0).toLocaleUpperCase("tr-TR") || "?";

          return (
            <View key={post.id} style={styles.activityPostCard}>
              <View style={styles.activityPostHeader}>
                <View style={styles.activityAvatar}>
                  <Text style={styles.activityAvatarText}>{avatarLetter}</Text>
                </View>
                <Pressable
                  style={({ pressed }) => [
                    styles.activityAuthorBlock,
                    pressed ? styles.pressed : null
                  ]}
                  onPress={() => {
                    router.push(`/(participant)/uploader?name=${encodeURIComponent(post.uploaderName)}` as never);
                  }}
                >
                  <Text style={styles.activityAuthor}>{post.uploaderName}</Text>
                  <Text style={styles.activityDate}>{formatGalleryDate(post.createdAt)}</Text>
                </Pressable>
                {post.mediaCount > 1 ? (
                  <View style={styles.activityMediaBadge}>
                    <Text style={styles.activityMediaBadgeText}>{post.mediaCount} medya</Text>
                  </View>
                ) : null}
              </View>

              {firstMedia.mediaType === "photo" ? (
                <Pressable
                  style={({ pressed }) => [pressed ? styles.pressed : null]}
                  onPress={() => {
                    router.push("/(participant)/networking" as never);
                  }}
                >
                  <Image
                    source={{ uri: firstMedia.publicUrl }}
                    resizeMode="cover"
                    style={styles.activityMedia}
                  />
                </Pressable>
              ) : (
                <Pressable
                  style={({ pressed }) => [
                    styles.activityVideoCard,
                    pressed ? styles.pressed : null
                  ]}
                  onPress={() => {
                    void Linking.openURL(firstMedia.publicUrl);
                  }}
                >
                  <Play color={colors.copper} size={20} />
                  <Text style={styles.activityVideoText}>Videoyu aç</Text>
                </Pressable>
              )}

              {post.caption ? (
                <Text style={styles.activityCaption} numberOfLines={2}>
                  {post.caption}
                </Text>
              ) : null}

              <View style={styles.activityStatsRow}>
                <View style={styles.activityStat}>
                  <Heart
                    color={post.likedByMe ? colors.danger : colors.inkMuted}
                    fill={post.likedByMe ? colors.danger : "transparent"}
                    size={14}
                  />
                  <Text style={styles.activityStatText}>{post.likesCount}</Text>
                </View>
                <View style={styles.activityStat}>
                  <MessageCircle color={colors.copper} size={14} />
                  <Text style={styles.activityStatText}>{post.commentsCount}</Text>
                </View>
              </View>
            </View>
          );
        })}

        <Pressable
          style={({ pressed }) => [styles.activityOpenButton, pressed ? styles.pressed : null]}
          onPress={() => {
            router.push("/(participant)/networking" as never);
          }}
        >
          <Text style={styles.activityOpenButtonText}>Tüm Akışı Aç</Text>
        </Pressable>
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
  activityCard: {
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
  iconButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  activityState: {
    alignItems: "center",
    paddingVertical: spacing.md
  },
  activityErrorCard: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
    padding: spacing.sm
  },
  activityErrorText: {
    color: colors.danger,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 18
  },
  activityEmptyText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 13,
    paddingVertical: spacing.sm
  },
  activityPostCard: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.sm,
    overflow: "hidden",
    padding: spacing.sm
  },
  activityPostHeader: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: spacing.sm
  },
  activityAvatar: {
    alignItems: "center",
    backgroundColor: colors.copperSoft,
    borderRadius: radii.pill,
    height: 34,
    justifyContent: "center",
    marginRight: spacing.sm,
    width: 34
  },
  activityAvatarText: {
    color: colors.copper,
    fontFamily: typography.body,
    fontSize: 14,
    fontWeight: "900"
  },
  activityAuthorBlock: {
    flex: 1
  },
  activityAuthor: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800"
  },
  activityDate: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 11,
    marginTop: 1
  },
  activityMediaBadge: {
    backgroundColor: colors.copperSoft,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  activityMediaBadgeText: {
    color: colors.copper,
    fontFamily: typography.body,
    fontSize: 10,
    fontWeight: "800"
  },
  activityMedia: {
    backgroundColor: colors.backgroundDeep,
    borderRadius: radii.md,
    height: 172,
    width: "100%"
  },
  activityVideoCard: {
    alignItems: "center",
    backgroundColor: colors.backgroundDeep,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 138,
    justifyContent: "center"
  },
  activityVideoText: {
    color: colors.copper,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "800",
    marginTop: spacing.xs
  },
  activityCaption: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.sm
  },
  activityStatsRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.sm
  },
  activityStat: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5
  },
  activityStatText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "700"
  },
  activityOpenButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    justifyContent: "center",
    marginTop: spacing.md,
    paddingVertical: 10
  },
  activityOpenButtonText: {
    color: "#FFFFFF",
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800"
  },
  pressed: {
    opacity: 0.82
  }
});
