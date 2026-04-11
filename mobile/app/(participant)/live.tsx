import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Redirect } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Brain, Flame, Hand, Lightbulb, CircleHelp, Send } from "lucide-react-native";
import { ScreenShell } from "../../src/components/screen-shell";
import { fetchLiveState, sendLiveReaction, submitLiveQuestion, voteLivePoll } from "../../src/lib/mobile-api";
import { useMobileMe } from "../../src/hooks/use-mobile-me";
import { colors, radii, spacing, typography } from "../../src/theme/tokens";

const REACTIONS: Array<{
  code: "🔥" | "💡" | "🤯" | "👏" | "❓";
  label: string;
  icon: "flame" | "idea" | "mind" | "applause" | "question";
}> = [
  { code: "🔥", label: "Enerji", icon: "flame" },
  { code: "💡", label: "Fikir", icon: "idea" },
  { code: "🤯", label: "Vay", icon: "mind" },
  { code: "👏", label: "Alkış", icon: "applause" },
  { code: "❓", label: "Soru", icon: "question" }
];

function ReactionIcon({
  icon,
  color
}: {
  icon: "flame" | "idea" | "mind" | "applause" | "question";
  color: string;
}) {
  switch (icon) {
    case "flame":
      return <Flame color={color} size={20} />;
    case "idea":
      return <Lightbulb color={color} size={20} />;
    case "mind":
      return <Brain color={color} size={20} />;
    case "applause":
      return <Hand color={color} size={20} />;
    case "question":
      return <CircleHelp color={color} size={20} />;
    default:
      return <CircleHelp color={color} size={20} />;
  }
}

