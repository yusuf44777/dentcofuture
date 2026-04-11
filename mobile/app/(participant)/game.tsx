import { useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StatusBar, StyleSheet, Text, TextInput, View } from "react-native";
import { Redirect } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Maximize2, Minimize2, Send, Swords, Trophy } from "lucide-react-native";
import { WebView } from "react-native-webview";
import { ScreenShell } from "../../src/components/screen-shell";
import { fetchGameScores, submitGameScore } from "../../src/lib/mobile-api";
import { useMobileMe } from "../../src/hooks/use-mobile-me";
import { colors, radii, spacing, typography } from "../../src/theme/tokens";

const GAME_URL = "https://itch.io/embed-upload/15862237?color=0A1C3D";

export default function ParticipantGameScreen() {
  const queryClient = useQueryClient();
  const { me } = useMobileMe();
  const [scoreInput, setScoreInput] = useState("");
  const [waveInput, setWaveInput] = useState("1");
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  if (me?.role === "participant" && !me.attendee) {
    return <Redirect href={"/(participant)/more" as never} />;
  }

  return (
    <ScreenShell
      title="Mine Kuşatması"
      subtitle="Oyuna gir, skor gönder ve etkinlik puanını yükselt."
    >
      {/* Fullscreen Modal */}
      <Modal
        visible={isFullscreen}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setIsFullscreen(false)}
      >
        <StatusBar hidden />
        <View style={styles.fullscreenContainer}>
          <WebView
            source={{ uri: GAME_URL }}
            style={styles.fullscreenWebView}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
          />
          <Pressable
            style={({ pressed }) => [styles.exitFullscreenBtn, pressed ? styles.pressed : null]}
            onPress={() => {
              StatusBar.setHidden(false);
              setIsFullscreen(false);
            }}
          >
            <Minimize2 color="#FFFFFF" size={18} />
          </Pressable>
        </View>
      </Modal>

      {/* Game WebView Card */}
      <View style={styles.webViewCard}>
        <Pressable
          style={({ pressed }) => [styles.fullscreenBtn, pressed ? styles.pressed : null]}
          onPress={() => setIsFullscreen(true)}
        >
          <Maximize2 color={colors.copper} size={16} />
          <Text style={styles.fullscreenBtnText}>Tam Ekran</Text>
        </Pressable>

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

      {/* Score Submit */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Swords color={colors.copper} size={16} />
          <Text style={styles.cardTitle}>Skor Senkronizasyonu</Text>
        </View>
        <Text style={styles.helpText}>Oyunu oynadıktan sonra skorunu gönder. Puan ödülü otomatik eklenir.</Text>

        <View style={styles.inputRow}>
          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>SKOR</Text>
            <TextInput
              keyboardType="number-pad"
              value={scoreInput}
              onChangeText={(value) => setScoreInput(value.replace(/[^0-9]/g, ""))}
              style={styles.input}
              placeholder="0"
              placeholderTextColor={colors.inkMuted}
            />
          </View>
          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>DALGA</Text>
            <TextInput
              keyboardType="number-pad"
              value={waveInput}
              onChangeText={(value) => setWaveInput(value.replace(/[^0-9]/g, ""))}
              style={styles.input}
              placeholder="1"
              placeholderTextColor={colors.inkMuted}
            />
          </View>
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
            {submitMutation.isPending
              ? <ActivityIndicator color="#FFF" size="small" />
              : <Send color="#FFFFFF" size={15} />}
          </Pressable>
        </View>
        {submitMutation.error ? (
          <Text style={styles.errorText}>
            {submitMutation.error instanceof Error ? submitMutation.error.message : "Skor gönderilemedi."}
          </Text>
        ) : null}
      </View>

      {/* Leaderboard */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Trophy color={colors.accent} size={16} />
          <Text style={styles.cardTitle}>Liderlik Tablosu</Text>
        </View>
        {scoresQuery.isLoading ? <ActivityIndicator color={colors.accent} size="small" /> : null}
        {scoresQuery.data?.personalBest ? (
          <View style={styles.personalBest}>
            <Text style={styles.personalBestTitle}>Kişisel En İyi</Text>
            <Text style={styles.personalBestText}>
              Skor {scoresQuery.data.personalBest.score} · Dalga {scoresQuery.data.personalBest.wave}
            </Text>
          </View>
        ) : (
          <Text style={styles.helpText}>Henüz skor gönderilmedi.</Text>
        )}

        {(scoresQuery.data?.leaderboard ?? []).slice(0, 10).map((entry, index) => (
          <View key={entry.id} style={styles.rankRow}>
            <View style={styles.rankLeft}>
              <Text style={[styles.rankNumber, index < 3 ? { color: ["#C9A96E", "#A8A9AD", "#B87333"][index] } : { color: colors.inkMuted }]}>
                {index + 1}
              </Text>
              <Text style={styles.rankName}>{entry.attendee?.name ?? "Katılımcı"}</Text>
            </View>
            <View style={[styles.rankBadge, index === 0 ? styles.rankBadgeGold : null]}>
              <Text style={[styles.rankScore, index === 0 ? styles.rankScoreGold : null]}>{entry.score}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  fullscreenContainer: {
    backgroundColor: "#000",
    flex: 1
  },
  fullscreenWebView: {
    flex: 1
  },
  exitFullscreenBtn: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: radii.pill,
    borderWidth: 1,
    bottom: 40,
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    position: "absolute",
    right: 16
  },
  webViewCard: {
    backgroundColor: colors.backgroundDeep,
    borderColor: "rgba(139,92,246,0.2)",
    borderRadius: radii.lg,
    borderWidth: 1,
    height: 320,
    marginBottom: spacing.md,
    overflow: "hidden",
    position: "relative"
  },
  fullscreenBtn: {
    alignItems: "center",
    backgroundColor: "rgba(10,8,32,0.85)",
    borderBottomColor: "rgba(201,169,110,0.2)",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 10,
    borderBottomLeftRadius: radii.sm
  },
  fullscreenBtnText: {
    color: colors.copper,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "800"
  },
  webLoader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: colors.backgroundDeep,
    justifyContent: "center",
    zIndex: 5
  },
  webLoaderText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 13,
    marginTop: spacing.xs
  },
  webView: {
    flex: 1
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
  helpText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 18
  },
  inputRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.sm
  },
  inputWrap: {
    flex: 1
  },
  inputLabel: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 5
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 15,
    fontWeight: "700",
    paddingHorizontal: spacing.sm,
    paddingVertical: 11,
    textAlign: "center"
  },
  sendButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  personalBest: {
    backgroundColor: "rgba(139,92,246,0.1)",
    borderColor: "rgba(139,92,246,0.25)",
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
    padding: spacing.sm
  },
  personalBestTitle: {
    color: colors.accent,
    fontFamily: typography.body,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5
  },
  personalBestText: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 3
  },
  rankRow: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 9
  },
  rankLeft: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  rankNumber: {
    fontFamily: typography.display,
    fontSize: 13,
    fontWeight: "800",
    width: 20
  },
  rankName: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "700"
  },
  rankBadge: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 3
  },
  rankBadgeGold: {
    backgroundColor: "rgba(201,169,110,0.15)",
    borderColor: "rgba(201,169,110,0.3)",
    borderWidth: 1
  },
  rankScore: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "800"
  },
  rankScoreGold: {
    color: colors.copper
  },
  errorText: {
    color: colors.danger,
    fontFamily: typography.body,
    fontSize: 12,
    marginTop: spacing.xs
  },
  disabled: {
    opacity: 0.5
  },
  pressed: {
    opacity: 0.8
  }
});
