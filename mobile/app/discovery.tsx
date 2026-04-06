import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, Gamepad2, Heart, RefreshCw, Users, X } from "lucide-react-native";
import { DiscoveryProfileCard } from "../src/components/discovery-profile-card";
import { ScreenShell } from "../src/components/screen-shell";
import {
  fetchNetworkingFeed,
  sendNetworkingInteraction
} from "../src/lib/networking";
import type { NetworkingMatchRecord } from "../src/lib/contracts";
import { useNetworkingSessionStore } from "../src/store/networking-session";
import { colors, radii, spacing, typography } from "../src/theme/tokens";

export default function DiscoveryScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const hydrated = useNetworkingSessionStore((state) => state.hydrated);
  const profileId = useNetworkingSessionStore((state) => state.profileId);
  const [activeIndex, setActiveIndex] = useState(0);
  const [latestMatch, setLatestMatch] = useState<NetworkingMatchRecord | null>(null);

  const feedQuery = useQuery({
    queryKey: ["networking-feed", profileId],
    queryFn: () => fetchNetworkingFeed(profileId as string),
    enabled: Boolean(profileId),
    refetchInterval: 20_000,
    refetchOnReconnect: true
  });

  useEffect(() => {
    setActiveIndex(0);
  }, [feedQuery.data?.refreshedAt]);

  const interactionMutation = useMutation({
    mutationFn: ({
      targetProfileId,
      action
    }: {
      targetProfileId: string;
      action: "like" | "pass";
    }) => sendNetworkingInteraction(profileId as string, targetProfileId, action),
    onSuccess: async (response) => {
      if (response.matched && response.match) {
        setLatestMatch(response.match);
      }

      setActiveIndex((currentIndex) => currentIndex + 1);
      await queryClient.invalidateQueries({
        queryKey: ["networking-feed", profileId]
      });
      await queryClient.invalidateQueries({
        queryKey: ["networking-matches", profileId]
      });
    }
  });

  if (!hydrated) {
    return null;
  }

  if (!profileId) {
    return <Redirect href="/onboarding" />;
  }

  const queue = feedQuery.data?.queue ?? [];
  const activeProfile = queue[activeIndex] ?? null;
  const remainingCount = Math.max(queue.length - activeIndex - 1, 0);

  return (
    <ScreenShell
      title="Klinik kimyasını keşfet"
      subtitle="Kart akışı gibi ilerle; profesyonel uyum gördüğün diş hekimlerine ilgini gönder."
      rightAction={
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => {
              router.push("/matches");
            }}
            style={({ pressed }) => [styles.headerButton, pressed ? styles.headerButtonPressed : null]}
          >
            <Users color={colors.ink} size={16} />
            <Text style={styles.headerButtonText}>Eşleşmeler</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              router.push("/profile");
            }}
            style={({ pressed }) => [styles.headerButton, pressed ? styles.headerButtonPressed : null]}
          >
            <Edit3 color={colors.ink} size={16} />
            <Text style={styles.headerButtonText}>Profil</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              router.push("/game");
            }}
            style={({ pressed }) => [styles.headerButton, pressed ? styles.headerButtonPressed : null]}
          >
            <Gamepad2 color={colors.copper} size={16} />
            <Text style={[styles.headerButtonText, styles.gameButtonText]}>Oyun</Text>
          </Pressable>
        </View>
      }
      scrollProps={{
        refreshControl: (
          <RefreshControl
            refreshing={feedQuery.isRefetching}
            tintColor={colors.accent}
            onRefresh={() => {
              void feedQuery.refetch();
            }}
          />
        )
      }}
    >
      <View style={styles.metricsCard}>
        <Metric
          label="Sıradaki kart"
          value={activeProfile ? String(activeIndex + 1) : "0"}
        />
        <Metric label="Kalan aday" value={String(remainingCount)} />
        <Metric label="Karşılıklı eşleşme" value={String(feedQuery.data?.mutualMatchesCount ?? 0)} />
      </View>

      {latestMatch ? (
        <View style={styles.matchBanner}>
          <Text style={styles.matchBannerTitle}>Karşılıklı ilgi oluştu</Text>
          <Text style={styles.matchBannerText}>
            {latestMatch.profile.full_name} artık eşleşmeler ekranında. İletişim butonları açıldı.
          </Text>
          <Pressable
            onPress={() => {
              setLatestMatch(null);
              router.push("/matches");
            }}
            style={({ pressed }) => [styles.matchBannerButton, pressed ? styles.headerButtonPressed : null]}
          >
            <Text style={styles.matchBannerButtonText}>Eşleşmelere Git</Text>
          </Pressable>
        </View>
      ) : null}

      {feedQuery.isLoading && !feedQuery.data ? (
        <View style={styles.loaderCard}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loaderTitle}>Kartlar hazırlanıyor</Text>
          <Text style={styles.loaderText}>
            Uzmanlık, ilgi ve profesyonel hedefler taranıyor.
          </Text>
        </View>
      ) : null}

      {feedQuery.isError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Akış yüklenemedi</Text>
          <Text style={styles.errorText}>
            {feedQuery.error instanceof Error ? feedQuery.error.message : "Kart akışı alınamıyor."}
          </Text>
        </View>
      ) : null}

      {feedQuery.data ? (
        <>
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>{feedQuery.data.message}</Text>
          </View>

          {activeProfile ? (
            <>
              <DiscoveryProfileCard profile={activeProfile} />
              <View style={styles.actionBar}>
                <ActionButton
                  variant="pass"
                  label={interactionMutation.isPending ? "Bekle..." : "Pas Geç"}
                  icon={<X color={colors.danger} size={20} />}
                  disabled={interactionMutation.isPending}
                  onPress={() => {
                    interactionMutation.mutate({
                      targetProfileId: activeProfile.id,
                      action: "pass"
                    });
                  }}
                />
                <ActionButton
                  variant="like"
                  label={interactionMutation.isPending ? "Bekle..." : "İlgini Gönder"}
                  icon={<Heart color="#FFFFFF" size={20} fill="#FFFFFF" />}
                  disabled={interactionMutation.isPending}
                  onPress={() => {
                    interactionMutation.mutate({
                      targetProfileId: activeProfile.id,
                      action: "like"
                    });
                  }}
                />
              </View>
            </>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Yeni kart kalmadı</Text>
              <Text style={styles.emptyText}>
                Profilleri tükettin. Biraz sonra yenile veya eşleşmeler ekranına geç.
              </Text>
              <Pressable
                onPress={() => {
                  void feedQuery.refetch();
                }}
                style={({ pressed }) => [styles.emptyButton, pressed ? styles.headerButtonPressed : null]}
              >
                <RefreshCw color={colors.accent} size={16} />
                <Text style={styles.emptyButtonText}>Kart Havuzunu Yenile</Text>
              </Pressable>
            </View>
          )}
        </>
      ) : null}
    </ScreenShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricBlock}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

