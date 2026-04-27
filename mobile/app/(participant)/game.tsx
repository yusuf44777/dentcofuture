import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Redirect, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Maximize2, Minimize2, RefreshCw, Trophy } from "lucide-react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import {
  BLOCKERINO_SCORE_BRIDGE_SCRIPT,
  BLOCKERINO_VIEWPORT_SCRIPT
} from "../../src/game/blockerino-web-scripts";
import { useBlockerinoHtml } from "../../src/game/use-blockerino-html";
import { useMobileMe } from "../../src/hooks/use-mobile-me";
import { fetchGameScores, submitGameScore } from "../../src/lib/mobile-api";
import { colors, radii, spacing, typography } from "../../src/theme/tokens";

const RANK_COLORS = ["#C9A96E", "#A8A9AD", "#B87333"];
const SCORE_SETTLE_DELAY_MS = 3500;

type BlockerinoScoreMessage = {
  type?: string;
  score?: number;
  mode?: string;
};

function modeToWave(mode: string) {
  return mode === "chaos" ? 2 : 1;
}

function waveLabel(wave: number) {
  if (wave === 2) return "Kaos";
  if (wave === 1) return "Klasik";
  return `Seviye ${wave}`;
}

export default function ParticipantGameScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { me } = useMobileMe();
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [showScores, setShowScores] = useState(false);
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [webViewError, setWebViewError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const { html, loading: htmlLoading, error: htmlError } = useBlockerinoHtml(reloadKey);
  const submittedBestRef = useRef<Record<string, number>>({});
  const pendingScoreRef = useRef<{ score: number; mode: string } | null>(null);
  const submitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loading = htmlLoading || webViewLoading;
  const hasError = Boolean(htmlError) || webViewError;

  const scoresQuery = useQuery({
    queryKey: ["mobile-game-scores"],
    queryFn: fetchGameScores,
    enabled: Boolean(me && me.role === "participant"),
    refetchInterval: 20_000
  });

  const submitMutation = useMutation({
    mutationFn: ({ score, wave }: { score: number; wave: number }) => submitGameScore(score, wave),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mobile-game-scores"] }),
        queryClient.invalidateQueries({ queryKey: ["mobile-leaderboard"] })
      ]);
    }
  });

  useEffect(() => {
    return () => {
      if (submitTimerRef.current) clearTimeout(submitTimerRef.current);
    };
  }, []);

  if (me?.role === "participant" && !me.attendee) {
    return <Redirect href={"/(participant)/more" as never} />;
  }

  function reloadGame() {
    setWebViewError(false);
    setWebViewLoading(true);
    setReloadKey((current) => current + 1);
  }

  function queueScoreSubmit(score: number, mode: string) {
    const normalizedMode = mode === "chaos" ? "chaos" : "classic";
    const submittedBest = submittedBestRef.current[normalizedMode] ?? 0;
    if (score <= submittedBest) return;

    pendingScoreRef.current = { score, mode: normalizedMode };
    if (submitTimerRef.current) clearTimeout(submitTimerRef.current);

    submitTimerRef.current = setTimeout(() => {
      const pending = pendingScoreRef.current;
      if (!pending) return;

      const bestForMode = submittedBestRef.current[pending.mode] ?? 0;
      if (pending.score <= bestForMode) return;

      submittedBestRef.current[pending.mode] = pending.score;
      submitMutation.mutate({
        score: pending.score,
        wave: modeToWave(pending.mode)
      });
    }, SCORE_SETTLE_DELAY_MS);
  }

  function handleGameMessage(event: WebViewMessageEvent) {
    try {
      const payload = JSON.parse(event.nativeEvent.data) as BlockerinoScoreMessage;
      if (payload.type !== "BLOCKERINO_SCORE") return;

      const score = Number(payload.score);
      if (!Number.isFinite(score) || score <= 0) return;

      queueScoreSubmit(Math.floor(score), payload.mode ?? "classic");
    } catch {
      return;
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar hidden={isFullscreen} style="light" />
      <View style={styles.stage}>
        {loading && !hasError ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={styles.loadingText}>Blockerino hazırlanıyor...</Text>
          </View>
        ) : null}

        {hasError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Oyun yüklenemedi</Text>
            <Text style={styles.errorText}>Uygulama içindeki Blockerino dosyası açılamadı.</Text>
            <Pressable onPress={reloadGame} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
              <Text style={styles.retryText}>Tekrar Dene</Text>
            </Pressable>
          </View>
        ) : (
          html ? (
            <WebView
              key={reloadKey}
              source={{ html, baseUrl: "https://blockerino.local/" }}
              originWhitelist={["*"]}
              style={styles.webView}
              injectedJavaScriptBeforeContentLoaded={BLOCKERINO_VIEWPORT_SCRIPT}
              injectedJavaScript={BLOCKERINO_SCORE_BRIDGE_SCRIPT}
              onMessage={handleGameMessage}
              allowsFullscreenVideo
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
              domStorageEnabled
              scrollEnabled={false}
              bounces={false}
              onLoadStart={() => {
                setWebViewLoading(true);
                setWebViewError(false);
              }}
              onLoadEnd={() => setWebViewLoading(false)}
              onError={() => {
                setWebViewLoading(false);
                setWebViewError(true);
              }}
              onHttpError={() => {
                setWebViewLoading(false);
                setWebViewError(true);
              }}
            />
          ) : null
        )}

        <View style={[styles.topOverlay, { paddingTop: Math.max(insets.top, spacing.xs) }]}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            hitSlop={8}
          >
            <ArrowLeft color="#FFFFFF" size={20} />
          </Pressable>

          {!isFullscreen ? (
            <View style={styles.titlePill}>
              <Text style={styles.title}>Blockerino</Text>
              <Text style={styles.subtitle}>Skor otomatik kaydedilir</Text>
            </View>
          ) : (
            <View style={styles.overlaySpacer} />
          )}

          <Pressable
            onPress={() => setShowScores((current) => !current)}
            style={({ pressed }) => [
              styles.iconButton,
              showScores ? styles.iconButtonActive : null,
              pressed && styles.pressed
            ]}
          >
            <Trophy color="#FFFFFF" size={18} />
          </Pressable>
          <Pressable onPress={reloadGame} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <RefreshCw color="#FFFFFF" size={18} />
          </Pressable>
          <Pressable
            onPress={() => setIsFullscreen((current) => !current)}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            {isFullscreen ? <Minimize2 color="#FFFFFF" size={18} /> : <Maximize2 color="#FFFFFF" size={18} />}
          </Pressable>
        </View>

        {showScores ? (
          <View style={[styles.scorePanel, { bottom: Math.max(insets.bottom + spacing.sm, spacing.md) }]}>
            <View style={styles.scoreHeader}>
              <View style={styles.scoreTitleRow}>
                <Trophy color={colors.accent} size={16} />
                <Text style={styles.scoreTitle}>Liderlik</Text>
              </View>
              {scoresQuery.isLoading ? <ActivityIndicator color={colors.accent} size="small" /> : null}
            </View>

            {scoresQuery.data?.personalBest ? (
              <View style={styles.personalBest}>
                <Text style={styles.personalBestTitle}>Kişisel En İyi</Text>
                <Text style={styles.personalBestText}>
                  Skor {scoresQuery.data.personalBest.score} · {waveLabel(scoresQuery.data.personalBest.wave)}
                </Text>
              </View>
            ) : (
              <Text style={styles.helpText}>Henüz skor gönderilmedi.</Text>
            )}

            <ScrollView showsVerticalScrollIndicator={false}>
              {(scoresQuery.data?.leaderboard ?? []).slice(0, 10).map((entry, index) => (
                <View key={entry.id} style={styles.rankRow}>
                  <View style={styles.rankLeft}>
                    <Text
                      style={[
                        styles.rankNumber,
                        index < 3 ? { color: RANK_COLORS[index] } : { color: colors.inkMuted }
                      ]}
                    >
                      {index + 1}
                    </Text>
                    <View style={styles.rankCopy}>
                      <Text style={styles.rankName}>{entry.attendee?.name ?? "Katılımcı"}</Text>
                      <Text style={styles.rankMode}>{waveLabel(entry.wave)}</Text>
                    </View>
                  </View>
                  <View style={[styles.rankBadge, index === 0 ? styles.rankBadgeGold : null]}>
                    <Text style={[styles.rankScore, index === 0 ? styles.rankScoreGold : null]}>{entry.score}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: "#000000",
    flex: 1
  },
  stage: {
    backgroundColor: "#000000",
    flex: 1,
    position: "relative"
  },
  webView: {
    backgroundColor: "#000000",
    flex: 1
  },
  topOverlay: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    left: spacing.xs,
    position: "absolute",
    right: spacing.xs,
    top: 0,
    zIndex: 20
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: "rgba(4,3,16,0.78)",
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  iconButtonActive: {
    backgroundColor: colors.accent,
    borderColor: "rgba(255,255,255,0.32)"
  },
  titlePill: {
    backgroundColor: "rgba(4,3,16,0.78)",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: radii.pill,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: spacing.md
  },
  title: {
    color: "#FFFFFF",
    fontFamily: typography.display,
    fontSize: 15,
    fontWeight: "800"
  },
  subtitle: {
    color: "rgba(255,255,255,0.68)",
    fontFamily: typography.body,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 1
  },
  overlaySpacer: {
    flex: 1
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: colors.backgroundDeep,
    justifyContent: "center",
    zIndex: 10
  },
  loadingText: {
    color: "#FFFFFF",
    fontFamily: typography.body,
    fontSize: 14,
    fontWeight: "700",
    marginTop: spacing.sm
  },
  errorContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl
  },
  errorTitle: {
    color: "#FFFFFF",
    fontFamily: typography.display,
    fontSize: 20,
    fontWeight: "800"
  },
  errorText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.sm,
    textAlign: "center"
  },
  retryButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12
  },
  retryText: {
    color: "#FFFFFF",
    fontFamily: typography.body,
    fontSize: 14,
    fontWeight: "800"
  },
  scorePanel: {
    backgroundColor: "rgba(4,3,16,0.88)",
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: radii.lg,
    borderWidth: 1,
    left: spacing.sm,
    maxHeight: "48%",
    overflow: "hidden",
    padding: spacing.md,
    position: "absolute",
    right: spacing.sm,
    zIndex: 18
  },
  scoreHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm
  },
  scoreTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs
  },
  scoreTitle: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 16,
    fontWeight: "800"
  },
  personalBest: {
    backgroundColor: colors.accentSoft,
    borderColor: "rgba(139,92,246,0.25)",
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
    padding: spacing.sm
  },
  personalBestTitle: {
    color: colors.accent,
    fontFamily: typography.body,
    fontSize: 11,
    fontWeight: "900"
  },
  personalBestText: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 17,
    fontWeight: "800",
    marginTop: 2
  },
  helpText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: spacing.sm
  },
  rankRow: {
    alignItems: "center",
    borderBottomColor: "rgba(255,255,255,0.06)",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 48,
    paddingVertical: 9
  },
  rankLeft: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row"
  },
  rankNumber: {
    fontFamily: typography.display,
    fontSize: 15,
    fontWeight: "900",
    marginRight: spacing.sm,
    width: 24
  },
  rankCopy: {
    flex: 1
  },
  rankName: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800"
  },
  rankMode: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2
  },
  rankBadge: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    minWidth: 64,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6
  },
  rankBadgeGold: {
    backgroundColor: colors.copperSoft
  },
  rankScore: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center"
  },
  rankScoreGold: {
    color: colors.copper
  },
  pressed: {
    opacity: 0.72
  }
});
