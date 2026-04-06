import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Redirect } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pin, CheckCircle2, Radio, Send, CircleStop } from "lucide-react-native";
import { ScreenShell } from "../../src/components/screen-shell";
import {
  closeStaffPoll,
  fetchStaffPolls,
  fetchStaffQuestions,
  publishStaffPoll,
  updateStaffQuestion
} from "../../src/lib/mobile-api";
import { useMobileMe } from "../../src/hooks/use-mobile-me";
import { colors, radii, spacing, typography } from "../../src/theme/tokens";

type StaffPoll = {
  id: string;
  question: string;
  options: string[];
  active: boolean;
  created_at: string;
};

type StaffQuestion = {
  id: string;
  text: string;
  votes: number;
  pinned: boolean;
  answered: boolean;
  attendee?: {
    name?: string;
    role?: string;
  } | null;
};

export default function StaffLiveOpsScreen() {
  const queryClient = useQueryClient();
  const { me, query } = useMobileMe();
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptionsRaw, setPollOptionsRaw] = useState("");

  const pollsQuery = useQuery({
    queryKey: ["mobile-staff-polls"],
    queryFn: fetchStaffPolls,
    enabled: Boolean(me?.role === "staff"),
    refetchInterval: 10_000
  });

  const questionsQuery = useQuery({
    queryKey: ["mobile-staff-questions"],
    queryFn: fetchStaffQuestions,
    enabled: Boolean(me?.role === "staff"),
    refetchInterval: 10_000
  });

  const publishMutation = useMutation({
    mutationFn: ({ question, options }: { question: string; options: string[] }) =>
      publishStaffPoll(question, options),
    onSuccess: async () => {
      setPollQuestion("");
      setPollOptionsRaw("");
      await queryClient.invalidateQueries({ queryKey: ["mobile-staff-polls"] });
    }
  });

  const closeMutation = useMutation({
    mutationFn: (pollId?: string) => closeStaffPoll(pollId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["mobile-staff-polls"] });
    }
  });

  const updateQuestionMutation = useMutation({
    mutationFn: ({
      questionId,
      pinned,
      answered
    }: {
      questionId: string;
      pinned?: boolean;
      answered?: boolean;
    }) => updateStaffQuestion(questionId, { pinned, answered }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["mobile-staff-questions"] });
    }
  });

  const parsedOptions = useMemo(() => {
    return pollOptionsRaw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 10);
  }, [pollOptionsRaw]);

  const activePoll = (pollsQuery.data?.activePoll ?? null) as StaffPoll | null;
  const recentPolls = (pollsQuery.data?.polls ?? []) as StaffPoll[];
  const questions = (questionsQuery.data?.questions ?? []) as StaffQuestion[];

  if (query.isLoading || !me) {
    return (
      <ScreenShell title="Canlı Operasyon" subtitle="Yetkiler kontrol ediliyor.">
        <ActivityIndicator color={colors.accent} size="large" />
      </ScreenShell>
    );
  }

  if (me.role !== "staff") {
    return <Redirect href={"/(participant)" as never} />;
  }

  return (
    <ScreenShell
      title="Canlı Operasyon"
      subtitle="Anketleri yönet, soruları sabitle ve cevap durumunu güncelle."
    >
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Radio color={colors.accent} size={16} />
          <Text style={styles.cardTitle}>Yeni Anket Yayınla</Text>
        </View>
        <TextInput
          style={styles.input}
          value={pollQuestion}
          onChangeText={(value) => setPollQuestion(value.slice(0, 200))}
          placeholder="Anket sorusu"
          placeholderTextColor="#8D9895"
        />
        <TextInput
          multiline
          numberOfLines={4}
          style={[styles.input, styles.optionsInput]}
          value={pollOptionsRaw}
          onChangeText={setPollOptionsRaw}
          placeholder={"Seçenekleri satır satır yaz\nSeçenek 1\nSeçenek 2"}
          placeholderTextColor="#8D9895"
        />
        <Text style={styles.helpText}>Seçenek sayısı: {parsedOptions.length}</Text>
        <Pressable
          disabled={publishMutation.isPending || pollQuestion.trim().length < 6 || parsedOptions.length < 2}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed ? styles.pressed : null,
            publishMutation.isPending || pollQuestion.trim().length < 6 || parsedOptions.length < 2
              ? styles.disabled
              : null
          ]}
          onPress={() => {
            publishMutation.mutate({
              question: pollQuestion.trim(),
              options: parsedOptions
            });
          }}
        >
          {publishMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Send color="#FFFFFF" size={14} />
              <Text style={styles.primaryButtonText}>Yayınla</Text>
            </>
          )}
        </Pressable>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <CircleStop color={colors.copper} size={16} />
          <Text style={styles.cardTitle}>Aktif Anket</Text>
        </View>
        {activePoll ? (
          <>
            <Text style={styles.pollQuestion}>{activePoll.question}</Text>
            {activePoll.options.map((option, index) => (
              <Text key={`${option}-${index}`} style={styles.pollOption}>• {option}</Text>
            ))}
            <Pressable
              disabled={closeMutation.isPending}
              style={({ pressed }) => [styles.secondaryButton, pressed ? styles.pressed : null]}
              onPress={() => {
                closeMutation.mutate(activePoll.id);
              }}
            >
              <Text style={styles.secondaryButtonText}>Anketi Kapat</Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.helpText}>Şu an aktif anket bulunmuyor.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Canlı Sorular ({questions.length})</Text>
        {questions.slice(0, 30).map((questionItem) => (
          <View key={questionItem.id} style={styles.questionRow}>
            <Text style={styles.questionText}>{questionItem.text}</Text>
            <Text style={styles.questionMeta}>
              {questionItem.attendee?.name ?? "Katılımcı"} • {questionItem.votes} oy
            </Text>
            <View style={styles.questionActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.actionChip,
                  questionItem.pinned ? styles.actionChipActive : null,
                  pressed ? styles.pressed : null
                ]}
                onPress={() => {
                  updateQuestionMutation.mutate({
                    questionId: questionItem.id,
                    pinned: !questionItem.pinned
                  });
                }}
              >
                <Pin color={questionItem.pinned ? "#FFFFFF" : colors.inkMuted} size={14} />
                <Text style={[styles.actionChipText, questionItem.pinned ? styles.actionChipTextActive : null]}>
                  Sabitle
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.actionChip,
                  questionItem.answered ? styles.actionChipActive : null,
                  pressed ? styles.pressed : null
                ]}
                onPress={() => {
                  updateQuestionMutation.mutate({
                    questionId: questionItem.id,
                    answered: !questionItem.answered
                  });
                }}
              >
                <CheckCircle2 color={questionItem.answered ? "#FFFFFF" : colors.inkMuted} size={14} />
                <Text style={[styles.actionChipText, questionItem.answered ? styles.actionChipTextActive : null]}>
                  Cevaplandı
                </Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Son Anketler</Text>
        {recentPolls.slice(0, 8).map((poll) => (
          <View key={poll.id} style={styles.recentPollRow}>
            <Text style={styles.recentPollText}>{poll.question}</Text>
            <Text style={styles.recentPollMeta}>
              {poll.active ? "Aktif" : "Pasif"} • {new Date(poll.created_at).toLocaleDateString("tr-TR")}
            </Text>
          </View>
        ))}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
    padding: spacing.md
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: spacing.sm
  },
  cardTitle: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 18,
    fontWeight: "700",
    marginLeft: spacing.xs
  },
  input: {
    backgroundColor: colors.surfaceMuted,
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
  optionsInput: {
    minHeight: 90,
    textAlignVertical: "top"
  },
  helpText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    flexDirection: "row",
    justifyContent: "center",
    marginTop: spacing.sm,
    minHeight: 42
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800",
    marginLeft: spacing.xs
  },
  secondaryButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.copperSoft,
    borderRadius: radii.pill,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10
  },
  secondaryButtonText: {
    color: colors.copper,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800"
  },
  pollQuestion: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: spacing.xs
  },
  pollOption: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 13,
    marginBottom: 4
  },
  questionRow: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    paddingVertical: spacing.sm
  },
  questionText: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 19
  },
  questionMeta: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12,
    marginTop: 3
  },
  questionActions: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.xs
  },
  actionChip: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    flexDirection: "row",
    paddingHorizontal: 11,
    paddingVertical: 7
  },
  actionChipActive: {
    backgroundColor: colors.accent
  },
  actionChipText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 6
  },
  actionChipTextActive: {
    color: "#FFFFFF"
  },
  recentPollRow: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    paddingVertical: spacing.sm
  },
  recentPollText: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "700"
  },
  recentPollMeta: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12,
    marginTop: 2
  },
  disabled: {
    opacity: 0.6
  },
  pressed: {
    opacity: 0.82
  }
});
