import { useMemo } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Instagram, Linkedin, Play } from "lucide-react-native";
import { ScreenShell } from "../../src/components/screen-shell";
import { fetchNetworkingGalleryUploaderProfile } from "../../src/lib/mobile-api";
import { colors, radii, spacing, typography } from "../../src/theme/tokens";

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

export default function ParticipantUploaderProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name?: string }>();
  const uploaderName = useMemo(() => {
    const raw = typeof params.name === "string" ? params.name : "";
    return raw.replace(/\s+/g, " ").trim();
  }, [params.name]);

  const profileQuery = useQuery({
    queryKey: ["mobile-networking-gallery-uploader", uploaderName],
    queryFn: () => fetchNetworkingGalleryUploaderProfile(uploaderName, 36),
    enabled: uploaderName.length >= 2
  });

  const openSocial = async (url: string | null | undefined) => {
    if (!url) {
      return;
    }
    await Linking.openURL(url);
  };

  return (
    <ScreenShell title="Profil" subtitle="Paylaşım sahibinin Outliers profili">
      <Pressable
        style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : null]}
        onPress={() => {
          router.back();
        }}
      >
        <ChevronLeft color={colors.inkMuted} size={16} />
        <Text style={styles.backButtonText}>Geri Dön</Text>
      </Pressable>

      {uploaderName.length < 2 ? (
        <View style={styles.card}>
          <Text style={styles.mutedText}>Geçerli bir profil adı bulunamadı.</Text>
        </View>
      ) : null}

      {profileQuery.isLoading ? (
        <View style={styles.loaderCard}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loaderText}>Profil yükleniyor...</Text>
        </View>
      ) : null}

      {profileQuery.isError ? (
        <View style={styles.card}>
          <Text style={styles.errorText}>
            {profileQuery.error instanceof Error
              ? profileQuery.error.message
              : "Profil bilgisi alınamadı."}
          </Text>
        </View>
      ) : null}

      {profileQuery.data ? (
        <>
          <View style={styles.card}>
            <Text style={styles.profileName}>{profileQuery.data.uploader.name}</Text>
            <Text style={styles.profileMeta}>
              {profileQuery.data.uploader.role
                ? profileQuery.data.uploader.role === "Student"
                  ? "Öğrenci"
                  : profileQuery.data.uploader.role === "Academic"
                    ? "Akademisyen"
                    : "Katılımcı"
                : "Katılımcı"}
              {profileQuery.data.uploader.classLevel
                ? ` • Sınıf ${profileQuery.data.uploader.classLevel}`
                : ""}
            </Text>

            <View style={styles.contactActions}>
              <Pressable
                style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}
                onPress={() => {
                  const instagram = profileQuery.data?.uploader.instagram;
                  void openSocial(
                    instagram ? `https://www.instagram.com/${instagram.replace(/^@+/, "")}/` : ""
                  );
                }}
              >
                <Instagram color={colors.copper} size={16} />
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}
                onPress={() => {
                  const linkedin = profileQuery.data?.uploader.linkedin;
                  const normalized = linkedin ? linkedin.replace(/^https?:\/\//, "") : "";
                  void openSocial(
                    linkedin ? (linkedin.startsWith("http") ? linkedin : `https://${normalized}`) : ""
                  );
                }}
              >
                <Linkedin color={colors.accent} size={16} />
              </Pressable>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Paylaşımlar</Text>
            {profileQuery.data.posts.length === 0 ? (
              <Text style={styles.mutedText}>Henüz paylaşım yok.</Text>
            ) : (
              profileQuery.data.posts.map((post) => (
                <View key={post.id} style={styles.postCard}>
                  {post.mediaType === "photo" ? (
                    <Image source={{ uri: post.publicUrl }} resizeMode="cover" style={styles.postMedia} />
                  ) : (
                    <Pressable
                      style={({ pressed }) => [styles.videoCard, pressed ? styles.pressed : null]}
                      onPress={() => {
                        void openSocial(post.publicUrl);
                      }}
                    >
                      <Play color={colors.copper} size={20} />
                      <Text style={styles.videoText}>Videoyu aç</Text>
                    </Pressable>
                  )}
                  {post.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}
                  <View style={styles.postMetaRow}>
                    <Text style={styles.postMeta}>{formatGalleryDate(post.createdAt)}</Text>
                    <Text style={styles.postMeta}>
                      {post.likesCount} beğeni • {post.commentsCount} yorum
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </>
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.md
  },
  backButtonText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "700"
  },
  loaderCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
    padding: spacing.lg
  },
  loaderText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 13,
    marginTop: spacing.sm
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
    padding: spacing.md
  },
  profileName: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 21,
    fontWeight: "700"
  },
  profileMeta: {
    color: colors.copper,
    fontFamily: typography.body,
    fontSize: 13,
    marginTop: spacing.xs
  },
  contactActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  cardTitle: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: spacing.sm
  },
  postCard: {
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
    overflow: "hidden"
  },
  postMedia: {
    backgroundColor: colors.backgroundDeep,
    height: 210,
    width: "100%"
  },
  videoCard: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    height: 210,
    justifyContent: "center"
  },
  videoText: {
    color: colors.copper,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "700",
    marginTop: spacing.xs
  },
  caption: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm
  },
  postMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm
  },
  postMeta: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 11
  },
  mutedText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 13
  },
  errorText: {
    color: colors.danger,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 18
  },
  pressed: {
    opacity: 0.8
  }
});
