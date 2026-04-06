import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Brain, Flame, Hand, Lightbulb, CircleHelp } from "lucide-react-native";
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
      return <Flame color={color} size={18} />;
    case "idea":
      return <Lightbulb color={color} size={18} />;
    case "mind":
      return <Brain color={color} size={18} />;
    case "applause":
      return <Hand color={color} size={18} />;
    case "question":
      return <CircleHelp color={color} size={18} />;
    default:
      return <CircleHelp color={color} size={18} />;
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

      {me?.attendee ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Soru Gönder</Text>
          <TextInput
            multiline
            numberOfLines={3}
            placeholder="Sahneye iletilecek sorunu yaz..."
            placeholderTextColor={colors.inkMuted}
            style={styles.textarea}
            value={questionText}
            onChangeText={(value) => setQuestionText(value.slice(0, 200))}
          />
          <Pressable
            disabled={questionMutation.isPending || questionText.trim().length < 1}
            style={({ pressed }) => [styles.primaryButton, pressed ? styles.pressed : null, questionMutation.isPending || questionText.trim().length < 1 ? styles.disabled : null]}
            onPress={() => {
              questionMutation.mutate(questionText.trim());
            }}
          >
            <Text style={styles.primaryButtonText}>{questionMutation.isPending ? "Gönderiliyor..." : "Soruyu Gönder"}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.warningCard}>
          <Text style={styles.warningText}>Canlı etkileşim için önce profilini tamamlamalısın.</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Aktif Anket</Text>
        {liveQuery.data?.activePoll ? (
          <>
            <Text style={styles.pollQuestion}>{liveQuery.data.activePoll.question}</Text>
            {liveQuery.data.activePoll.options.map((option, index) => {
              const count = Number(liveQuery.data?.pollTotals?.[String(index)] ?? 0);
              return (
                <Pressable
                  key={`${option}-${index}`}
                  disabled={voteMutation.isPending || votedPollId === liveQuery.data?.activePoll?.id}
                  style={({ pressed }) => [styles.optionButton, pressed ? styles.pressed : null]}
                  onPress={() => {
                    if (!liveQuery.data?.activePoll) {
                      return;
                    }

                    voteMutation.mutate({ pollId: liveQuery.data.activePoll.id, optionIndex: index });
                  }}
                >
                  <Text style={styles.optionText}>{option}</Text>
                  <Text style={styles.optionCount}>{count}</Text>
                </Pressable>
              );
            })}
          </>
        ) : (
          <Text style={styles.mutedText}>Şu an aktif anket yok.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Anlık Tepkiler ({totalReactions})</Text>
        <View style={styles.reactionRow}>
          {REACTIONS.map((reaction) => (
            <Pressable
              key={reaction.code}
              disabled={reactionMutation.isPending}
              style={({ pressed }) => [styles.reactionButton, pressed ? styles.pressed : null]}
              onPress={() => {
                reactionMutation.mutate(reaction.code);
              }}
            >
              <ReactionIcon color={colors.accent} icon={reaction.icon} />
              <Text style={styles.reactionLabel}>{reaction.label}</Text>
              <Text style={styles.reactionCount}>{liveQuery.data?.reactionCounts?.[reaction.code] ?? 0}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Öne Çıkan Sorular</Text>
        {(liveQuery.data?.questions ?? []).slice(0, 8).map((item) => (
          <View key={item.id} style={styles.questionRow}>
            <Text style={styles.questionText}>{item.text}</Text>
            <Text style={styles.questionMeta}>{item.votes} oy</Text>
          </View>
        ))}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
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
    fontSize: 14,
    marginTop: spacing.sm
  },
  errorCard: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.lg,
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
    borderRadius: radii.lg,
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
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
    padding: spacing.md
  },
  cardTitle: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: spacing.sm
  },
  textarea: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 14,
    minHeight: 88,
    padding: spacing.sm,
    textAlignVertical: "top"
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    marginTop: spacing.sm,
    paddingVertical: 10
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800"
  },
  disabled: {
    opacity: 0.6
  },
  pollQuestion: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: spacing.sm
  },
  optionButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10
  },
  optionText: {
    color: colors.ink,
    flex: 1,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "700"
  },
  optionCount: {
    color: colors.accent,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800"
  },
  mutedText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 13
  },
  reactionRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  reactionButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    flex: 1,
    paddingVertical: 10
  },
  reactionLabel: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4
  },
  reactionCount: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2
  },
  questionRow: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    paddingVertical: 8
  },
  questionText: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 18
  },
  questionMeta: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12,
    marginTop: 4
  },
  pressed: {
    opacity: 0.82
  }
});
