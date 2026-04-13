import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Heart,
  Instagram,
  Linkedin,
  Plus,
  MessageCircle,
  Play,
  RefreshCw,
  Send,
  Trash2,
  UserRound
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { ScreenShell } from "../../src/components/screen-shell";
import {
  createNetworkingGalleryPost,
  createNetworkingGalleryComment,
  deleteNetworkingGalleryPost,
  fetchMessageThreads,
  fetchNetworkingFeed,
  fetchNetworkingGalleryComments,
  fetchNetworkingGalleryFeed,
  toggleNetworkingGalleryLike
} from "../../src/lib/mobile-api";
import type {
  AttendeeRole,
  MobileNetworkingFeed,
  MobileNetworkingGalleryComment,
  MobileNetworkingGalleryCommentsResponse,
  MobileNetworkingGalleryFeed
} from "../../src/lib/mobile-contracts";
import { useMobileMe } from "../../src/hooks/use-mobile-me";
import {
  getInstagramProfileUrl,
  getLinkedinProfileUrl,
  parseContactInfo
} from "../../src/lib/networking-contact";
import { colors, radii, spacing, typography } from "../../src/theme/tokens";

type NetworkingSection = "discovery" | "gallery";

const ROLE_LABELS: Record<AttendeeRole, string> = {
  Student: "Öğrenci",
  Clinician: "Klinisyen",
  Academic: "Akademisyen",
  Entrepreneur: "Girişimci",
  Industry: "Sektör"
};

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

const DOUBLE_TAP_WINDOW_MS = 280;

type UploadProgressState = {
  total: number;
  completed: number;
  uploaded: number;
  failed: number;
  currentFile: string | null;
};

