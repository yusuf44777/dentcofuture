import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Edit3, HeartHandshake } from "lucide-react-native";
import { MatchCard } from "../src/components/match-card";
import { ScreenShell } from "../src/components/screen-shell";
import { fetchNetworkingMatches } from "../src/lib/networking";
import { useNetworkingSessionStore } from "../src/store/networking-session";
import { colors, radii, spacing, typography } from "../src/theme/tokens";

export default function MatchesScreen() {
  const router = useRouter();
  const hydrated = useNetworkingSessionStore((state) => state.hydrated);
  const profileId = useNetworkingSessionStore((state) => state.profileId);

  const matchesQuery = useQuery({
    queryKey: ["networking-matches", profileId],
    queryFn: () => fetchNetworkingMatches(profileId as string),
    enabled: Boolean(profileId),
    refetchInterval: 30_000,
    refetchOnReconnect: true
  });

  if (!hydrated) {
    return null;
  }

  if (!profileId) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <ScreenShell
      title="Karsilikli eslesmeler"
      subtitle="Iki taraf da ilgi gonderdiginde kartlar burada acilir ve iletisim bilgileri gorunur."
      rightAction={
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => {
              router.replace("/discovery");
            }}
            style={({ pressed }) => [styles.headerButton, pressed ? styles.headerButtonPressed : null]}
          >
            <ChevronLeft color={colors.ink} size={16} />
            <Text style={styles.headerButtonText}>Kesfet</Text>
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
        </View>
      }
      scrollProps={{
        refreshControl: (
          <RefreshControl
            refreshing={matchesQuery.isRefetching}
            tintColor={colors.accent}
            onRefresh={() => {
              void matchesQuery.refetch();
            }}
          />
        )
      }}
    >
      <View style={styles.heroBadge}>
        <HeartHandshake color={colors.accent} size={18} />
        <Text style={styles.heroBadgeText}>
          {matchesQuery.data?.total ?? 0} aktif eslesme
        </Text>
      </View>

      {matchesQuery.isLoading && !matchesQuery.data ? (
        <View style={styles.loaderCard}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loaderTitle}>Eslesmeler taraniyor</Text>
          <Text style={styles.loaderText}>Karsilikli ilgiler burada toplanacak.</Text>
        </View>
      ) : null}

      {matchesQuery.isError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Eslesmeler yuklenemedi</Text>
          <Text style={styles.errorText}>
            {matchesQuery.error instanceof Error
              ? matchesQuery.error.message
              : "Eslesme listesi su anda getirilemiyor."}
          </Text>
        </View>
      ) : null}

      {matchesQuery.data ? (
        matchesQuery.data.matches.length ? (
          matchesQuery.data.matches.map((match) => (
            <View key={match.profile.id} style={styles.matchBlock}>
              <Text style={styles.matchMeta}>
                Eslesti • {new Date(match.matchedAt).toLocaleDateString("tr-TR")}
              </Text>
              <MatchCard profile={match.profile} accent="teal" />
            </View>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Henüz karsilikli ilgi yok</Text>
            <Text style={styles.emptyText}>
              Discovery tarafinda ilgini gonderdiklerin sana geri donerse burada gorunurler.
            </Text>
            <Pressable
              onPress={() => {
                router.replace("/discovery");
              }}
              style={({ pressed }) => [styles.emptyButton, pressed ? styles.headerButtonPressed : null]}
            >
              <Text style={styles.emptyButtonText}>Kartlara Don</Text>
            </Pressable>
          </View>
        )
      ) : null}
    </ScreenShell>
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
  heroBadge: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    flexDirection: "row",
    marginBottom: spacing.lg,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  heroBadgeText: {
    color: colors.accent,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800",
    marginLeft: 8
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
    marginTop: spacing.sm
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
  matchBlock: {
    marginBottom: spacing.sm
  },
  matchMeta: {
    color: colors.copper,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: spacing.xs,
    textTransform: "uppercase"
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
    alignSelf: "flex-start",
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    marginTop: spacing.md,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  emptyButtonText: {
    color: "#FFFFFF",
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800"
  }
});
