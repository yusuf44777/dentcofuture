import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, Instagram, Linkedin, Send } from "lucide-react-native";
import { fetchMatchThread, sendMatchMessage } from "../../src/lib/mobile-api";
import type { AttendeeRole, MobileMatchThread } from "../../src/lib/mobile-contracts";
import { useMobileMe } from "../../src/hooks/use-mobile-me";
import { colors, radii, spacing, typography } from "../../src/theme/tokens";

type MatchThreadQueryData = { ok: true; thread: MobileMatchThread };
type ThreadMessage = MobileMatchThread["messages"][number];

const ROLE_LABELS: Record<AttendeeRole, string> = {
  Student: "Ogrenci",
  Clinician: "Klinisyen",
  Academic: "Akademisyen",
  Entrepreneur: "Girisimci",
  Industry: "Sektor"
};

const TEMP_MESSAGE_PREFIX = "temp-message-";

function formatMessageClock(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function ParticipantChatScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { me } = useMobileMe();
  const params = useLocalSearchParams<{ attendeeId?: string }>();
  const [draftMessage, setDraftMessage] = useState("");
  const listRef = useRef<FlatList<ThreadMessage>>(null);

  const myAttendeeId = me?.attendee?.id ?? "";
  const attendeeId = useMemo(() => {
    const raw = typeof params.attendeeId === "string" ? params.attendeeId : "";
    return raw.trim();
  }, [params.attendeeId]);

  const threadQuery = useQuery({
    queryKey: ["mobile-networking-thread", attendeeId],
    queryFn: () => fetchMatchThread(attendeeId),
    enabled: Boolean(attendeeId && me?.role === "participant" && me.attendee),
    refetchInterval: 6_000
  });

  const sendMessageMutation = useMutation({
    mutationFn: ({ text }: { text: string }) => sendMatchMessage(attendeeId, text),
    onMutate: async ({ text }) => {
      await queryClient.cancelQueries({ queryKey: ["mobile-networking-thread", attendeeId] });
      const previousThread = queryClient.getQueryData<MatchThreadQueryData>([
        "mobile-networking-thread",
        attendeeId
      ]);
      const optimisticMessageId = `${TEMP_MESSAGE_PREFIX}${Date.now()}`;

      if (previousThread && myAttendeeId) {
        const optimisticMessage: ThreadMessage = {
          id: optimisticMessageId,
          senderId: myAttendeeId,
          receiverId: attendeeId,
          text,
          createdAt: new Date().toISOString()
        };

        queryClient.setQueryData<MatchThreadQueryData>(
          ["mobile-networking-thread", attendeeId],
          {
            ...previousThread,
            thread: {
              ...previousThread.thread,
              messages: [...previousThread.thread.messages, optimisticMessage]
            }
          }
        );
      }

      setDraftMessage("");
      return { previousThread, optimisticMessageId, previousDraft: text };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousThread) {
        queryClient.setQueryData(["mobile-networking-thread", attendeeId], context.previousThread);
      }
      if (context?.previousDraft) {
        setDraftMessage(context.previousDraft);
      }
    },
    onSuccess: (result, _variables, context) => {
      queryClient.setQueryData<MatchThreadQueryData>(
        ["mobile-networking-thread", attendeeId],
        (current) => {
          if (!current) {
            return current;
          }

          const withoutOptimistic = context?.optimisticMessageId
            ? current.thread.messages.filter((message) => message.id !== context.optimisticMessageId)
            : current.thread.messages;

          return {
            ...current,
            thread: {
              ...current.thread,
              messages: [...withoutOptimistic, result.message]
            }
          };
        }
      );

      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mobile-networking-thread", attendeeId] }),
        queryClient.invalidateQueries({ queryKey: ["mobile-networking-threads"] })
      ]);
    }
  });

  const messages = threadQuery.data?.thread.messages ?? [];
  const otherAttendee = threadQuery.data?.thread.otherAttendee ?? null;
  const canSend = draftMessage.trim().length > 0 && !sendMessageMutation.isPending;

  useEffect(() => {
    if (messages.length === 0) {
      return;
    }
    const timeoutId = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 60);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [messages.length]);

  const openSocial = async (url: string | null | undefined) => {
    if (!url) {
      return;
    }
    await Linking.openURL(url);
  };

  if (me?.role === "participant" && !me.attendee) {
    return <Redirect href={"/(participant)/more" as never} />;
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#040311", "#0F062E", "#1A0B4B"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardWrap}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
        >
          <View style={styles.headerCard}>
            <View style={styles.headerTop}>
              <Pressable
                style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : null]}
                onPress={() => {
                  router.back();
                }}
              >
                <ChevronLeft color={colors.inkMuted} size={16} />
                <Text style={styles.backButtonText}>Outliers</Text>
              </Pressable>
              <Text style={styles.headerTitle}>Sohbet</Text>
            </View>

            <View style={styles.partnerRow}>
              <View style={styles.partnerBlock}>
                <Text style={styles.partnerName}>{otherAttendee?.name ?? "Eslesme"}</Text>
                <Text style={styles.partnerRole}>
                  {otherAttendee?.role
                    ? ROLE_LABELS[otherAttendee.role as AttendeeRole] ?? "Katilimci"
                    : "Katilimci"}
                </Text>
              </View>

              <View style={styles.partnerActions}>
                <Pressable
                  style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}
                  onPress={() => {
                    const instagram = otherAttendee?.instagram;
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
                    const linkedin = otherAttendee?.linkedin;
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
          </View>

          <View style={styles.threadCard}>
            {!attendeeId ? (
              <Text style={styles.infoText}>Gecerli bir eslesme secip yeniden dene.</Text>
            ) : null}

            {attendeeId && threadQuery.isLoading ? (
              <View style={styles.loaderWrap}>
                <ActivityIndicator color={colors.accent} size="small" />
                <Text style={styles.loaderText}>Mesajlar yukleniyor...</Text>
              </View>
            ) : null}

            {attendeeId && threadQuery.isError ? (
              <Text style={styles.errorText}>
                {threadQuery.error instanceof Error
                  ? threadQuery.error.message
                  : "Sohbet yuklenemedi."}
              </Text>
            ) : null}

            {attendeeId && !threadQuery.isLoading && !threadQuery.isError ? (
              <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={(item) => item.id}
                contentContainerStyle={[
                  styles.messagesContent,
                  messages.length === 0 ? styles.messagesContentEmpty : null
                ]}
                keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() => {
                  listRef.current?.scrollToEnd({ animated: messages.length > 1 });
                }}
                renderItem={({ item }) => {
                  const mine = item.senderId === myAttendeeId;
                  const isOptimistic = item.id.startsWith(TEMP_MESSAGE_PREFIX);
                  return (
                    <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                      <Text style={[styles.bubbleText, mine ? styles.bubbleTextMine : null]}>
                        {item.text}
                      </Text>
                      <Text style={[styles.bubbleMeta, mine ? styles.bubbleMetaMine : null]}>
                        {isOptimistic ? "Gonderiliyor..." : formatMessageClock(item.createdAt)}
                      </Text>
                    </View>
                  );
                }}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>
                    Henuz mesaj yok. Sohbeti sen baslat.
                  </Text>
                }
              />
            ) : null}
          </View>

          <View style={styles.composerRow}>
            <TextInput
              style={styles.composerInput}
              placeholder="Mesaj yaz..."
              placeholderTextColor={colors.inkMuted}
              value={draftMessage}
              onChangeText={(value) => setDraftMessage(value.slice(0, 500))}
              multiline
              maxLength={500}
            />
            <Pressable
              disabled={!canSend || !attendeeId}
              style={({ pressed }) => [
                styles.sendButton,
                !canSend || !attendeeId ? styles.disabled : null,
                pressed ? styles.pressed : null
              ]}
              onPress={() => {
                const text = draftMessage.trim();
                if (!text || !attendeeId) {
                  return;
                }
                sendMessageMutation.mutate({ text });
              }}
            >
              <Send color="#FFFFFF" size={15} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.background,
    flex: 1
  },
  safeArea: {
    flex: 1
  },
  keyboardWrap: {
    flex: 1,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs
  },
  headerCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(139,92,246,0.2)",
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
    padding: spacing.md
  },
  headerTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  backButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs
  },
  backButtonText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "700"
  },
  headerTitle: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 18,
    fontWeight: "700"
  },
  partnerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.sm
  },
  partnerBlock: {
    flex: 1,
    paddingRight: spacing.sm
  },
  partnerName: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 15,
    fontWeight: "800"
  },
  partnerRole: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12,
    marginTop: 2
  },
  partnerActions: {
    flexDirection: "row",
    gap: spacing.xs
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  threadCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    flex: 1,
    overflow: "hidden"
  },
  infoText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 13,
    padding: spacing.md
  },
  loaderWrap: {
    alignItems: "center",
    padding: spacing.md
  },
  loaderText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12,
    marginTop: spacing.xs
  },
  errorText: {
    color: colors.danger,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 18,
    padding: spacing.md
  },
  messagesContent: {
    gap: spacing.xs,
    padding: spacing.md
  },
  messagesContentEmpty: {
    flexGrow: 1,
    justifyContent: "center"
  },
  bubble: {
    borderRadius: radii.md,
    maxWidth: "84%",
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
  emptyText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 13,
    textAlign: "center"
  },
  composerRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.sm
  },
  composerInput: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    flex: 1,
    fontFamily: typography.body,
    fontSize: 14,
    maxHeight: 120,
    minHeight: 42,
    paddingHorizontal: spacing.sm,
    paddingTop: 10
  },
  sendButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  disabled: {
    opacity: 0.6
  },
  pressed: {
    opacity: 0.82
  }
});
