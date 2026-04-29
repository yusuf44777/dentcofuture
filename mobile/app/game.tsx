import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { ArrowLeft, Maximize2, Minimize2, RefreshCw } from "lucide-react-native";
import { CommunityTermsGate } from "../src/components/community-terms-gate";
import { BLOCKERINO_READY_BRIDGE_SCRIPT, BLOCKERINO_VIEWPORT_SCRIPT } from "../src/game/blockerino-web-scripts";
import { useBlockerinoHtml } from "../src/game/use-blockerino-html";
import { colors, radii, spacing, typography } from "../src/theme/tokens";

const GAME_READY_TIMEOUT_MS = 7000;

export default function GameScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [webViewError, setWebViewError] = useState(false);
  const [webViewReady, setWebViewReady] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const { html, loading: htmlLoading, error: htmlError } = useBlockerinoHtml(reloadKey);
  const webViewReadyRef = useRef(false);
  const loading = htmlLoading || webViewLoading;
  const hasError = Boolean(htmlError) || webViewError;

  useEffect(() => {
    webViewReadyRef.current = webViewReady;
  }, [webViewReady]);

  useEffect(() => {
    if (!html || hasError) return undefined;

    const recoveryTimer = setTimeout(() => {
      if (!webViewReadyRef.current) {
        setShowRecovery(true);
      }
    }, GAME_READY_TIMEOUT_MS);

    return () => clearTimeout(recoveryTimer);
  }, [html, hasError, reloadKey]);

  function reloadGame() {
    setWebViewError(false);
    setWebViewLoading(true);
    setWebViewReady(false);
    setShowRecovery(false);
    setReloadKey((current) => current + 1);
  }

  function handleGameMessage(event: WebViewMessageEvent) {
    try {
      const payload = JSON.parse(event.nativeEvent.data) as { type?: string };
      if (payload.type !== "BLOCKERINO_READY") return;

      setWebViewReady(true);
      setShowRecovery(false);
      setWebViewLoading(false);
    } catch {
      return;
    }
  }

  return (
    <CommunityTermsGate>
      <View style={styles.root}>
      <StatusBar hidden={isFullscreen} style="light" />
      <View style={styles.stage}>
        {loading && !hasError ? (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingBadge}>
              <Text style={styles.loadingBrand}>Dentblast</Text>
              <Text style={styles.loadingSubcopy}>8x8 skor arenası</Text>
            </View>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={styles.loadingText}>Dentblast hazırlanıyor...</Text>
          </View>
        ) : null}

        {hasError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Oyun yüklenemedi</Text>
            <Text style={styles.errorText}>Uygulama içindeki Dentblast dosyası açılamadı.</Text>
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
              injectedJavaScript={BLOCKERINO_READY_BRIDGE_SCRIPT}
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
                setWebViewReady(false);
                setShowRecovery(false);
              }}
              onLoadEnd={() => setWebViewLoading(false)}
              onContentProcessDidTerminate={() => {
                setWebViewLoading(false);
                setWebViewError(true);
              }}
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

        {showRecovery && !hasError ? (
          <View style={styles.recoveryOverlay}>
            <Text style={styles.errorTitle}>Oyun ekranda görünmüyor mu?</Text>
            <Text style={styles.errorText}>Dentblast yeniden yüklenerek devam edebilir.</Text>
            <Pressable onPress={reloadGame} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
              <Text style={styles.retryText}>Oyunu Yenile</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={[styles.topOverlay, { paddingTop: Math.max(insets.top, spacing.xs) }]}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            hitSlop={8}
          >
            <ArrowLeft color="#FFFFFF" size={20} />
          </Pressable>

          <View style={styles.titlePill}>
            <Text style={styles.title}>Dentblast</Text>
            <Text style={styles.subtitle}>8x8 Blok Bulmacası</Text>
          </View>

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
      </View>
      </View>
    </CommunityTermsGate>
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
  titlePill: {
    backgroundColor: "rgba(12,10,26,0.86)",
    borderColor: "rgba(139,92,246,0.32)",
    borderRadius: radii.pill,
    borderWidth: 1,
    flex: 1,
    minWidth: 0,
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: spacing.md
  },
  title: {
    color: "#FFFFFF",
    fontFamily: typography.display,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0
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
    backgroundColor: "#07030F",
    justifyContent: "center",
    padding: spacing.xl,
    zIndex: 10
  },
  loadingBadge: {
    alignItems: "center",
    borderColor: "rgba(139,92,246,0.34)",
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md
  },
  loadingBrand: {
    color: "#FFFFFF",
    fontFamily: typography.display,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 0,
    textAlign: "center"
  },
  loadingSubcopy: {
    color: colors.copper,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4,
    textAlign: "center"
  },
  loadingText: {
    color: "#FFFFFF",
    fontFamily: typography.body,
    fontSize: 14,
    fontWeight: "700",
    marginTop: spacing.sm
  },
  recoveryOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.88)",
    justifyContent: "center",
    padding: spacing.xl,
    zIndex: 16
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
  pressed: {
    opacity: 0.72
  }
});
