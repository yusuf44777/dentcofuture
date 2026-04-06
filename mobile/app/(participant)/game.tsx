import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trophy, Send, Swords } from "lucide-react-native";
import { WebView } from "react-native-webview";
import { ScreenShell } from "../../src/components/screen-shell";
import { fetchGameScores, submitGameScore } from "../../src/lib/mobile-api";
import { useMobileMe } from "../../src/hooks/use-mobile-me";
import { colors, radii, spacing, typography } from "../../src/theme/tokens";

const GAME_URL = "https://itch.io/embed-upload/15862237?color=333333";

export default function ParticipantGameScreen() {
  const queryClient = useQueryClient();
  const { me } = useMobileMe();
  const [scoreInput, setScoreInput] = useState("");
  const [waveInput, setWaveInput] = useState("1");
  const [webViewLoading, setWebViewLoading] = useState(true);

  const scoresQuery = useQuery({
    queryKey: ["mobile-game-scores"],
    queryFn: fetchGameScores,
    enabled: Boolean(me && me.role === "participant"),
    refetchInterval: 20_000
  });

  const submitMutation = useMutation({
    mutationFn: ({ score, wave }: { score: number; wave: number }) => submitGameScore(score, wave),
    onSuccess: async () => {
      setScoreInput("");
      setWaveInput("1");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mobile-game-scores"] }),
        queryClient.invalidateQueries({ queryKey: ["mobile-leaderboard"] })
      ]);
    }
  });

  const canSubmit = useMemo(() => {
    const score = Number(scoreInput);
    const wave = Number(waveInput);
    return Number.isInteger(score) && score >= 0 && Number.isInteger(wave) && wave > 0;
  }, [scoreInput, waveInput]);

  return (
    <ScreenShell
      title="Mine Kuşatması"
      subtitle="Oyuna gir, skor gönder ve etkinlik puanını yükselt."
    >
      <View style={styles.webViewCard}>
        {webViewLoading ? (
          <View style={styles.webLoader}>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={styles.webLoaderText}>Oyun yükleniyor...</Text>
          </View>
        ) : null}
        <WebView
          source={{ uri: GAME_URL }}
          style={styles.webView}
          onLoadEnd={() => setWebViewLoading(false)}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
        />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Swords color={colors.copper} size={18} />
          <Text style={styles.cardTitle}>Skor Senkronizasyonu</Text>
        </View>
        <Text style={styles.helpText}>Oyunu oynadıktan sonra skorunu gönder. Puan ödülü otomatik eklenir.</Text>

        <View style={styles.inputRow}>
          <TextInput
            keyboardType="number-pad"
            value={scoreInput}
            onChangeText={(value) => setScoreInput(value.replace(/[^0-9]/g, ""))}
            style={styles.input}
            placeholder="Skor"
            placeholderTextColor="#8D9895"
          />
          <TextInput
            keyboardType="number-pad"
            value={waveInput}
            onChangeText={(value) => setWaveInput(value.replace(/[^0-9]/g, ""))}
            style={styles.input}
            placeholder="Dalga"
            placeholderTextColor="#8D9895"
          />
          <Pressable
            disabled={!canSubmit || submitMutation.isPending}
            style={({ pressed }) => [
              styles.sendButton,
              pressed ? styles.pressed : null,
              !canSubmit || submitMutation.isPending ? styles.disabled : null
            ]}
            onPress={() => {
              submitMutation.mutate({
                score: Number(scoreInput),
                wave: Number(waveInput)
              });
            }}
          >
            <Send color="#FFFFFF" size={14} />
          </Pressable>
        </View>
        {submitMutation.error ? (
          <Text style={styles.errorText}>
            {submitMutation.error instanceof Error ? submitMutation.error.message : "Skor gönderilemedi."}
          </Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Trophy color={colors.accent} size={18} />
          <Text style={styles.cardTitle}>Liderlik Tablosu</Text>
        </View>
        {scoresQuery.isLoading ? <ActivityIndicator color={colors.accent} size="small" /> : null}
        {scoresQuery.data?.personalBest ? (
          <View style={styles.personalBest}>
            <Text style={styles.personalBestTitle}>Kişisel En İyi</Text>
            <Text style={styles.personalBestText}>
              Skor {scoresQuery.data.personalBest.score} • Dalga {scoresQuery.data.personalBest.wave}
            </Text>
          </View>
        ) : (
          <Text style={styles.helpText}>Henüz skor gönderilmedi.</Text>
        )}

        {(scoresQuery.data?.leaderboard ?? []).slice(0, 10).map((entry, index) => (
          <View key={entry.id} style={styles.rankRow}>
            <Text style={styles.rankName}>{index + 1}. {entry.attendee?.name ?? "Katılımcı"}</Text>
            <Text style={styles.rankScore}>{entry.score}</Text>
          </View>
        ))}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  webViewCard: {
    backgroundColor: "#333333",
    borderRadius: radii.lg,
    height: 260,
    marginBottom: spacing.md,
    overflow: "hidden"
  },
  webLoader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "#333333",
    justifyContent: "center",
    zIndex: 10
  },
  webLoaderText: {
    color: "#FFFFFF",
    fontFamily: typography.body,
    fontSize: 13,
    marginTop: spacing.xs
  },
  webView: {
    flex: 1
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
    marginBottom: spacing.sm
  },
  cardTitle: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 18,
    fontWeight: "700",
    marginLeft: spacing.xs
  },
  helpText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 18
  },
  inputRow: {
    alignItems: "center",
    flexDirection: "row",
    marginTop: spacing.sm
  },
  input: {
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
  personalBest: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.sm
  },
  personalBestTitle: {
    color: colors.accent,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "800"
  },
  personalBestText: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2
  },
  rankRow: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8
  },
  rankName: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "700"
  },
  rankScore: {
    color: colors.copper,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800"
  },
  errorText: {
    color: colors.danger,
    fontFamily: typography.body,
    fontSize: 12,
    marginTop: spacing.xs
  },
  disabled: {
    opacity: 0.6
  },
  pressed: {
    opacity: 0.82
  }
});
