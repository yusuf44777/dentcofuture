import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Edit3, RefreshCw } from "lucide-react-native";
import { MatchCard } from "../src/components/match-card";
import { ScreenShell } from "../src/components/screen-shell";
import { fetchNetworkingDiscovery, getProfileContact } from "../src/lib/networking";
import { useNetworkingSessionStore } from "../src/store/networking-session";
import { colors, radii, spacing, typography } from "../src/theme/tokens";

export default function DiscoveryScreen() {
  const router = useRouter();
  const hydrated = useNetworkingSessionStore((state) => state.hydrated);
  const profileId = useNetworkingSessionStore((state) => state.profileId);

  const discoveryQuery = useQuery({
    queryKey: ["networking-discovery", profileId],
    queryFn: () => fetchNetworkingDiscovery(profileId as string),
    enabled: Boolean(profileId),
    refetchInterval: 15_000,
    refetchOnReconnect: true
  });

  if (!hydrated) {
    return null;
  }

  if (!profileId) {
    return <Redirect href="/onboarding" />;
  }

  const currentProfile = discoveryQuery.data?.currentProfile ?? null;
  const contact = currentProfile ? getProfileContact(currentProfile) : null;
  const contactSummary = [contact?.instagram.label, contact?.linkedin.label]
    .filter((value): value is string => Boolean(value))
    .join(" • ");

  return (
    <ScreenShell
      title="Akıllı discovery akışı"
      subtitle="Benzer uzmanlıklar, ortak hedefler ve yakın aktiviteye göre sıralanan networking havuzu."
      rightAction={
        <Pressable
          onPress={() => {
            router.push("/profile");
          }}
          style={({ pressed }) => [styles.actionButton, pressed ? styles.actionButtonPressed : null]}
        >
          <Edit3 color={colors.ink} size={17} />
          <Text style={styles.actionButtonText}>Profil</Text>
        </Pressable>
      }
      scrollProps={{
        refreshControl: (
          <RefreshControl
            refreshing={discoveryQuery.isRefetching}
            tintColor={colors.accent}
            onRefresh={() => {
              void discoveryQuery.refetch();
            }}
          />
        )
      }}
    >
      <View style={styles.bannerCard}>
        <View style={styles.bannerMetric}>
          <Text style={styles.bannerValue}>
            {discoveryQuery.data?.recommendedProfiles.length ?? 0}
          </Text>
          <Text style={styles.bannerLabel}>Güçlü eşleşme</Text>
        </View>
        <View style={styles.bannerMetric}>
          <Text style={styles.bannerValue}>{discoveryQuery.data?.otherProfiles.length ?? 0}</Text>
          <Text style={styles.bannerLabel}>Ek profil</Text>
        </View>
        <Pressable
          onPress={() => {
            void discoveryQuery.refetch();
          }}
          style={({ pressed }) => [styles.refreshButton, pressed ? styles.actionButtonPressed : null]}
        >
          <RefreshCw color={colors.accent} size={16} />
          <Text style={styles.refreshButtonText}>Yenile</Text>
        </Pressable>
      </View>

      {currentProfile ? (
        <View style={styles.currentCard}>
          <Text style={styles.currentKicker}>SENIN KARTIN</Text>
          <Text style={styles.currentName}>{currentProfile.full_name}</Text>
          {currentProfile.headline ? <Text style={styles.currentHeadline}>{currentProfile.headline}</Text> : null}
          <Text style={styles.currentMeta}>
            {currentProfile.interest_area} • {currentProfile.goal}
          </Text>
          <Text style={styles.currentStatus}>
            Profil puani %{currentProfile.profile_completion_score} • {currentProfile.is_visible ? "gorunur" : "gizli"}
          </Text>
          {contactSummary ? <Text style={styles.currentContact}>{contactSummary}</Text> : null}
        </View>
      ) : null}

      {discoveryQuery.isLoading && !discoveryQuery.data ? (
        <View style={styles.loaderCard}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loaderTitle}>Eşleşmeler hazırlanıyor</Text>
          <Text style={styles.loaderText}>Uzmanlık, hedef ve aktivite sinyalleri işleniyor.</Text>
        </View>
      ) : null}

      {discoveryQuery.isError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Discovery yüklenemedi</Text>
          <Text style={styles.errorText}>
            {discoveryQuery.error instanceof Error
              ? discoveryQuery.error.message
              : "Networking listesi su anda getirilemiyor."}
          </Text>
        </View>
      ) : null}

      {discoveryQuery.data ? (
        <>
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>{discoveryQuery.data.message}</Text>
          </View>

          <Text style={styles.sectionTitle}>Sana en uygun isimler</Text>
          {discoveryQuery.data.recommendedProfiles.length > 0 ? (
            discoveryQuery.data.recommendedProfiles.map((profile) => (
              <MatchCard key={profile.id} profile={profile} accent="teal" />
            ))
          ) : (
            <EmptyState text="Henüz güçlü bir eşleşme oluşmadı. Profilini zenginleştirirsen skor tabanı genişler." />
          )}

          <Text style={styles.sectionTitle}>Diğer görünür profiller</Text>
          {discoveryQuery.data.otherProfiles.length > 0 ? (
            discoveryQuery.data.otherProfiles.map((profile) => (
              <MatchCard key={profile.id} profile={profile} accent="sand" />
            ))
          ) : (
            <EmptyState text="Şu anda öneri havuzu dışında listelenecek ek profil yok." />
          )}
        </>
      ) : null}
    </ScreenShell>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  actionButtonPressed: {
    opacity: 0.84
  },
  actionButtonText: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800",
    marginLeft: 8
  },
  bannerCard: {
    alignItems: "center",
    backgroundColor: "rgba(255, 253, 248, 0.88)",
    borderRadius: radii.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
    padding: spacing.md
  },
  bannerMetric: {
    flex: 1
  },
  bannerValue: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 22,
    fontWeight: "700"
  },
  bannerLabel: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2
  },
  refreshButton: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  refreshButtonText: {
    color: colors.accent,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800",
    marginLeft: 8
  },
  currentCard: {
    backgroundColor: "#102B2D",
    borderRadius: radii.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg
  },
  currentKicker: {
    color: "#8FE4D8",
    fontFamily: typography.body,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: spacing.xs
  },
  currentName: {
    color: "#FFFFFF",
    fontFamily: typography.display,
    fontSize: 24,
    fontWeight: "700"
  },
  currentHeadline: {
    color: "#D7ECE8",
    fontFamily: typography.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.xs
  },
  currentMeta: {
    color: "#F7D5C0",
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "700",
    marginTop: spacing.md
  },
  currentStatus: {
    color: "#D7ECE8",
    fontFamily: typography.body,
    fontSize: 13,
    marginTop: spacing.xs
  },
  currentContact: {
    color: "#FFFFFF",
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "700",
    marginTop: spacing.md
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
    fontSize: 19,
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
    backgroundColor: "#FDECEC",
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
  sectionTitle: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: spacing.md,
    marginTop: spacing.sm
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg
  },
  emptyText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 14,
    lineHeight: 20
  }
});