export default function ParticipantLiveScreen() {
  const queryClient = useQueryClient();
  const { me } = useMobileMe();
  const [questionText, setQuestionText] = useState("");
  const [votedPollId, setVotedPollId] = useState<string | null>(null);

  const liveQuery = useQuery({
    queryKey: ["mobile-live-state"],
    queryFn: fetchLiveState,
    enabled: Boolean(me && me.role === "participant"),
    refetchInterval: 5_000
  });

  const questionMutation = useMutation({
    mutationFn: submitLiveQuestion,
    onSuccess: async () => {
      setQuestionText("");
      await queryClient.invalidateQueries({ queryKey: ["mobile-live-state"] });
    }
  });

  const voteMutation = useMutation({
    mutationFn: ({ pollId, optionIndex }: { pollId: string; optionIndex: number }) =>
      voteLivePoll(pollId, optionIndex),
    onSuccess: async (_, variables) => {
      setVotedPollId(variables.pollId);
      await queryClient.invalidateQueries({ queryKey: ["mobile-live-state"] });
    }
  });

  const reactionMutation = useMutation({
    mutationFn: sendLiveReaction,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["mobile-live-state"] });
    }
  });

  const totalReactions = useMemo(
    () => Object.values(liveQuery.data?.reactionCounts ?? {}).reduce((sum, count) => sum + count, 0),
    [liveQuery.data?.reactionCounts]
  );

  if (me?.role === "participant" && !me.attendee) {
    return <Redirect href={"/(participant)/more" as never} />;
  }

  return (
    <ScreenShell
      title="Canlı Merkez"
      subtitle="Soru sor, anketlere katıl ve sahnedeki akışa anlık tepki ver."
    >
      {liveQuery.isLoading ? (
        <View style={styles.loaderCard}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loaderText}>Canlı veriler yükleniyor...</Text>
        </View>
      ) : null}

      {liveQuery.isError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{liveQuery.error instanceof Error ? liveQuery.error.message : "Canlı veri alınamadı."}</Text>
        </View>
      ) : null}

      {/* Question Submit */}
      {me?.attendee ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveBadgeText}>CANLI</Text>
            </View>
            <Text style={styles.cardTitle}>Soru Gönder</Text>
          </View>
          <TextInput
            multiline
            numberOfLines={3}
            placeholder="Sahneye iletilecek sorunu yaz..."
            placeholderTextColor={colors.inkMuted}
            style={styles.textarea}
            value={questionText}
            onChangeText={(value) => setQuestionText(value.slice(0, 200))}
          />
          <View style={styles.questionFooter}>
            <Text style={styles.charCount}>{questionText.length}/200</Text>
            <Pressable
              disabled={questionMutation.isPending || questionText.trim().length < 1}
              style={({ pressed }) => [
                styles.sendButton,
                pressed ? styles.pressed : null,
                questionMutation.isPending || questionText.trim().length < 1 ? styles.disabled : null
              ]}
              onPress={() => questionMutation.mutate(questionText.trim())}
            >
              {questionMutation.isPending
                ? <ActivityIndicator color="#FFF" size="small" />
                : <>
                    <Send color="#FFF" size={13} />
                    <Text style={styles.sendButtonText}>Gönder</Text>
                  </>}
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.warningCard}>
          <Text style={styles.warningText}>Canlı etkileşim için önce profilini tamamlamalısın.</Text>
        </View>
      )}

      {/* Active Poll */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Aktif Anket</Text>
        </View>
        {liveQuery.data?.activePoll ? (
          <>
            <Text style={styles.pollQuestion}>{liveQuery.data.activePoll.question}</Text>
            {liveQuery.data.activePoll.options.map((option, index) => {
              const count = Number(liveQuery.data?.pollTotals?.[String(index)] ?? 0);
              const isVoted = votedPollId === liveQuery.data?.activePoll?.id;
              return (
                <Pressable
                  key={`${option}-${index}`}
                  disabled={voteMutation.isPending || isVoted}
                  style={({ pressed }) => [
                    styles.optionButton,
                    isVoted ? styles.optionButtonVoted : null,
                    pressed ? styles.pressed : null
                  ]}
                  onPress={() => {
                    if (!liveQuery.data?.activePoll) return;
                    voteMutation.mutate({ pollId: liveQuery.data.activePoll.id, optionIndex: index });
                  }}
                >
                  <Text style={[styles.optionText, isVoted ? styles.optionTextVoted : null]}>{option}</Text>
                  <View style={styles.optionCountBadge}>
                    <Text style={styles.optionCount}>{count}</Text>
                  </View>
                </Pressable>
              );
            })}
          </>
        ) : (
          <Text style={styles.mutedText}>Şu an aktif anket yok.</Text>
        )}
      </View>

      {/* Reactions */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Tepkiler</Text>
          <View style={styles.totalBadge}>
            <Text style={styles.totalBadgeText}>{totalReactions}</Text>
          </View>
        </View>
        <View style={styles.reactionRow}>
          {REACTIONS.map((reaction) => {
            const count = liveQuery.data?.reactionCounts?.[reaction.code] ?? 0;
            return (
              <Pressable
                key={reaction.code}
                disabled={reactionMutation.isPending}
                style={({ pressed }) => [
                  styles.reactionButton,
                  pressed ? styles.reactionButtonPressed : null
                ]}
                onPress={() => reactionMutation.mutate(reaction.code)}
              >
                <ReactionIcon color={colors.accent} icon={reaction.icon} />
                <Text style={styles.reactionCount}>{count}</Text>
                <Text style={styles.reactionLabel}>{reaction.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Featured Questions */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Öne Çıkan Sorular</Text>
        </View>
        {(liveQuery.data?.questions ?? []).length === 0 ? (
          <Text style={styles.mutedText}>Henüz soru gönderilmedi.</Text>
        ) : null}
        {(liveQuery.data?.questions ?? []).slice(0, 8).map((item) => (
          <View key={item.id} style={styles.questionRow}>
            <Text style={styles.questionText}>{item.text}</Text>
            <View style={styles.questionMeta}>
              <Text style={styles.questionMetaText}>{item.votes} oy</Text>
            </View>
          </View>
        ))}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  loaderCard: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: radii.lg,
    marginBottom: spacing.md,
    padding: spacing.lg
  },
  loaderText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 14,
    marginTop: spacing.sm
  },
  errorCard: {
    backgroundColor: colors.dangerSoft,
    borderColor: "rgba(248,113,113,0.3)",
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md
  },
  errorText: {
    color: colors.danger,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 19
  },
  warningCard: {
    backgroundColor: colors.warningSoft,
    borderColor: "rgba(245,158,11,0.25)",
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md
  },
  warningText: {
    color: colors.warning,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 19
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(139,92,246,0.15)",
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.sm
  },
  cardTitle: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 17,
    fontWeight: "700"
  },
  liveBadge: {
    alignItems: "center",
    backgroundColor: "rgba(248,113,113,0.15)",
    borderColor: "rgba(248,113,113,0.3)",
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  liveDot: {
    backgroundColor: colors.danger,
    borderRadius: 999,
    height: 6,
    width: 6
  },
  liveBadgeText: {
    color: colors.danger,
    fontFamily: typography.body,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8
  },
  textarea: {
    backgroundColor: colors.surfaceMuted,
    borderColor: "rgba(139,92,246,0.3)",
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 88,
    padding: spacing.sm,
    textAlignVertical: "top"
  },
  questionFooter: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs
  },
  charCount: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 11
  },
  sendButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 9
  },
  sendButtonText: {
    color: "#FFF",
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800"
  },
  pollQuestion: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21,
    marginBottom: spacing.sm
  },
  optionButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.line,
    borderLeftWidth: 0,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 11
  },
  optionButtonVoted: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
    borderLeftColor: colors.accent,
    borderLeftWidth: 3
  },
  optionText: {
    color: colors.ink,
    flex: 1,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "700"
  },
  optionTextVoted: {
    color: colors.accent
  },
  optionCountBadge: {
    backgroundColor: "rgba(139,92,246,0.15)",
    borderRadius: radii.pill,
    minWidth: 28,
    paddingHorizontal: 8,
    paddingVertical: 2
  },
  optionCount: {
    color: colors.accent,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center"
  },
  mutedText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 13
  },
  totalBadge: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 2
  },
  totalBadgeText: {
    color: colors.accent,
    fontFamily: typography.body,
    fontSize: 11,
    fontWeight: "800"
  },
  reactionRow: {
    flexDirection: "row",
    gap: spacing.xs
  },
  reactionButton: {
    alignItems: "center",
    backgroundColor: "rgba(139,92,246,0.08)",
    borderColor: "rgba(139,92,246,0.2)",
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12
  },
  reactionButtonPressed: {
    backgroundColor: "rgba(139,92,246,0.2)",
    borderColor: colors.accent
  },
  reactionCount: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 5
  },
  reactionLabel: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2
  },
  questionRow: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    paddingVertical: 10
  },
  questionText: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 19
  },
  questionMeta: {
    marginTop: 4
  },
  questionMetaText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 11,
    fontWeight: "700"
  },
  disabled: {
    opacity: 0.5
  },
  pressed: {
    opacity: 0.8
  }
});
