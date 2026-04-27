import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { ArrowLeft, Maximize2, Minimize2, RefreshCw } from "lucide-react-native";
import { BLOCKERINO_VIEWPORT_SCRIPT } from "../src/game/blockerino-web-scripts";
import { useBlockerinoHtml } from "../src/game/use-blockerino-html";
import { colors, radii, spacing, typography } from "../src/theme/tokens";

export default function GameScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [webViewError, setWebViewError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const { html, loading: htmlLoading, error: htmlError } = useBlockerinoHtml(reloadKey);
  const loading = htmlLoading || webViewLoading;
  const hasError = Boolean(htmlError) || webViewError;

  function reloadGame() {
    setWebViewError(false);
    setWebViewLoading(true);
    setReloadKey((current) => current + 1);
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
              <Text style={styles.subtitle}>8x8 Blok Bulmacası</Text>
            </View>
          ) : (
            <View style={styles.overlaySpacer} />
          )}

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
    backgroundColor: "rgba(4,3,16,0.78)",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: radii.pill,
    borderWidth: 1,
    flex: 1,
    minHeight: 42,
    justifyContent: "center",
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
  pressed: {
    opacity: 0.72
  }
});
