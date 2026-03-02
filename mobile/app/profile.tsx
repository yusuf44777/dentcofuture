import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react-native";
import { ScreenShell } from "../src/components/screen-shell";
import { ProfileEditor } from "../src/components/profile-editor";
import { fetchNetworkingProfile, profileToFormValues, updateNetworkingProfile } from "../src/lib/networking";
import { useNetworkingSessionStore } from "../src/store/networking-session";
import { colors, radii, spacing, typography } from "../src/theme/tokens";

export default function ProfileScreen() {
  const router = useRouter();
  const hydrated = useNetworkingSessionStore((state) => state.hydrated);
  const profileId = useNetworkingSessionStore((state) => state.profileId);

  const profileQuery = useQuery({
    queryKey: ["networking-profile", profileId],
    queryFn: () => fetchNetworkingProfile(profileId as string),
    enabled: Boolean(profileId)
  });

  const updateMutation = useMutation({
    mutationFn: (values: Parameters<typeof updateNetworkingProfile>[1]) =>
      updateNetworkingProfile(profileId as string, values),
    onSuccess: async () => {
      await profileQuery.refetch();
      router.replace("/discovery");
    }
  });

  if (!hydrated) {
    return null;
  }

  if (!profileId) {
    return <Redirect href="/onboarding" />;
  }

  const initialValues = profileQuery.data?.profile
    ? profileToFormValues(profileQuery.data.profile)
    : undefined;

  return (
    <ScreenShell
      title="Profil vitrini"
      subtitle="Kartinin tonu, gorunurlugu ve ilgi alanlari burada sekillenir."
      rightAction={
        <Pressable
          onPress={() => {
            router.replace("/discovery");
          }}
          style={({ pressed }) => [styles.backButton, pressed ? styles.backButtonPressed : null]}
        >
          <ChevronLeft color={colors.ink} size={18} />
          <Text style={styles.backButtonLabel}>Geri</Text>
        </Pressable>
      }
    >
      {profileQuery.isLoading && !initialValues ? (
        <View style={styles.loaderCard}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loaderText}>Profil verileri yükleniyor...</Text>
        </View>
      ) : null}

      {profileQuery.isError && !initialValues ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>
            {profileQuery.error instanceof Error
              ? profileQuery.error.message
              : "Profil verileri okunamadi."}
          </Text>
        </View>
      ) : null}

      {initialValues ? (
        <ProfileEditor
          initialValues={initialValues}
          busy={updateMutation.isPending}
          errorMessage={updateMutation.error instanceof Error ? updateMutation.error.message : undefined}
          submitLabel="Profili Guncelle"
          onSubmit={(values) => {
            updateMutation.mutate(values);
          }}
        />
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  backButtonPressed: {
    opacity: 0.82
  },
  backButtonLabel: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800",
    marginLeft: 6
  },
  loaderCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    marginBottom: spacing.lg,
    padding: spacing.xl
  },
  loaderText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 14,
    marginTop: spacing.md
  },
  errorCard: {
    backgroundColor: "#FDECEC",
    borderRadius: radii.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg
  },
  errorText: {
    color: colors.danger,
    fontFamily: typography.body,
    fontSize: 14,
    fontWeight: "700"
  }
});
