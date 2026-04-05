import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Linkedin, MessageCircle, RefreshCw, Send, UserRoundX, Instagram } from "lucide-react-native";
import { ScreenShell } from "../../src/components/screen-shell";
import {
  fetchMatchThread,
  fetchMessageThreads,
  fetchNetworkingFeed,
  fetchNetworkingMatches,
  sendMatchMessage,
  sendNetworkingInteraction
} from "../../src/lib/mobile-api";
import { useMobileMe } from "../../src/hooks/use-mobile-me";
import { colors, radii, spacing, typography } from "../../src/theme/tokens";

export default function ParticipantNetworkingScreen() {
  const queryClient = useQueryClient();
  const { me } = useMobileMe();
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedAttendeeId, setSelectedAttendeeId] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState("");

  const feedQuery = useQuery({
    queryKey: ["mobile-networking-feed"],
    queryFn: fetchNetworkingFeed,
    enabled: Boolean(me && me.role === "participant" && me.attendee),
    refetchInterval: 12_000
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

  const sendMessageMutation = useMutation({
    mutationFn: ({ attendeeId, text }: { attendeeId: string; text: string }) =>
      sendMatchMessage(attendeeId, text),
    onSuccess: async () => {
      setDraftMessage("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mobile-networking-thread", selectedAttendeeId] }),
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

    return (matchesQuery.data?.matches ?? []).find((item) => item.attendee?.id === selectedAttendeeId) ?? null;
  }, [matchesQuery.data?.matches, selectedAttendeeId]);

  const openSocial = async (url: string | null | undefined) => {
    if (!url) {
      return;
    }
    await Linking.openURL(url);
  };

  if (!me?.attendee) {
    return (
      <ScreenShell
        title="Networking"
        subtitle="Networking modülü için önce katılımcı profilini tamamlayın."
      >
        <View style={styles.warningCard}>
          <Text style={styles.warningText}>Profil tamamlandıktan sonra eşleşme ve mesajlaşma aktif olur.</Text>
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Networking"
      subtitle="Keşfet, karşılıklı eşleşme oluştur ve anında sohbet et."
    >
      <View style={styles.metricRow}>
        <Metric label="Kalan Kart" value={String(Math.max((feedQuery.data?.queue.length ?? 0) - activeIndex, 0))} />
        <Metric label="Eşleşme" value={String(matchesQuery.data?.total ?? 0)} />
        <Metric label="Mesaj" value={String(threadsQuery.data?.threads.length ?? 0)} />
      </View>

      {feedQuery.isLoading ? (
        <View style={styles.loaderCard}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loaderText}>Networking akışı hazırlanıyor...</Text>
        </View>
      ) : null}

      {feedQuery.isError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{feedQuery.error instanceof Error ? feedQuery.error.message : "Networking beslemesi alınamadı."}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Discovery</Text>
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
            <Text style={styles.profileMeta}>{activeProfile.interestArea} • {activeProfile.goal}</Text>
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
                  interactionMutation.mutate({ targetProfileId: activeProfile.profileId, action: "pass" });
                }}
              >
                <UserRoundX color={colors.danger} size={17} />
                <Text style={styles.passButtonText}>Pas</Text>
              </Pressable>
              <Pressable
                disabled={interactionMutation.isPending}
                style={({ pressed }) => [styles.likeButton, pressed ? styles.pressed : null]}
                onPress={() => {
                  interactionMutation.mutate({ targetProfileId: activeProfile.profileId, action: "like" });
                }}
              >
                <Heart color="#FFFFFF" fill="#FFFFFF" size={17} />
                <Text style={styles.likeButtonText}>Beğen</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Text style={styles.mutedText}>Gösterilecek yeni profil kalmadı. Yenilemeyi deneyebilirsin.</Text>
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
                  <Text style={styles.matchRole}>{match.attendee?.role ?? "Katılımcı"}</Text>
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
                    void openSocial(instagram ? `https://www.instagram.com/${instagram.replace(/^@+/, "")}/` : "");
                  }}
                >
                  <Instagram color={colors.copper} size={16} />
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}
                  onPress={() => {
                    const linkedin = selectedMatch.attendee?.linkedin;
                    const normalized = linkedin ? linkedin.replace(/^https?:\/\//, "") : "";
                    void openSocial(linkedin ? (linkedin.startsWith("http") ? linkedin : `https://${normalized}`) : "");
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
                const mine = message.senderId === me.attendee?.id;
                return (
                  <View key={message.id} style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                    <Text style={[styles.bubbleText, mine ? styles.bubbleTextMine : null]}>{message.text}</Text>
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
              placeholderTextColor="#8D9895"
              value={draftMessage}
              onChangeText={(value) => setDraftMessage(value.slice(0, 500))}
            />
            <Pressable
              disabled={sendMessageMutation.isPending || draftMessage.trim().length < 1}
              style={({ pressed }) => [
                styles.sendButton,
                pressed ? styles.pressed : null,
                sendMessageMutation.isPending || draftMessage.trim().length < 1 ? styles.disabled : null
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
  loaderText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 13,
    marginTop: spacing.sm
  },
  errorCard: {
    backgroundColor: "#FDECEC",
    borderRadius: radii.lg,
    marginBottom: spacing.md,
    padding: spacing.md
  },
  errorText: {
    color: colors.danger,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 18
  },
  warningCard: {
    backgroundColor: "#FFF3D6",
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
    backgroundColor: "#FFF1F1",
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
  disabled: {
    opacity: 0.6
  },
  pressed: {
    opacity: 0.82
  }
});