function createGalleryBatchId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`.slice(0, 24);
}

function patchGalleryPostInCache(
  feed: MobileNetworkingGalleryFeed | undefined,
  itemId: string,
  mutate: (
    post: MobileNetworkingGalleryFeed["posts"][number]
  ) => MobileNetworkingGalleryFeed["posts"][number]
) {
  if (!feed) {
    return feed;
  }

  return {
    ...feed,
    posts: feed.posts.map((post) => (post.id === itemId ? mutate(post) : post))
  };
}

type DiscoveryProfileItem = MobileNetworkingFeed["queue"][number];

function resolveAssetMediaKind(asset: ImagePicker.ImagePickerAsset): "photo" | "video" | null {
  if (asset.type === "video") {
    return "video";
  }
  if (asset.type === "image") {
    return "photo";
  }

  const mime = typeof asset.mimeType === "string" ? asset.mimeType.toLowerCase() : "";
  if (mime.startsWith("video/")) {
    return "video";
  }
  if (mime.startsWith("image/")) {
    return "photo";
  }

  return null;
}

export default function ParticipantNetworkingScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width: windowWidth } = useWindowDimensions();
  const { me } = useMobileMe();
  const attendeeId = me?.attendee?.id ?? null;
  const [activeSection, setActiveSection] = useState<NetworkingSection>("gallery");
  const [searchQuery, setSearchQuery] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [selectedUploadAssets, setSelectedUploadAssets] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [uploadCaption, setUploadCaption] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [isUploadSheetVisible, setIsUploadSheetVisible] = useState(false);
  const [activeCommentItemId, setActiveCommentItemId] = useState<string | null>(null);
  const [isCommentSheetVisible, setIsCommentSheetVisible] = useState(false);
  const [activeProfileCard, setActiveProfileCard] = useState<DiscoveryProfileItem | null>(null);
  const [isProfileCardVisible, setIsProfileCardVisible] = useState(false);
  const [postCarouselIndexById, setPostCarouselIndexById] = useState<Record<string, number>>({});
  const [uploadCarouselIndex, setUploadCarouselIndex] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState | null>(null);
  const [lastPhotoTap, setLastPhotoTap] = useState<{ itemId: string; at: number } | null>(null);

  const feedQuery = useQuery({
    queryKey: ["mobile-networking-feed"],
    queryFn: fetchNetworkingFeed,
    enabled: Boolean(me && me.role === "participant" && me.attendee),
    refetchInterval: 12_000
  });

  const galleryFeedQuery = useQuery({
    queryKey: ["mobile-networking-gallery-feed"],
    queryFn: () => fetchNetworkingGalleryFeed(20),
    enabled: Boolean(me && me.role === "participant" && me.attendee),
    refetchInterval: 15_000
  });

  const galleryCommentsQuery = useQuery({
    queryKey: ["mobile-networking-gallery-comments", activeCommentItemId],
    queryFn: () => fetchNetworkingGalleryComments(activeCommentItemId as string, 120),
    enabled: Boolean(activeCommentItemId && isCommentSheetVisible && me?.attendee),
    staleTime: 4_000
  });

  const threadsQuery = useQuery({
    queryKey: ["mobile-networking-threads"],
    queryFn: fetchMessageThreads,
    enabled: Boolean(me && me.role === "participant" && me.attendee),
    refetchInterval: 10_000
  });

  const galleryLikeMutation = useMutation({
    mutationFn: ({ itemId }: { itemId: string }) => toggleNetworkingGalleryLike(itemId),
    onMutate: async ({ itemId }) => {
      await queryClient.cancelQueries({ queryKey: ["mobile-networking-gallery-feed"] });
      const previousFeed = queryClient.getQueryData<MobileNetworkingGalleryFeed>([
        "mobile-networking-gallery-feed"
      ]);

      queryClient.setQueryData<MobileNetworkingGalleryFeed>(
        ["mobile-networking-gallery-feed"],
        (current) =>
          patchGalleryPostInCache(current, itemId, (post) => {
            const nextLikedByMe = !post.likedByMe;
            const nextLikesCount = Math.max(
              0,
              post.likesCount + (nextLikedByMe ? 1 : -1)
            );

            return {
              ...post,
              likedByMe: nextLikedByMe,
              likesCount: nextLikesCount
            };
          })
      );

      return { previousFeed };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousFeed) {
        queryClient.setQueryData(["mobile-networking-gallery-feed"], context.previousFeed);
      }
    },
    onSuccess: (result) => {
      queryClient.setQueryData<MobileNetworkingGalleryFeed>(
        ["mobile-networking-gallery-feed"],
        (current) =>
          patchGalleryPostInCache(current, result.itemId, (post) => ({
            ...post,
            likedByMe: result.liked,
            likesCount: result.likesCount
          }))
      );
    }
  });

  const galleryCommentMutation = useMutation({
    mutationFn: ({ itemId, text }: { itemId: string; text: string }) =>
      createNetworkingGalleryComment(itemId, text),
    onMutate: async ({ itemId, text }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["mobile-networking-gallery-feed"] }),
        queryClient.cancelQueries({ queryKey: ["mobile-networking-gallery-comments", itemId] })
      ]);

      const previousFeed = queryClient.getQueryData<MobileNetworkingGalleryFeed>([
        "mobile-networking-gallery-feed"
      ]);
      const previousComments = queryClient.getQueryData<MobileNetworkingGalleryCommentsResponse>([
        "mobile-networking-gallery-comments",
        itemId
      ]);
      const previousDraft = commentDrafts[itemId] ?? "";

      const optimisticComment: MobileNetworkingGalleryComment = {
        id: `temp-comment-${Date.now()}`,
        itemId,
        attendeeId: attendeeId ?? "me",
        attendeeName: me?.attendee?.name ?? "Sen",
        attendeeRole: me?.attendee?.role ?? null,
        text,
        createdAt: new Date().toISOString()
      };

      setCommentDrafts((current) => ({
        ...current,
        [itemId]: ""
      }));

      queryClient.setQueryData<MobileNetworkingGalleryFeed>(
        ["mobile-networking-gallery-feed"],
        (current) =>
          patchGalleryPostInCache(current, itemId, (post) => ({
            ...post,
            commentsCount: post.commentsCount + 1,
            recentComments: [optimisticComment, ...post.recentComments].slice(0, 3)
          }))
      );

      queryClient.setQueryData<MobileNetworkingGalleryCommentsResponse>(
        ["mobile-networking-gallery-comments", itemId],
        (current) => {
          if (!current) {
            return {
              ok: true,
              itemId,
              comments: [optimisticComment],
              total: 1
            };
          }

          return {
            ...current,
            comments: [...current.comments, optimisticComment],
            total: current.total + 1
          };
        }
      );

      return {
        itemId,
        optimisticCommentId: optimisticComment.id,
        previousFeed,
        previousComments,
        previousDraft
      };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;

      queryClient.setQueryData(["mobile-networking-gallery-feed"], context.previousFeed);
      queryClient.setQueryData(
        ["mobile-networking-gallery-comments", context.itemId],
        context.previousComments
      );
      setCommentDrafts((current) => ({
        ...current,
        [context.itemId]: context.previousDraft ?? ""
      }));
    },
    onSuccess: (result, _variables, context) => {
      queryClient.setQueryData<MobileNetworkingGalleryFeed>(
        ["mobile-networking-gallery-feed"],
        (current) =>
          patchGalleryPostInCache(current, result.itemId, (post) => {
            const withoutTemp = post.recentComments.filter(
              (comment) => comment.id !== context?.optimisticCommentId
            );
            return {
              ...post,
              commentsCount: result.commentsCount,
              recentComments: [result.comment, ...withoutTemp].slice(0, 3)
            };
          })
      );

      queryClient.setQueryData<MobileNetworkingGalleryCommentsResponse>(
        ["mobile-networking-gallery-comments", result.itemId],
        (current) => {
          if (!current) {
            return {
              ok: true,
              itemId: result.itemId,
              comments: [result.comment],
              total: result.commentsCount
            };
          }

          const nextComments = [
            ...current.comments.filter((comment) => comment.id !== context?.optimisticCommentId),
            result.comment
          ];

          return {
            ...current,
            comments: nextComments,
            total: result.commentsCount
          };
        }
      );
    }
  });

  const galleryDeleteMutation = useMutation({
    mutationFn: ({ itemId }: { itemId: string }) => deleteNetworkingGalleryPost(itemId),
    onMutate: async ({ itemId }) => {
      await queryClient.cancelQueries({ queryKey: ["mobile-networking-gallery-feed"] });
      const previousFeed = queryClient.getQueryData<MobileNetworkingGalleryFeed>([
        "mobile-networking-gallery-feed"
      ]);

      queryClient.setQueryData<MobileNetworkingGalleryFeed>(
        ["mobile-networking-gallery-feed"],
        (current) => {
          if (!current) {
            return current;
          }

          return {
            ...current,
            posts: current.posts.filter((post) => post.id !== itemId)
          };
        }
      );

      return { previousFeed };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousFeed) {
        queryClient.setQueryData(["mobile-networking-gallery-feed"], context.previousFeed);
      }
    },
    onSuccess: async (result) => {
      setUploadError("");
      setUploadMessage(
        result.deletedCount > 1
          ? `${result.deletedCount} öğelik karosel paylaşımı silindi.`
          : "Paylaşım silindi."
      );
      await queryClient.invalidateQueries({ queryKey: ["mobile-networking-gallery-feed"] });
    }
  });

  const galleryUploadMutation = useMutation({
    onMutate: () => {
      setUploadError("");
      setUploadMessage("");
      setUploadProgress({
        total: selectedUploadAssets.length,
        completed: 0,
        uploaded: 0,
        failed: 0,
        currentFile: null
      });
    },
    mutationFn: async () => {
      if (selectedUploadAssets.length === 0) {
        throw new Error("Önce en az bir medya seç.");
      }

      const uploaderName = me?.attendee?.name;
      if (!uploaderName) {
        throw new Error("Profil bilgisi eksik.");
      }

      const assets = [...selectedUploadAssets];
      const batchId = createGalleryBatchId();
      let uploadedCount = 0;
      let completedCount = 0;
      const failedFiles: string[] = [];

      setUploadProgress({
        total: assets.length,
        completed: 0,
        uploaded: 0,
        failed: 0,
        currentFile: null
      });

      let nextAssetIndex = 0;
      const concurrency = Math.min(3, assets.length);

      const runUploadWorker = async () => {
        while (nextAssetIndex < assets.length) {
          const currentIndex = nextAssetIndex;
          nextAssetIndex += 1;
          const asset = assets[currentIndex];
          const fileName = asset.fileName?.trim() || `medya-${currentIndex + 1}`;

          setUploadProgress((current) =>
            current
              ? {
                  ...current,
                  currentFile: fileName
                }
              : current
          );

          try {
            await createNetworkingGalleryPost({
              asset,
              caption: uploadCaption.trim(),
              uploaderName,
              batchId
            });
            uploadedCount += 1;
          } catch (error) {
            const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
            failedFiles.push(`${fileName}: ${detail}`);
          } finally {
            completedCount += 1;
            const failedCount = failedFiles.length;
            const uploaded = uploadedCount;

            setUploadProgress((current) =>
              current
                ? {
                    ...current,
                    completed: completedCount,
                    uploaded,
                    failed: failedCount,
                    currentFile: completedCount >= assets.length ? null : current.currentFile
                  }
                : current
            );
          }
        }
      };

      await Promise.all(Array.from({ length: concurrency }, () => runUploadWorker()));

      if (uploadedCount === 0) {
        throw new Error(failedFiles[0] ?? "Medyalar paylaşılamadı.");
      }

      return {
        uploadedCount,
        failedFiles
      };
    },
    onSuccess: async (result) => {
      setSelectedUploadAssets([]);
      setUploadCarouselIndex(0);
      setPostCarouselIndexById({});
      setUploadCaption("");
      setUploadProgress(null);
      setIsUploadSheetVisible(false);
      if (result.failedFiles.length > 0) {
        setUploadError(
          `${result.uploadedCount} medya paylaşıldı, ${result.failedFiles.length} dosya yüklenemedi.`
        );
        setUploadMessage("");
      } else {
        setUploadError("");
        setUploadMessage(
          result.uploadedCount > 1
            ? `${result.uploadedCount} medya tek karosel paylaşımı olarak eklendi.`
            : "Medya başarıyla paylaşıldı."
        );
      }
      await queryClient.invalidateQueries({ queryKey: ["mobile-networking-gallery-feed"] });
    },
    onError: () => {
      setUploadProgress(null);
    }
  });

  const normalizedSearchQuery = useMemo(
    () => searchQuery.replace(/\s+/g, " ").trim().toLocaleLowerCase("tr-TR"),
    [searchQuery]
  );

  const recommendedProfiles = useMemo(() => {
    const source = feedQuery.data?.recommended ?? feedQuery.data?.queue ?? [];
    if (!normalizedSearchQuery) {
      return source;
    }

    return source.filter((profile) => {
      const haystack = [
        profile.fullName,
        profile.interestArea,
        profile.goal,
        profile.university ?? "",
        profile.institutionName ?? "",
        profile.city ?? "",
        ...(profile.dentistryFocusAreas ?? [])
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return haystack.includes(normalizedSearchQuery);
    });
  }, [feedQuery.data?.queue, feedQuery.data?.recommended, normalizedSearchQuery]);

  const directoryProfiles = useMemo(() => {
    const source = feedQuery.data?.directory ?? feedQuery.data?.queue ?? [];
    if (!normalizedSearchQuery) {
      return source;
    }

    return source.filter((profile) => {
      const haystack = [
        profile.fullName,
        profile.interestArea,
        profile.goal,
        profile.university ?? "",
        profile.institutionName ?? "",
        profile.city ?? "",
        ...(profile.dentistryFocusAreas ?? [])
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return haystack.includes(normalizedSearchQuery);
    });
  }, [feedQuery.data?.directory, feedQuery.data?.queue, normalizedSearchQuery]);

  const recommendationProfileIds = useMemo(
    () => new Set((feedQuery.data?.recommended ?? feedQuery.data?.queue ?? []).map((item) => item.profileId)),
    [feedQuery.data?.queue, feedQuery.data?.recommended]
  );

  const latestThreadByAttendee = useMemo(() => {
    const mapped = new Map<
      string,
      { id: string; text: string; createdAt: string; senderId: string } | null
    >();

    for (const thread of threadsQuery.data?.threads ?? []) {
      if (!thread.attendee?.id) {
        continue;
      }
      mapped.set(thread.attendee.id, thread.lastMessage);
    }

    return mapped;
  }, [threadsQuery.data?.threads]);

  const selectedCommentPost = useMemo(() => {
    if (!activeCommentItemId) {
      return null;
    }

    return (galleryFeedQuery.data?.posts ?? []).find((post) => post.id === activeCommentItemId) ?? null;
  }, [activeCommentItemId, galleryFeedQuery.data?.posts]);

  const activeProfileContact = useMemo(
    () => parseContactInfo(activeProfileCard?.contactInfo ?? null),
    [activeProfileCard?.contactInfo]
  );

  const activeProfileInstagramUrl = useMemo(
    () => getInstagramProfileUrl(activeProfileCard?.instagram ?? activeProfileContact.instagram),
    [activeProfileCard?.instagram, activeProfileContact.instagram]
  );

  const activeProfileLinkedinUrl = useMemo(
    () => getLinkedinProfileUrl(activeProfileCard?.linkedin ?? activeProfileContact.linkedin),
    [activeProfileCard?.linkedin, activeProfileContact.linkedin]
  );

  const openSocial = async (url: string | null | undefined) => {
    if (!url) {
      return;
    }
    await Linking.openURL(url);
  };

  const openUploaderProfile = (name: string) => {
    const normalized = name.replace(/\s+/g, " ").trim();
    if (normalized.length < 2) {
      return;
    }

    router.push(`/(participant)/uploader?name=${encodeURIComponent(normalized)}` as never);
  };

  const openProfileCard = (profile: DiscoveryProfileItem) => {
    setActiveProfileCard(profile);
    setIsProfileCardVisible(true);
  };

  const pickMediaForUpload = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setUploadError("Galeriye erişim izni gerekiyor.");
      setUploadMessage("");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: true,
      selectionLimit: 10,
      allowsEditing: false,
      quality: 0.9
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    const validAssets = result.assets.filter((asset) => resolveAssetMediaKind(asset) !== null);

    if (validAssets.length === 0) {
      setUploadError("Sadece fotoğraf veya video seçebilirsin.");
      setUploadMessage("");
      return;
    }

    const mergedAssets = [...selectedUploadAssets];
    const seenUris = new Set(mergedAssets.map((asset) => asset.uri));

    for (const asset of validAssets) {
      if (mergedAssets.length >= 10) {
        break;
      }

      if (seenUris.has(asset.uri)) {
        continue;
      }

      mergedAssets.push(asset);
      seenUris.add(asset.uri);
    }

    const skippedCount = validAssets.length - (mergedAssets.length - selectedUploadAssets.length);

    setSelectedUploadAssets(mergedAssets);
    setUploadCarouselIndex(0);
    setUploadError("");
    setUploadMessage(
      skippedCount > 0
        ? `${mergedAssets.length} medya seçildi. En fazla 10 dosya yüklenebilir.`
        : `${mergedAssets.length} medya seçildi.`
    );
  };

  const openCommentSheet = (itemId: string) => {
    setActiveCommentItemId(itemId);
    setIsCommentSheetVisible(true);
  };

  const updateCommentDraft = (itemId: string, value: string) => {
    setCommentDrafts((current) => ({
      ...current,
      [itemId]: value.slice(0, 280)
    }));
  };

  const pendingGalleryLikeItemId =
    galleryLikeMutation.isPending ? (galleryLikeMutation.variables?.itemId ?? null) : null;
  const pendingGalleryCommentItemId =
    galleryCommentMutation.isPending ? (galleryCommentMutation.variables?.itemId ?? null) : null;
  const pendingGalleryDeleteItemId =
    galleryDeleteMutation.isPending ? (galleryDeleteMutation.variables?.itemId ?? null) : null;
  const galleryCarouselWidth = Math.max(windowWidth - spacing.md * 6, 220);
  const uploadCarouselWidth = Math.max(windowWidth - spacing.md * 4, 220);
  const uploadCompletionRate = uploadProgress
    ? Math.round((uploadProgress.completed / Math.max(1, uploadProgress.total)) * 100)
    : 0;
  const myNormalizedName = useMemo(
    () => (me?.attendee?.name ?? "").replace(/\s+/g, " ").trim().toLocaleLowerCase("tr-TR"),
    [me?.attendee?.name]
  );

  const handlePhotoDoubleTapLike = (itemId: string, likedByMe: boolean) => {
    const now = Date.now();
    if (
      lastPhotoTap &&
      lastPhotoTap.itemId === itemId &&
      now - lastPhotoTap.at <= DOUBLE_TAP_WINDOW_MS
    ) {
      setLastPhotoTap(null);
      if (!likedByMe && pendingGalleryLikeItemId !== itemId) {
        galleryLikeMutation.mutate({ itemId });
      }
      return;
    }

    setLastPhotoTap({
      itemId,
      at: now
    });
  };

  if (me?.role === "participant" && !me.attendee) {
    return <Redirect href={"/(participant)/more" as never} />;
  }

  return (
    <ScreenShell
      title="Outliers"
      subtitle="Feed'de paylaş, katılımcıları keşfet ve doğrudan sohbet başlat."
    >
      <View style={styles.segmentWrap}>
        <Pressable
          style={({ pressed }) => [
            styles.segmentButton,
            activeSection === "gallery" ? styles.segmentButtonActive : null,
            pressed ? styles.pressed : null
          ]}
          onPress={() => setActiveSection("gallery")}
        >
          <Text
            style={[
              styles.segmentLabel,
              activeSection === "gallery" ? styles.segmentLabelActive : null
            ]}
          >
            Outliers Feed
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.segmentButton,
            activeSection === "discovery" ? styles.segmentButtonActive : null,
            pressed ? styles.pressed : null
          ]}
          onPress={() => setActiveSection("discovery")}
        >
          <Text
            style={[
              styles.segmentLabel,
              activeSection === "discovery" ? styles.segmentLabelActive : null
            ]}
          >
            Keşif
          </Text>
        </Pressable>
      </View>

      {activeSection === "discovery" ? (
        <>
          <View style={styles.metricRow}>
            <Metric label="Öneri" value={String((feedQuery.data?.recommended ?? feedQuery.data?.queue ?? []).length)} />
            <Metric label="Katılımcı" value={String((feedQuery.data?.directory ?? feedQuery.data?.queue ?? []).length)} />
            <Metric label="Mesaj" value={String(threadsQuery.data?.threads.length ?? 0)} />
          </View>

          {feedQuery.isLoading ? (
            <View style={styles.loaderCard}>
              <ActivityIndicator color={colors.accent} size="large" />
              <Text style={styles.loaderText}>Outliers akışı hazırlanıyor...</Text>
            </View>
          ) : null}

          {feedQuery.isError ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>
                {feedQuery.error instanceof Error
                  ? feedQuery.error.message
                  : "Outliers akışı alınamadı."}
              </Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Katılımcı Arama</Text>
              <Pressable
                style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}
                onPress={() => {
                  void feedQuery.refetch();
                }}
              >
                <RefreshCw color={colors.inkMuted} size={16} />
              </Pressable>
            </View>
            <TextInput
              style={styles.discoverySearchInput}
              placeholder="İsim, uzmanlık alanı, şehir..."
              placeholderTextColor={colors.inkMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <Text style={styles.mutedText}>
              {feedQuery.data?.message ?? "Tüm katılımcılar listede, üstten aratarak hızlıca filtreleyebilirsin."}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Eşleşme Tavsiyeleri</Text>
            {recommendedProfiles.length === 0 ? (
              <Text style={styles.mutedText}>Aramana uygun öneri bulunamadı.</Text>
            ) : (
              recommendedProfiles.slice(0, 30).map((profile) => (
                <View key={profile.profileId} style={styles.discoveryProfileRow}>
                  <View style={styles.discoveryProfileMeta}>
                    <View style={styles.discoveryTitleRow}>
                      <Text style={styles.discoveryProfileName}>{profile.fullName}</Text>
                      {recommendationProfileIds.has(profile.profileId) ? (
                        <View style={styles.discoveryRecommendationBadge}>
                          <Text style={styles.discoveryRecommendationBadgeText}>Öneri</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.discoveryProfileInfo}>
                      {profile.interestArea} • {profile.goal}
                      {profile.city ? ` • ${profile.city}` : ""}
                    </Text>
                    {profile.matchReasons && profile.matchReasons.length > 0 ? (
                      <Text style={styles.discoveryReasonText}>
                        {profile.matchReasons.slice(0, 2).join(" • ")}
                      </Text>
                    ) : null}
                    <View style={styles.topicWrap}>
                      {profile.dentistryFocusAreas.slice(0, 3).map((item) => (
                        <View key={`${profile.profileId}-${item}`} style={styles.tag}>
                          <Text style={styles.tagText}>{item}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <Pressable
                    style={({ pressed }) => [
                      styles.discoveryProfileOpenButton,
                      pressed ? styles.pressed : null
                    ]}
                    onPress={() => {
                      openProfileCard(profile);
                    }}
                  >
                    <UserRound color={colors.accent} size={14} />
                    <Text style={styles.discoveryProfileOpenButtonText}>Profil Aç</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Tüm Katılımcılar</Text>
            {directoryProfiles.length === 0 ? (
              <Text style={styles.mutedText}>Aramana uygun katılımcı bulunamadı.</Text>
            ) : (
              directoryProfiles.map((profile) => (
                <View key={`directory-${profile.profileId}`} style={styles.discoveryDirectoryRow}>
                  <View style={styles.discoveryProfileMeta}>
                    <Text style={styles.discoveryProfileName}>{profile.fullName}</Text>
                    <Text style={styles.discoveryProfileInfo}>
                      {profile.interestArea} • {profile.goal}
                      {profile.city ? ` • ${profile.city}` : ""}
                    </Text>
                  </View>
                  <Pressable
                    style={({ pressed }) => [
                      styles.discoveryDirectoryButton,
                      pressed ? styles.pressed : null
                    ]}
                    onPress={() => {
                      openProfileCard(profile);
                    }}
                  >
                    <UserRound color="#FFFFFF" size={14} />
                    <Text style={styles.discoveryDirectoryButtonText}>Profil Aç</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sohbetler</Text>
            {threadsQuery.isLoading ? (
              <View style={styles.loaderCardAlt}>
                <ActivityIndicator color={colors.accent} size="small" />
              </View>
            ) : null}
            {!threadsQuery.isLoading && (threadsQuery.data?.threads ?? []).length === 0 ? (
              <Text style={styles.mutedText}>Henüz sohbet yok. Katılımcı kartından sohbet başlatabilirsin.</Text>
            ) : (
              (threadsQuery.data?.threads ?? []).map((thread, index) => {
                const chatAttendeeId = thread.attendee?.id ?? null;
                const latestMessage = chatAttendeeId ? latestThreadByAttendee.get(chatAttendeeId) ?? null : null;
                const previewText = latestMessage
                  ? `${latestMessage.senderId === attendeeId ? "Sen: " : ""}${latestMessage.text}`
                  : "Henüz mesaj yok.";

                return (
                  <View key={`thread-${chatAttendeeId ?? index}`} style={styles.matchRow}>
                    <View style={styles.matchIdentity}>
                      <Text style={styles.matchName}>{thread.attendee?.name ?? "Katılımcı"}</Text>
                      <Text style={styles.matchRole}>
                        {thread.attendee?.role
                          ? ROLE_LABELS[thread.attendee.role as AttendeeRole] ?? "Katılımcı"
                          : "Katılımcı"}
                      </Text>
                      <Text style={styles.matchPreview} numberOfLines={1}>
                        {previewText}
                      </Text>
                    </View>
                    <Pressable
                      disabled={!chatAttendeeId}
                      style={({ pressed }) => [
                        styles.matchChatButton,
                        !chatAttendeeId ? styles.disabled : null,
                        pressed ? styles.pressed : null
                      ]}
                      onPress={() => {
                        if (!chatAttendeeId) {
                          return;
                        }
                        router.push(
                          `/(participant)/chat?attendeeId=${encodeURIComponent(chatAttendeeId)}` as never
                        );
                      }}
                    >
                      <MessageCircle color="#FFFFFF" size={14} />
                      <Text style={styles.matchChatButtonText}>Sohbet et</Text>
                    </Pressable>
                  </View>
                );
              })
            )}
          </View>
        </>
      ) : (
        <>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Outliers Feed</Text>
              <View style={styles.cardHeaderActions}>
                <Pressable
                  style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}
                  onPress={() => {
                    setIsUploadSheetVisible(true);
                  }}
                >
                  <Plus color={colors.accent} size={16} />
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}
                  onPress={() => {
                    void galleryFeedQuery.refetch();
                  }}
                >
                  <RefreshCw color={colors.inkMuted} size={16} />
                </Pressable>
              </View>
            </View>

            {galleryFeedQuery.isLoading ? (
              <View style={styles.loaderCardAlt}>
                <ActivityIndicator color={colors.accent} size="small" />
                <Text style={styles.loaderText}>Galeri akışı yükleniyor...</Text>
              </View>
            ) : null}

            {galleryFeedQuery.isError ? (
              <View style={styles.errorCardAlt}>
                <Text style={styles.errorText}>
                  {galleryFeedQuery.error instanceof Error
                    ? galleryFeedQuery.error.message
                    : "Galeri akışı alınamadı."}
                </Text>
              </View>
            ) : null}

            {!galleryFeedQuery.isLoading && (galleryFeedQuery.data?.posts ?? []).length === 0 ? (
              <Text style={styles.mutedText}>Henüz galeriye paylaşım eklenmedi.</Text>
            ) : null}

            {(galleryFeedQuery.data?.posts ?? []).map((post) => {
              const draft = commentDrafts[post.id] ?? "";
              const avatarLetter = post.uploaderName.trim().charAt(0).toLocaleUpperCase("tr-TR") || "?";
              const hiddenCommentCount = Math.max(post.commentsCount - post.recentComments.length, 0);
              const postOwnerName = post.uploaderName.replace(/\s+/g, " ").trim().toLocaleLowerCase("tr-TR");
              const isOwnPost = myNormalizedName.length > 0 && myNormalizedName === postOwnerName;
              const postMediaItems =
                post.mediaItems && post.mediaItems.length > 0
                  ? post.mediaItems
                  : [
                      {
                        id: post.id,
                        mediaType: post.mediaType,
                        publicUrl: post.publicUrl
                      }
                    ];
              const activeMediaIndex = Math.max(
                0,
                Math.min(
                  postMediaItems.length - 1,
                  postCarouselIndexById[post.id] ?? 0
                )
              );

              return (
                <View key={post.id} style={styles.galleryPostCard}>
                  <View style={styles.galleryPostHeader}>
                    <View style={styles.galleryAvatar}>
                      <Text style={styles.galleryAvatarText}>{avatarLetter}</Text>
                    </View>
                    <View style={styles.galleryMetaBlock}>
                      <Pressable
                        style={({ pressed }) => [pressed ? styles.pressed : null]}
                        onPress={() => {
                          openUploaderProfile(post.uploaderName);
                        }}
                      >
                        <Text style={styles.galleryAuthor}>{post.uploaderName}</Text>
                      </Pressable>
                      <Text style={styles.galleryDate}>{formatGalleryDate(post.createdAt)}</Text>
                    </View>
                    {isOwnPost ? (
                      <Pressable
                        disabled={pendingGalleryDeleteItemId === post.id}
                        style={({ pressed }) => [
                          styles.galleryDeleteButton,
                          pendingGalleryDeleteItemId === post.id ? styles.disabled : null,
                          pressed ? styles.pressed : null
                        ]}
                        onPress={() => {
                          if (pendingGalleryDeleteItemId === post.id) {
                            return;
                          }
                          galleryDeleteMutation.mutate({ itemId: post.id });
                        }}
                      >
                        <Trash2 color={colors.danger} size={14} />
                        <Text style={styles.galleryDeleteButtonText}>Sil</Text>
                      </Pressable>
                    ) : null}
                  </View>

                  {postMediaItems.length > 1 ? (
                    <View>
                      <ScrollView
                        horizontal
                        pagingEnabled
                        decelerationRate="fast"
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.galleryCarouselTrack}
                        onMomentumScrollEnd={(event) => {
                          const offsetX = event.nativeEvent.contentOffset.x;
                          const nextIndex = Math.round(offsetX / galleryCarouselWidth);
                          setPostCarouselIndexById((current) => ({
                            ...current,
                            [post.id]: Math.max(
                              0,
                              Math.min(postMediaItems.length - 1, nextIndex)
                            )
                          }));
                        }}
                      >
                        {postMediaItems.map((mediaItem, index) =>
                          mediaItem.mediaType === "photo" ? (
                            <Pressable
                              key={`${post.id}-media-${mediaItem.id}-${index}`}
                              disabled={pendingGalleryLikeItemId === post.id}
                              onPress={() => {
                                handlePhotoDoubleTapLike(post.id, post.likedByMe);
                              }}
                            >
                              <Image
                                source={{ uri: mediaItem.publicUrl }}
                                resizeMode="cover"
                                style={[styles.galleryMedia, { width: galleryCarouselWidth }]}
                              />
                            </Pressable>
                          ) : (
                            <Pressable
                              key={`${post.id}-media-${mediaItem.id}-${index}`}
                              style={({ pressed }) => [
                                styles.galleryVideoCard,
                                { width: galleryCarouselWidth },
                                pressed ? styles.pressed : null
                              ]}
                              onPress={() => {
                                void openSocial(mediaItem.publicUrl);
                              }}
                            >
                              <Play color={colors.copper} size={20} />
                              <Text style={styles.galleryVideoText}>Videoyu aç</Text>
                            </Pressable>
                          )
                        )}
                      </ScrollView>

                      <View style={styles.galleryCarouselDots}>
                        {postMediaItems.map((mediaItem, index) => (
                          <View
                            key={`${post.id}-dot-${mediaItem.id}-${index}`}
                            style={[
                              styles.galleryCarouselDot,
                              activeMediaIndex === index ? styles.galleryCarouselDotActive : null
                            ]}
                          />
                        ))}
                      </View>

                      <Text style={styles.galleryCarouselCountText}>
                        {activeMediaIndex + 1}/{postMediaItems.length}
                      </Text>
                    </View>
                  ) : postMediaItems[0]?.mediaType === "photo" ? (
                    <Pressable
                      disabled={pendingGalleryLikeItemId === post.id}
                      onPress={() => {
                        handlePhotoDoubleTapLike(post.id, post.likedByMe);
                      }}
                    >
                      <Image
                        source={{ uri: postMediaItems[0]?.publicUrl ?? post.publicUrl }}
                        resizeMode="cover"
                        style={styles.galleryMedia}
                      />
                    </Pressable>
                  ) : (
                    <Pressable
                      style={({ pressed }) => [
                        styles.galleryVideoCard,
                        pressed ? styles.pressed : null
                      ]}
                      onPress={() => {
                        void openSocial(postMediaItems[0]?.publicUrl ?? post.publicUrl);
                      }}
                    >
                      <Play color={colors.copper} size={20} />
                      <Text style={styles.galleryVideoText}>Videoyu aç</Text>
                    </Pressable>
                  )}

                  {post.caption ? <Text style={styles.galleryCaption}>{post.caption}</Text> : null}

                  <View style={styles.galleryActionRow}>
                    <Pressable
                      disabled={pendingGalleryLikeItemId === post.id}
                      style={({ pressed }) => [
                        styles.galleryActionButton,
                        pressed ? styles.pressed : null
                      ]}
                      onPress={() => {
                        if (pendingGalleryLikeItemId === post.id) {
                          return;
                        }
                        galleryLikeMutation.mutate({ itemId: post.id });
                      }}
                    >
                      <Heart
                        color={post.likedByMe ? colors.danger : colors.inkMuted}
                        fill={post.likedByMe ? colors.danger : "transparent"}
                        size={16}
                      />
                      <Text
                        style={[
                          styles.galleryActionText,
                          post.likedByMe ? styles.galleryActionTextActive : null
                        ]}
                      >
                        {post.likesCount} Beğeni
                      </Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.galleryCounter,
                        pressed ? styles.pressed : null
                      ]}
                      onPress={() => {
                        openCommentSheet(post.id);
                      }}
                    >
                      <MessageCircle color={colors.copper} size={14} />
                      <Text style={styles.galleryCounterText}>{post.commentsCount} Yorum</Text>
                    </Pressable>
                  </View>

                  <View style={styles.galleryComments}>
                    {post.recentComments.length > 0 ? (
                      post.recentComments.map((comment) => (
                        <Text key={comment.id} style={styles.galleryCommentText}>
                          <Text style={styles.galleryCommentAuthor}>{comment.attendeeName}: </Text>
                          {comment.text}
                        </Text>
                      ))
                    ) : (
                      <Text style={styles.galleryCommentEmpty}>İlk yorumu sen bırak.</Text>
                    )}
                    <Pressable
                      style={({ pressed }) => [pressed ? styles.pressed : null]}
                      onPress={() => {
                        openCommentSheet(post.id);
                      }}
                    >
                      <Text style={styles.galleryCommentMore}>
                        {hiddenCommentCount > 0
                          ? `+${hiddenCommentCount} yorum daha`
                          : "Tüm yorumları görüntüle"}
                      </Text>
                    </Pressable>
                  </View>

                  <View style={styles.galleryComposerRow}>
                    <TextInput
                      style={styles.galleryComposerInput}
                      placeholder="Yorum yaz..."
                      placeholderTextColor={colors.inkMuted}
                      value={draft}
                      onChangeText={(value) => updateCommentDraft(post.id, value)}
                    />
                    <Pressable
                      disabled={
                        pendingGalleryCommentItemId === post.id || draft.trim().length < 1
                      }
                      style={({ pressed }) => [
                        styles.gallerySendButton,
                        pressed ? styles.pressed : null,
                        pendingGalleryCommentItemId === post.id || draft.trim().length < 1
                          ? styles.disabled
                          : null
                      ]}
                      onPress={() => {
                        galleryCommentMutation.mutate({
                          itemId: post.id,
                          text: draft.trim()
                        });
                      }}
                    >
                      <Send color="#FFFFFF" size={13} />
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}

      <Modal
        animationType="slide"
        transparent
        visible={isUploadSheetVisible}
        onRequestClose={() => {
          setIsUploadSheetVisible(false);
        }}
      >
        <KeyboardAvoidingView
          style={styles.sheetBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Pressable
            style={styles.sheetDismissArea}
            onPress={() => {
              setIsUploadSheetVisible(false);
            }}
          />
          <View style={styles.sheetCard}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Yeni Paylaşım</Text>
              <Pressable
                style={({ pressed }) => [styles.sheetCloseButton, pressed ? styles.pressed : null]}
                onPress={() => {
                  setIsUploadSheetVisible(false);
                }}
              >
                <Text style={styles.sheetCloseText}>Kapat</Text>
              </Pressable>
            </View>

            <Text style={styles.sheetMetaText}>
              Toplu paylaşımda fotoğraf ve videoları karosel olarak seçebilirsin.
            </Text>

            {selectedUploadAssets.length > 0 ? (
              <View>
                <ScrollView
                  horizontal
                  pagingEnabled
                  decelerationRate="fast"
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.uploadCarouselTrack}
                  onMomentumScrollEnd={(event) => {
                    const offsetX = event.nativeEvent.contentOffset.x;
                    const nextIndex = Math.round(offsetX / uploadCarouselWidth);
                    setUploadCarouselIndex(
                      Math.max(0, Math.min(selectedUploadAssets.length - 1, nextIndex))
                    );
                  }}
                >
                  {selectedUploadAssets.map((asset, index) => (
                    resolveAssetMediaKind(asset) === "video" ? (
                      <View
                        key={`${asset.uri}-${index}`}
                        style={[styles.uploadPreviewVideoCard, { width: uploadCarouselWidth }]}
                      >
                        <Play color={colors.copper} size={24} />
                        <Text style={styles.uploadPreviewVideoText}>Video</Text>
                        <Text style={styles.uploadPreviewVideoName} numberOfLines={1}>
                          {asset.fileName?.trim() || `video-${index + 1}`}
                        </Text>
                      </View>
                    ) : (
                      <Image
                        key={`${asset.uri}-${index}`}
                        source={{ uri: asset.uri }}
                        resizeMode="cover"
                        style={[styles.uploadPreviewThumb, { width: uploadCarouselWidth }]}
                      />
                    )
                  ))}
                </ScrollView>
                {selectedUploadAssets.length > 1 ? (
                  <View style={styles.uploadCarouselDots}>
                    {selectedUploadAssets.map((asset, index) => (
                      <View
                        key={`${asset.uri}-dot-${index}`}
                        style={[
                          styles.uploadCarouselDot,
                          uploadCarouselIndex === index ? styles.uploadCarouselDotActive : null
                        ]}
                      />
                    ))}
                  </View>
                ) : null}
                <Text style={styles.uploadCountText}>
                  {selectedUploadAssets.length} medya seçildi • {uploadCarouselIndex + 1}/
                  {selectedUploadAssets.length}
                </Text>
              </View>
            ) : (
              <View style={styles.uploadPlaceholder}>
                <Text style={styles.uploadPlaceholderText}>Henüz medya seçilmedi.</Text>
              </View>
            )}

            <View style={styles.uploadButtonRow}>
              <Pressable
                style={({ pressed }) => [styles.uploadPickButton, pressed ? styles.pressed : null]}
                onPress={() => {
                  void pickMediaForUpload();
                }}
              >
                <Text style={styles.uploadPickButtonText}>Medya Seç</Text>
              </Pressable>
              {selectedUploadAssets.length > 0 ? (
                <Pressable
                  style={({ pressed }) => [styles.uploadClearButton, pressed ? styles.pressed : null]}
                  onPress={() => {
                    setSelectedUploadAssets([]);
                    setUploadCarouselIndex(0);
                    setUploadMessage("Seçim temizlendi.");
                    setUploadError("");
                  }}
                >
                  <Text style={styles.uploadClearButtonText}>Seçimi Temizle</Text>
                </Pressable>
              ) : null}
            </View>

            <TextInput
              style={styles.galleryComposerInput}
              placeholder="Açıklama ekle..."
              placeholderTextColor={colors.inkMuted}
              value={uploadCaption}
              onChangeText={(value) => setUploadCaption(value.slice(0, 280))}
            />

            {uploadError ? <Text style={styles.errorText}>{uploadError}</Text> : null}
            {uploadMessage ? <Text style={styles.uploadSuccessText}>{uploadMessage}</Text> : null}
            {galleryUploadMutation.error ? (
              <Text style={styles.errorText}>
                {galleryUploadMutation.error instanceof Error
                  ? galleryUploadMutation.error.message
                  : "Medya paylaşılamadı."}
              </Text>
            ) : null}

            {uploadProgress && galleryUploadMutation.isPending ? (
              <View style={styles.uploadProgressWrap}>
                <View style={styles.uploadProgressTrack}>
                  <View
                    style={[
                      styles.uploadProgressFill,
                      { width: `${Math.max(0, Math.min(100, uploadCompletionRate))}%` }
                    ]}
                  />
                </View>
                <Text style={styles.uploadProgressText}>
                  {uploadProgress.completed}/{uploadProgress.total} tamamlandı • {uploadProgress.uploaded} yüklendi
                  {uploadProgress.failed > 0 ? ` • ${uploadProgress.failed} hata` : ""}
                </Text>
                {uploadProgress.currentFile ? (
                  <Text style={styles.uploadProgressCurrentFile} numberOfLines={1}>
                    İşleniyor: {uploadProgress.currentFile}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <Pressable
              disabled={selectedUploadAssets.length === 0 || galleryUploadMutation.isPending}
              style={({ pressed }) => [
                styles.uploadShareButton,
                pressed ? styles.pressed : null,
                selectedUploadAssets.length === 0 || galleryUploadMutation.isPending ? styles.disabled : null
              ]}
              onPress={() => {
                galleryUploadMutation.mutate();
              }}
            >
              {galleryUploadMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.uploadShareButtonText}>
                  Paylaş ({selectedUploadAssets.length})
                </Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        animationType="slide"
        transparent
        visible={isProfileCardVisible}
        onRequestClose={() => {
          setIsProfileCardVisible(false);
        }}
      >
        <View style={styles.sheetBackdrop}>
          <Pressable
            style={styles.sheetDismissArea}
            onPress={() => {
              setIsProfileCardVisible(false);
            }}
          />
          <View style={styles.sheetCard}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Profil Kartı</Text>
              <Pressable
                style={({ pressed }) => [styles.sheetCloseButton, pressed ? styles.pressed : null]}
                onPress={() => {
                  setIsProfileCardVisible(false);
                }}
              >
                <Text style={styles.sheetCloseText}>Kapat</Text>
              </Pressable>
            </View>

            {activeProfileCard ? (
              <>
                <Text style={styles.profileCardName}>{activeProfileCard.fullName}</Text>
                <Text style={styles.profileCardMeta}>
                  {activeProfileCard.interestArea} • {activeProfileCard.goal}
                </Text>
                {activeProfileCard.city ? (
                  <Text style={styles.profileCardSubMeta}>{activeProfileCard.city}</Text>
                ) : null}
                {activeProfileCard.university || activeProfileCard.institutionName ? (
                  <Text style={styles.profileCardSubMeta}>
                    {activeProfileCard.university ?? activeProfileCard.institutionName}
                  </Text>
                ) : null}

                <View style={styles.topicWrap}>
                  {activeProfileCard.dentistryFocusAreas.slice(0, 4).map((item) => (
                    <View key={`profile-card-${item}`} style={styles.tag}>
                      <Text style={styles.tagText}>{item}</Text>
                    </View>
                  ))}
                </View>

                {activeProfileCard.matchReasons && activeProfileCard.matchReasons.length > 0 ? (
                  <Text style={styles.discoveryReasonText}>
                    {activeProfileCard.matchReasons.slice(0, 3).join(" • ")}
                  </Text>
                ) : null}

                <View style={styles.profileCardButtonRow}>
                  <Pressable
                    disabled={!activeProfileCard.attendeeId}
                    style={({ pressed }) => [
                      styles.profileCardChatButton,
                      !activeProfileCard.attendeeId ? styles.disabled : null,
                      pressed ? styles.pressed : null
                    ]}
                    onPress={() => {
                      if (!activeProfileCard.attendeeId) {
                        return;
                      }
                      setIsProfileCardVisible(false);
                      router.push(
                        `/(participant)/chat?attendeeId=${encodeURIComponent(activeProfileCard.attendeeId)}` as never
                      );
                    }}
                  >
                    <MessageCircle color="#FFFFFF" size={14} />
                    <Text style={styles.profileCardChatButtonText}>Sohbet Et</Text>
                  </Pressable>

                  <Pressable
                    disabled={!activeProfileLinkedinUrl}
                    style={({ pressed }) => [
                      styles.profileCardSocialButton,
                      !activeProfileLinkedinUrl ? styles.disabled : null,
                      pressed ? styles.pressed : null
                    ]}
                    onPress={() => {
                      void openSocial(activeProfileLinkedinUrl);
                    }}
                  >
                    <Linkedin color={colors.accent} size={14} />
                    <Text style={styles.profileCardSocialButtonText}>LinkedIn</Text>
                  </Pressable>

                  <Pressable
                    disabled={!activeProfileInstagramUrl}
                    style={({ pressed }) => [
                      styles.profileCardSocialButton,
                      !activeProfileInstagramUrl ? styles.disabled : null,
                      pressed ? styles.pressed : null
                    ]}
                    onPress={() => {
                      void openSocial(activeProfileInstagramUrl);
                    }}
                  >
                    <Instagram color={colors.copper} size={14} />
                    <Text style={styles.profileCardSocialButtonText}>Instagram</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <Text style={styles.mutedText}>Profil bilgisi bulunamadı.</Text>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent
        visible={isCommentSheetVisible}
        onRequestClose={() => {
          setIsCommentSheetVisible(false);
        }}
      >
        <KeyboardAvoidingView
          style={styles.sheetBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Pressable
            style={styles.sheetDismissArea}
            onPress={() => {
              setIsCommentSheetVisible(false);
            }}
          />
          <View style={styles.sheetCard}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Yorumlar</Text>
              <Pressable
                style={({ pressed }) => [styles.sheetCloseButton, pressed ? styles.pressed : null]}
                onPress={() => {
                  setIsCommentSheetVisible(false);
                }}
              >
                <Text style={styles.sheetCloseText}>Kapat</Text>
              </Pressable>
            </View>

            {selectedCommentPost ? (
              <Text style={styles.sheetMetaText}>
                {selectedCommentPost.uploaderName} • {formatGalleryDate(selectedCommentPost.createdAt)}
              </Text>
            ) : null}

            {galleryCommentsQuery.isLoading ? (
              <View style={styles.sheetLoaderWrap}>
                <ActivityIndicator color={colors.accent} size="small" />
              </View>
            ) : null}

            {galleryCommentsQuery.isError ? (
              <Text style={styles.errorText}>
                {galleryCommentsQuery.error instanceof Error
                  ? galleryCommentsQuery.error.message
                  : "Yorumlar alınamadı."}
              </Text>
            ) : null}

            <ScrollView
              style={styles.sheetCommentsScroll}
              contentContainerStyle={styles.sheetCommentsContent}
              showsVerticalScrollIndicator={false}
            >
              {(galleryCommentsQuery.data?.comments ?? selectedCommentPost?.recentComments ?? []).map(
                (comment) => (
                  <View key={comment.id} style={styles.sheetCommentRow}>
                    <Text style={styles.sheetCommentAuthor}>{comment.attendeeName}</Text>
                    <Text style={styles.sheetCommentText}>{comment.text}</Text>
                    <Text style={styles.sheetCommentDate}>{formatGalleryDate(comment.createdAt)}</Text>
                  </View>
                )
              )}

              {!galleryCommentsQuery.isLoading &&
              (galleryCommentsQuery.data?.comments ?? selectedCommentPost?.recentComments ?? []).length ===
                0 ? (
                <Text style={styles.sheetEmptyText}>Henüz yorum yok. İlk yorumu sen bırak.</Text>
              ) : null}
            </ScrollView>

            {activeCommentItemId ? (
              <View style={styles.galleryComposerRow}>
                <TextInput
                  style={styles.galleryComposerInput}
                  placeholder="Yorum yaz..."
                  placeholderTextColor={colors.inkMuted}
                  value={commentDrafts[activeCommentItemId] ?? ""}
                  onChangeText={(value) => updateCommentDraft(activeCommentItemId, value)}
                />
                <Pressable
                  disabled={
                    pendingGalleryCommentItemId === activeCommentItemId ||
                    (commentDrafts[activeCommentItemId] ?? "").trim().length < 1
                  }
                  style={({ pressed }) => [
                    styles.gallerySendButton,
                    pressed ? styles.pressed : null,
                    pendingGalleryCommentItemId === activeCommentItemId ||
                    (commentDrafts[activeCommentItemId] ?? "").trim().length < 1
                      ? styles.disabled
                      : null
                  ]}
                  onPress={() => {
                    galleryCommentMutation.mutate({
                      itemId: activeCommentItemId,
                      text: (commentDrafts[activeCommentItemId] ?? "").trim()
                    });
                  }}
                >
                  <Send color="#FFFFFF" size={13} />
                </Pressable>
              </View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  segmentWrap: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: spacing.md,
    padding: 4
  },
  segmentButton: {
    alignItems: "center",
    borderRadius: radii.pill,
    flex: 1,
    justifyContent: "center",
    paddingVertical: 10
  },
  segmentButtonActive: {
    backgroundColor: colors.accentSoft
  },
  segmentLabel: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "700"
  },
  segmentLabelActive: {
    color: colors.accent
  },
  uploadCarouselTrack: {
    gap: spacing.xs,
    marginTop: spacing.sm
  },
  uploadCarouselDots: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    marginTop: spacing.xs
  },
  uploadCarouselDot: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 999,
    height: 6,
    width: 6
  },
  uploadCarouselDotActive: {
    backgroundColor: colors.accent,
    width: 18
  },
  uploadPreviewThumb: {
    backgroundColor: colors.backgroundDeep,
    borderRadius: radii.md,
    height: 176
  },
  uploadPreviewVideoCard: {
    alignItems: "center",
    backgroundColor: colors.backgroundDeep,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 176,
    justifyContent: "center",
    paddingHorizontal: spacing.md
  },
  uploadPreviewVideoText: {
    color: colors.copper,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800",
    marginTop: spacing.xs
  },
  uploadPreviewVideoName: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 11,
    marginTop: 2
  },
  uploadCountText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 11,
    marginTop: spacing.xs
  },
  uploadPlaceholder: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 120,
    justifyContent: "center",
    marginTop: spacing.sm
  },
  uploadPlaceholderText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12
  },
  uploadButtonRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.sm
  },
  uploadPickButton: {
    alignItems: "center",
    backgroundColor: colors.copperSoft,
    borderColor: colors.copper,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 8
  },
  uploadPickButtonText: {
    color: colors.copper,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "700"
  },
  uploadClearButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 8
  },
  uploadClearButtonText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "700"
  },
  uploadShareButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    justifyContent: "center",
    marginTop: spacing.sm,
    minHeight: 40
  },
  uploadShareButtonText: {
    color: "#FFFFFF",
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800"
  },
  uploadSuccessText: {
    color: colors.accent,
    fontFamily: typography.body,
    fontSize: 12,
    marginBottom: spacing.xs
  },
  uploadProgressWrap: {
    marginBottom: spacing.xs
  },
  uploadProgressTrack: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: radii.pill,
    height: 8,
    overflow: "hidden"
  },
  uploadProgressFill: {
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    height: "100%"
  },
  uploadProgressText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 11,
    marginTop: 6
  },
  uploadProgressCurrentFile: {
    color: colors.copper,
    fontFamily: typography.body,
    fontSize: 11,
    marginTop: 2
  },
  metricRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md
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
  loaderCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
    padding: spacing.lg
  },
  loaderCardAlt: {
    alignItems: "center",
    paddingBottom: spacing.sm,
    paddingTop: spacing.xs
  },
  loaderText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 13,
    marginTop: spacing.sm
  },
  errorCard: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
    padding: spacing.md
  },
  errorCardAlt: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
    padding: spacing.sm
  },
  errorText: {
    color: colors.danger,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 18
  },
  warningCard: {
    backgroundColor: colors.warningSoft,
    borderRadius: radii.lg,
    padding: spacing.md
  },
  warningText: {
    color: colors.warning,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 19
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
    padding: spacing.md
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  cardHeaderActions: {
    flexDirection: "row",
    gap: spacing.xs
  },
  cardTitle: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: spacing.sm
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  discoverySearchInput: {
    backgroundColor: colors.backgroundDeep,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 13,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10
  },
  discoveryProfileRow: {
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: spacing.xs,
    padding: spacing.sm
  },
  discoveryDirectoryRow: {
    alignItems: "center",
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10
  },
  discoveryProfileMeta: {
    flex: 1,
    marginRight: spacing.xs
  },
  discoveryTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  discoveryProfileName: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 14,
    fontWeight: "800"
  },
  discoveryProfileInfo: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12,
    marginTop: 2
  },
  discoveryReasonText: {
    color: colors.copper,
    fontFamily: typography.body,
    fontSize: 12,
    marginTop: spacing.xs
  },
  discoveryRecommendationBadge: {
    backgroundColor: colors.copperSoft,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  discoveryRecommendationBadgeText: {
    color: colors.copper,
    fontFamily: typography.body,
    fontSize: 10,
    fontWeight: "800"
  },
  discoveryProfileOpenButton: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderColor: "rgba(139,92,246,0.32)",
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: 10
  },
  discoveryProfileOpenButtonText: {
    color: colors.accent,
    fontFamily: typography.body,
    fontSize: 11,
    fontWeight: "800",
    marginLeft: 6
  },
  discoveryDirectoryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: spacing.sm
  },
  discoveryDirectoryButtonText: {
    color: "#FFFFFF",
    fontFamily: typography.body,
    fontSize: 11,
    fontWeight: "800"
  },
  profileName: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 20,
    fontWeight: "700"
  },
  profileMeta: {
    color: colors.copper,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "700",
    marginTop: spacing.xs
  },
  profileBio: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.sm
  },
  topicWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: spacing.sm
  },
  tag: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    marginBottom: spacing.xs,
    marginRight: spacing.xs,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  tagText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 11,
    fontWeight: "700"
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md
  },
  passButton: {
    alignItems: "center",
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.pill,
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: 10
  },
  likeButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: 10
  },
  passButtonText: {
    color: colors.danger,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800",
    marginLeft: 6
  },
  likeButtonText: {
    color: "#FFFFFF",
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800",
    marginLeft: 6
  },
  mutedText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 13
  },
  matchRow: {
    alignItems: "center",
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10
  },
  matchIdentity: {
    flex: 1
  },
  matchName: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800"
  },
  matchRole: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12,
    marginTop: 1
  },
  matchPreview: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 11,
    marginTop: 4
  },
  matchChatButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: spacing.sm
  },
  matchChatButtonText: {
    color: "#FFFFFF",
    fontFamily: typography.body,
    fontSize: 11,
    fontWeight: "800"
  },
  profileCardName: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 20,
    fontWeight: "700",
    marginTop: spacing.sm
  },
  profileCardMeta: {
    color: colors.copper,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4
  },
  profileCardSubMeta: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12,
    marginTop: 2
  },
  profileCardButtonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.md
  },
  profileCardChatButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: spacing.md
  },
  profileCardChatButtonText: {
    color: "#FFFFFF",
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "800",
    marginLeft: 6
  },
  profileCardSocialButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: spacing.md
  },
  profileCardSocialButtonText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 6
  },
  galleryPostCard: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.sm,
    overflow: "hidden",
    padding: spacing.sm
  },
  galleryPostHeader: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: spacing.sm
  },
  galleryAvatar: {
    alignItems: "center",
    backgroundColor: colors.copperSoft,
    borderRadius: radii.pill,
    height: 34,
    justifyContent: "center",
    marginRight: spacing.sm,
    width: 34
  },
  galleryAvatarText: {
    color: colors.copper,
    fontFamily: typography.display,
    fontSize: 15,
    fontWeight: "700"
  },
  galleryMetaBlock: {
    flex: 1
  },
  galleryDeleteButton: {
    alignItems: "center",
    backgroundColor: colors.dangerSoft,
    borderColor: "rgba(248,113,113,0.4)",
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  galleryDeleteButtonText: {
    color: colors.danger,
    fontFamily: typography.body,
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 5
  },
  galleryAuthor: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800"
  },
  galleryDate: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 11,
    marginTop: 1
  },
  galleryMedia: {
    backgroundColor: colors.backgroundDeep,
    borderRadius: radii.md,
    height: 220,
    width: "100%"
  },
  galleryCarouselTrack: {
    gap: 0
  },
  galleryCarouselDots: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    marginTop: spacing.xs
  },
  galleryCarouselDot: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 999,
    height: 6,
    width: 6
  },
  galleryCarouselDotActive: {
    backgroundColor: colors.copper,
    width: 18
  },
  galleryCarouselCountText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 11,
    marginTop: 4,
    textAlign: "center"
  },
  galleryVideoCard: {
    alignItems: "center",
    backgroundColor: colors.backgroundDeep,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 220,
    justifyContent: "center"
  },
  galleryVideoText: {
    color: colors.copper,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "700",
    marginTop: spacing.xs
  },
  galleryCaption: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.sm
  },
  galleryActionRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.sm
  },
  galleryActionButton: {
    alignItems: "center",
    flexDirection: "row"
  },
  galleryActionText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 6
  },
  galleryActionTextActive: {
    color: colors.danger
  },
  galleryCounter: {
    alignItems: "center",
    backgroundColor: colors.copperSoft,
    borderRadius: radii.pill,
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  galleryCounterText: {
    color: colors.copper,
    fontFamily: typography.body,
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 6
  },
  galleryComments: {
    marginTop: spacing.sm
  },
  galleryCommentText: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 12,
    lineHeight: 18
  },
  galleryCommentAuthor: {
    color: colors.copper,
    fontFamily: typography.body,
    fontWeight: "700"
  },
  galleryCommentMore: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 11,
    marginTop: 2
  },
  galleryCommentEmpty: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12
  },
  galleryComposerRow: {
    alignItems: "center",
    flexDirection: "row",
    marginTop: spacing.sm
  },
  galleryComposerInput: {
    backgroundColor: colors.backgroundDeep,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    flex: 1,
    fontFamily: typography.body,
    fontSize: 12,
    marginRight: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 9
  },
  gallerySendButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  sheetBackdrop: {
    backgroundColor: "rgba(2, 8, 20, 0.52)",
    flex: 1,
    justifyContent: "flex-end"
  },
  sheetDismissArea: {
    flex: 1
  },
  sheetCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    maxHeight: "76%",
    padding: spacing.md
  },
  sheetHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  sheetTitle: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 18,
    fontWeight: "700"
  },
  sheetCloseButton: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6
  },
  sheetCloseText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 11,
    fontWeight: "700"
  },
  sheetMetaText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12,
    marginTop: spacing.xs
  },
  sheetLoaderWrap: {
    alignItems: "center",
    paddingVertical: spacing.sm
  },
  sheetCommentsScroll: {
    marginTop: spacing.sm
  },
  sheetCommentsContent: {
    gap: spacing.xs,
    paddingBottom: spacing.sm
  },
  sheetCommentRow: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  sheetCommentAuthor: {
    color: colors.copper,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "700"
  },
  sheetCommentText: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2
  },
  sheetCommentDate: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 10,
    marginTop: 4
  },
  sheetEmptyText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12
  },
  disabled: {
    opacity: 0.6
  },
  pressed: {
    opacity: 0.82
  }
});