type ActionButtonProps = {
  label: string;
  icon: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  variant: "like" | "pass";
};

function ActionButton({ label, icon, onPress, disabled = false, variant }: ActionButtonProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        variant === "like" ? styles.likeButton : styles.passButton,
        disabled ? styles.actionButtonDisabled : null,
        pressed && !disabled ? styles.headerButtonPressed : null
      ]}
    >
      {icon}
      <Text style={[styles.actionButtonText, variant === "pass" ? styles.passButtonText : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    gap: spacing.sm
  },
  headerButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    flexDirection: "row",
    marginBottom: spacing.xs,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  headerButtonPressed: {
    opacity: 0.84
  },
  headerButtonText: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "800",
    marginLeft: 6
  },
  metricsCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radii.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
    padding: spacing.md
  },
  metricBlock: {
    flex: 1
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
    fontWeight: "700",
    marginTop: 2
  },
  matchBanner: {
    backgroundColor: colors.backgroundDeep,
    borderRadius: radii.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg
  },
  matchBannerTitle: {
    color: "#FFFFFF",
    fontFamily: typography.display,
    fontSize: 21,
    fontWeight: "700"
  },
  matchBannerText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.sm
  },
  matchBannerButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12
  },
  matchBannerButtonText: {
    color: "#FFFFFF",
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800"
  },
  loaderCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    marginBottom: spacing.lg,
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
    marginBottom: spacing.lg,
    padding: spacing.lg
  },
  errorTitle: {
    color: colors.danger,
    fontFamily: typography.body,
    fontSize: 15,
    fontWeight: "800"
  },
  errorText: {
    color: colors.danger,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.xs
  },
  infoCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    marginBottom: spacing.lg,
    padding: spacing.md
  },
  infoText: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18
  },
  actionBar: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.xl,
    marginTop: spacing.lg
  },
  actionButton: {
    alignItems: "center",
    borderRadius: radii.lg,
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 18
  },
  likeButton: {
    backgroundColor: colors.accent
  },
  passButton: {
    backgroundColor: colors.surface,
    borderColor: colors.danger,
    borderWidth: 1
  },
  actionButtonDisabled: {
    opacity: 0.55
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontFamily: typography.body,
    fontSize: 15,
    fontWeight: "800",
    marginLeft: 8
  },
  passButtonText: {
    color: colors.danger
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    marginBottom: spacing.xl,
    padding: spacing.xl
  },
  emptyTitle: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 22,
    fontWeight: "700"
  },
  emptyText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.sm
  },
  emptyButton: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    flexDirection: "row",
    marginTop: spacing.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignSelf: "flex-start"
  },
  emptyButtonText: {
    color: colors.accent,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800",
    marginLeft: 8
  },
  gameButtonText: {
    color: colors.copper
  }
});
