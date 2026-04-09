import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Heart,
  Plus,
  Linkedin,
  MessageCircle,
  Play,
  RefreshCw,
  Send,
  UserRoundX,
  Instagram
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { ScreenShell } from "../../src/components/screen-shell";
import {
  createNetworkingGalleryPost,
  createNetworkingGalleryComment,
  fetchMatchThread,
  fetchMessageThreads,
  fetchNetworkingFeed,
  fetchNetworkingGalleryComments,
  fetchNetworkingGalleryFeed,
  fetchNetworkingMatches,
  sendMatchMessage,
  sendNetworkingInteraction,
  toggleNetworkingGalleryLike
} from "../../src/lib/mobile-api";
import type { AttendeeRole } from "../../src/lib/mobile-contracts";
import { useMobileMe } from "../../src/hooks/use-mobile-me";
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

export default function ParticipantNetworkingScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { me } = useMobileMe();
  const attendeeId = me?.attendee?.id ?? null;
  const [activeSection, setActiveSection] = useState<NetworkingSection>("gallery");
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedAttendeeId, setSelectedAttendeeId] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [selectedUploadAssets, setSelectedUploadAssets] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [uploadCaption, setUploadCaption] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [isUploadSheetVisible, setIsUploadSheetVisible] = useState(false);
  const [activeCommentItemId, setActiveCommentItemId] = useState<string | null>(null);
  const [isCommentSheetVisible, setIsCommentSheetVisible] = useState(false);

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

  const matchesQuery = useQuery({
    queryKey: ["mobile-networking-matches"],
    queryFn: fetchNetworkingMatches,
    enabled: Boolean(me && me.role === "participant" && me.attendee),
    refetchInterval: 20_000
  });

  const threadsQuery = useQuery({
    queryKey: ["mobile-networking-threads"],
    queryFn: fetchMessageThreads,
    enabled: Boolean(me && me.role === "participant" && me.attendee),
    refetchInterval: 10_000
  });

  const threadQuery = useQuery({
    queryKey: ["mobile-networking-thread", selectedAttendeeId],
    queryFn: () => fetchMatchThread(selectedAttendeeId as string),
    enabled: Boolean(selectedAttendeeId),
    refetchInterval: 7_000
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
    }) => sendNetworkingInteraction(targetProfileId, action),
    onSuccess: async (result) => {
      setActiveIndex((current) => current + 1);
      if (result.match?.profile.attendeeId) {
        setSelectedAttendeeId(result.match.profile.attendeeId);
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mobile-networking-feed"] }),
        queryClient.invalidateQueries({ queryKey: ["mobile-networking-matches"] }),
        queryClient.invalidateQueries({ queryKey: ["mobile-networking-threads"] })
      ]);
    }
  });

  const galleryLikeMutation = useMutation({
    mutationFn: ({ itemId }: { itemId: string }) => toggleNetworkingGalleryLike(itemId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["mobile-networking-gallery-feed"] });
    }
  });

  const galleryCommentMutation = useMutation({
    mutationFn: ({ itemId, text }: { itemId: string; text: string }) =>
      createNetworkingGalleryComment(itemId, text),
    onSuccess: async (_, variables) => {
      setCommentDrafts((current) => ({
        ...current,
        [variables.itemId]: ""
      }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mobile-networking-gallery-feed"] }),
        queryClient.invalidateQueries({
          queryKey: ["mobile-networking-gallery-comments", variables.itemId]
        })
      ]);
    }
  });

  const galleryUploadMutation = useMutation({
    onMutate: () => {
      setUploadError("");
      setUploadMessage("");
    },
    mutationFn: async () => {
      if (selectedUploadAssets.length === 0) {
        throw new Error("Önce en az bir fotoğraf seç.");
      }

      const uploaderName = me?.attendee?.name;
      if (!uploaderName) {
        throw new Error("Profil bilgisi eksik.");
      }

      let uploadedCount = 0;
      const failedFiles: string[] = [];

      for (const asset of selectedUploadAssets) {
        try {
          await createNetworkingGalleryPost({
            asset,
            caption: uploadCaption.trim(),
            uploaderName
          });
          uploadedCount += 1;
        } catch (error) {
          const fileName = asset.fileName?.trim() || "isimsiz-dosya";
          const detail = error instanceof Error ? error.message : "Bilinmeyen hata";
          failedFiles.push(`${fileName}: ${detail}`);
        }
      }

      if (uploadedCount === 0) {
        throw new Error(failedFiles[0] ?? "Fotoğraflar paylaşılamadı.");
      }

      return {
        uploadedCount,
        failedFiles
      };
    },
    onSuccess: async (result) => {
      setSelectedUploadAssets([]);
      setUploadCaption("");
      setIsUploadSheetVisible(false);
      if (result.failedFiles.length > 0) {
        setUploadError(
          `${result.uploadedCount} fotoğraf paylaşıldı, ${result.failedFiles.length} dosya yüklenemedi.`
        );
        setUploadMessage("");
      } else {
        setUploadError("");
        setUploadMessage(`${result.uploadedCount} fotoğraf başarıyla paylaşıldı.`);
      }
      await queryClient.invalidateQueries({ queryKey: ["mobile-networking-gallery-feed"] });
    }
  });

  const sendMessageMutation = useMutation({
    mutationFn: ({ attendeeId, text }: { attendeeId: string; text: string }) =>
      sendMatchMessage(attendeeId, text),
    onSuccess: async () => {
      setDraftMessage("");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["mobile-networking-thread", selectedAttendeeId]
        }),
        queryClient.invalidateQueries({ queryKey: ["mobile-networking-threads"] })
      ]);
    }
  });

  const activeProfile = useMemo(() => {
    return feedQuery.data?.queue?.[activeIndex] ?? null;
  }, [activeIndex, feedQuery.data?.queue]);

  const selectedMatch = useMemo(() => {
    if (!selectedAttendeeId) {
      return null;
    }

    return (
      (matchesQuery.data?.matches ?? []).find((item) => item.attendee?.id === selectedAttendeeId) ??
      null
    );
  }, [matchesQuery.data?.matches, selectedAttendeeId]);

  const selectedCommentPost = useMemo(() => {
    if (!activeCommentItemId) {
      return null;
    }

    return (galleryFeedQuery.data?.posts ?? []).find((post) => post.id === activeCommentItemId) ?? null;
  }, [activeCommentItemId, galleryFeedQuery.data?.posts]);

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

  const pickPhotoForUpload = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setUploadError("Galeriye erişim izni gerekiyor.");
      setUploadMessage("");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsMultipleSelection: true,
      selectionLimit: 10,
      allowsEditing: false,
      quality: 0.9
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    const validAssets = result.assets.filter((asset) => {
      if (typeof asset.mimeType !== "string" || asset.mimeType.length === 0) {
        return true;
      }

      return asset.mimeType.startsWith("image/");
    });

    if (validAssets.length === 0) {
      setUploadError("Bu sürümde sadece fotoğraf paylaşılabilir.");
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
    setUploadError("");
    setUploadMessage(
      skippedCount > 0
        ? `${mergedAssets.length} fotoğraf seçildi. En fazla 10 dosya yüklenebilir.`
        : `${mergedAssets.length} fotoğraf seçildi.`
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

  if (me?.role === "participant" && !me.attendee) {
    return <Redirect href={"/(participant)/more" as never} />;
  }

  return (
    <ScreenShell
      title="Outliers"
      subtitle="Feed'de paylaş, etkileşim kur, eşleş ve anında sohbet et."
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
            <Metric
              label="Kalan Kart"
              value={String(Math.max((feedQuery.data?.queue.length ?? 0) - activeIndex, 0))}
            />
            <Metric label="Eşleşme" value={String(matchesQuery.data?.total ?? 0)} />
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
              <Text style={styles.cardTitle}>Keşif</Text>
              <Pressable
                style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}
                onPress={() => {
                  void feedQuery.refetch();
                }}
              >
                <RefreshCw color={colors.inkMuted} size={16} />
              </Pressable>
            </View>

            {activeProfile ? (
              <>
                <Text style={styles.profileName}>{activeProfile.fullName}</Text>
                <Text style={styles.profileMeta}>
                  {activeProfile.interestArea} • {activeProfile.goal}
                </Text>
                {activeProfile.bio ? <Text style={styles.profileBio}>{activeProfile.bio}</Text> : null}
                <View style={styles.topicWrap}>
                  {activeProfile.topics.slice(0, 3).map((topic) => (
                    <View key={topic} style={styles.tag}>
                      <Text style={styles.tagText}>{topic}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.actionRow}>
                  <Pressable
                    disabled={interactionMutation.isPending}
                    style={({ pressed }) => [styles.passButton, pressed ? styles.pressed : null]}
                    onPress={() => {
                      interactionMutation.mutate({
                        targetProfileId: activeProfile.profileId,
                        action: "pass"
                      });
                    }}
                  >
                    <UserRoundX color={colors.danger} size={17} />
                    <Text style={styles.passButtonText}>Pas</Text>
                  </Pressable>
                  <Pressable
                    disabled={interactionMutation.isPending}
                    style={({ pressed }) => [styles.likeButton, pressed ? styles.pressed : null]}
                    onPress={() => {
                      interactionMutation.mutate({
                        targetProfileId: activeProfile.profileId,
                        action: "like"
                      });
                    }}
                  >
                    <Heart color="#FFFFFF" fill="#FFFFFF" size={17} />
                    <Text style={styles.likeButtonText}>Beğen</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <Text style={styles.mutedText}>
                Gösterilecek yeni profil kalmadı. Yenilemeyi deneyebilirsin.
              </Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Eşleşmeler</Text>
            {(matchesQuery.data?.matches ?? []).length === 0 ? (
              <Text style={styles.mutedText}>Henüz karşılıklı eşleşme yok.</Text>
            ) : (
              (matchesQuery.data?.matches ?? []).map((match) => {
                const attendeeId = match.attendee?.id ?? match.profile.attendeeId;
                const isSelected = attendeeId ? attendeeId === selectedAttendeeId : false;

                return (
                  <Pressable
                    key={match.profile.profileId}
                    disabled={!attendeeId}
                    style={({ pressed }) => [
                      styles.matchRow,
                      isSelected ? styles.matchRowSelected : null,
                      pressed ? styles.pressed : null
                    ]}
                    onPress={() => {
                      if (attendeeId) {
                        setSelectedAttendeeId(attendeeId);
                      }
                    }}
                  >
                    <View style={styles.matchIdentity}>
                      <Text style={styles.matchName}>{match.profile.fullName}</Text>
                      <Text style={styles.matchRole}>
                        {match.attendee?.role
                          ? ROLE_LABELS[match.attendee.role as AttendeeRole] ?? "Katılımcı"
                          : "Katılımcı"}
                      </Text>
                    </View>
                    <MessageCircle color={colors.accent} size={16} />
                  </Pressable>
                );
              })
            )}
          </View>

          {selectedAttendeeId ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Sohbet</Text>
              {selectedMatch?.attendee ? (
                <View style={styles.contactRow}>
                  <Text style={styles.contactLabel}>{selectedMatch.attendee.name}</Text>
                  <View style={styles.contactActions}>
                    <Pressable
                      style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}
                      onPress={() => {
                        const instagram = selectedMatch.attendee?.instagram;
                        void openSocial(
                          instagram
                            ? `https://www.instagram.com/${instagram.replace(/^@+/, "")}/`
                            : ""
                        );
                      }}
                    >
                      <Instagram color={colors.copper} size={16} />
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}
                      onPress={() => {
                        const linkedin = selectedMatch.attendee?.linkedin;
                        const normalized = linkedin ? linkedin.replace(/^https?:\/\//, "") : "";
                        void openSocial(
                          linkedin
                            ? linkedin.startsWith("http")
                              ? linkedin
                              : `https://${normalized}`
                            : ""
                        );
                      }}
                    >
                      <Linkedin color={colors.accent} size={16} />
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {threadQuery.isLoading ? (
                <ActivityIndicator color={colors.accent} size="small" />
              ) : (
                <ScrollView style={styles.threadScroll} contentContainerStyle={styles.threadContent}>
                  {(threadQuery.data?.thread.messages ?? []).map((message) => {
                    const mine = message.senderId === attendeeId;
                    return (
                      <View
                        key={message.id}
                        style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}
                      >
                        <Text style={[styles.bubbleText, mine ? styles.bubbleTextMine : null]}>
                          {message.text}
                        </Text>
                        <Text style={[styles.bubbleMeta, mine ? styles.bubbleMetaMine : null]}>
                          {new Date(message.createdAt).toLocaleTimeString("tr-TR", {
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </Text>
                      </View>
                    );
                  })}
                </ScrollView>
              )}

              <View style={styles.composerRow}>
                <TextInput
                  style={styles.composerInput}
                  placeholder="Mesaj yaz..."
                  placeholderTextColor={colors.inkMuted}
                  value={draftMessage}
                  onChangeText={(value) => setDraftMessage(value.slice(0, 500))}
                />
                <Pressable
                  disabled={sendMessageMutation.isPending || draftMessage.trim().length < 1}
                  style={({ pressed }) => [
                    styles.sendButton,
                    pressed ? styles.pressed : null,
                    sendMessageMutation.isPending || draftMessage.trim().length < 1
                      ? styles.disabled
                      : null
                  ]}
                  onPress={() => {
                    if (!selectedAttendeeId) {
                      return;
                    }

                    sendMessageMutation.mutate({
                      attendeeId: selectedAttendeeId,
                      text: draftMessage.trim()
                    });
                  }}
                >
                  <Send color="#FFFFFF" size={14} />
                </Pressable>
              </View>
            </View>
          ) : null}
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
                  </View>

                  {post.mediaType === "photo" ? (
                    <Image
                      source={{ uri: post.publicUrl }}
                      resizeMode="cover"
                      style={styles.galleryMedia}
                    />
                  ) : (
                    <Pressable
                      style={({ pressed }) => [
                        styles.galleryVideoCard,
                        pressed ? styles.pressed : null
                      ]}
                      onPress={() => {
                        void openSocial(post.publicUrl);
                      }}
                    >
                      <Play color={colors.copper} size={20} />
                      <Text style={styles.galleryVideoText}>Videoyu aç</Text>
                    </Pressable>
                  )}

                  {post.caption ? <Text style={styles.galleryCaption}>{post.caption}</Text> : null}

                  <View style={styles.galleryActionRow}>
                    <Pressable
                      disabled={galleryLikeMutation.isPending}
                      style={({ pressed }) => [
                        styles.galleryActionButton,
                        pressed ? styles.pressed : null
                      ]}
                      onPress={() => {
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
                      disabled={galleryCommentMutation.isPending || draft.trim().length < 1}
                      style={({ pressed }) => [
                        styles.gallerySendButton,
                        pressed ? styles.pressed : null,
                        galleryCommentMutation.isPending || draft.trim().length < 1
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
        <View style={styles.sheetBackdrop}>
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
              Bu sürümde yalnızca fotoğraf paylaşımı açık. Video paylaşımı yakında eklenecek.
            </Text>

            {selectedUploadAssets.length > 0 ? (
              <View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.uploadPreviewStrip}
                >
                  {selectedUploadAssets.map((asset, index) => (
                    <Image
                      key={`${asset.uri}-${index}`}
                      source={{ uri: asset.uri }}
                      resizeMode="cover"
                      style={styles.uploadPreviewThumb}
                    />
                  ))}
                </ScrollView>
                <Text style={styles.uploadCountText}>{selectedUploadAssets.length} fotoğraf seçildi</Text>
              </View>
            ) : (
              <View style={styles.uploadPlaceholder}>
                <Text style={styles.uploadPlaceholderText}>Henüz fotoğraf seçilmedi.</Text>
              </View>
            )}

            <View style={styles.uploadButtonRow}>
              <Pressable
                style={({ pressed }) => [styles.uploadPickButton, pressed ? styles.pressed : null]}
                onPress={() => {
                  void pickPhotoForUpload();
                }}
              >
                <Text style={styles.uploadPickButtonText}>Fotoğrafları Seç</Text>
              </Pressable>
              {selectedUploadAssets.length > 0 ? (
                <Pressable
                  style={({ pressed }) => [styles.uploadClearButton, pressed ? styles.pressed : null]}
                  onPress={() => {
                    setSelectedUploadAssets([]);
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
                  : "Fotoğraf paylaşılamadı."}
              </Text>
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
        <View style={styles.sheetBackdrop}>
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
                    galleryCommentMutation.isPending ||
                    (commentDrafts[activeCommentItemId] ?? "").trim().length < 1
                  }
                  style={({ pressed }) => [
                    styles.gallerySendButton,
                    pressed ? styles.pressed : null,
                    galleryCommentMutation.isPending ||
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
        </View>
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
  uploadPreviewStrip: {
    gap: spacing.xs,
    marginTop: spacing.sm
  },
  uploadPreviewThumb: {
    backgroundColor: colors.backgroundDeep,
    borderRadius: radii.md,
    height: 116,
    width: 116
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
  matchRowSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent
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
  contactRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm
  },
  contactLabel: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800"
  },
  contactActions: {
    flexDirection: "row",
    gap: spacing.xs
  },
  threadScroll: {
    maxHeight: 230
  },
  threadContent: {
    gap: spacing.xs
  },
  bubble: {
    borderRadius: radii.md,
    maxWidth: "86%",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  bubbleMine: {
    alignSelf: "flex-end",
    backgroundColor: colors.accent
  },
  bubbleOther: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceMuted
  },
  bubbleText: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 18
  },
  bubbleTextMine: {
    color: "#FFFFFF"
  },
  bubbleMeta: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 10,
    marginTop: 4
  },
  bubbleMetaMine: {
    color: "rgba(255,255,255,0.82)"
  },
  composerRow: {
    alignItems: "center",
    flexDirection: "row",
    marginTop: spacing.sm
  },
  composerInput: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    flex: 1,
    fontFamily: typography.body,
    fontSize: 13,
    marginRight: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10
  },
  sendButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    height: 38,
    justifyContent: "center",
    width: 38
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
