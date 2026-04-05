import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import { useState } from "react";
import { colors, radii, spacing, typography } from "../src/theme/tokens";

const GAME_URL = "https://itch.io/embed-upload/15862237?color=333333";

export default function GameScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <ArrowLeft color={colors.ink} size={20} />
        </Pressable>
        <View style={styles.headerTitle}>
          <Text style={styles.title}>Tooth Defenders</Text>
          <Text style={styles.subtitle}>Micro Rogue</Text>
        </View>
      </View>

      <View style={styles.gameContainer}>
        {loading && !error ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={styles.loadingText}>Oyun yükleniyor...</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Oyun yüklenemedi</Text>
            <Text style={styles.errorText}>
              İnternet bağlantınızı kontrol edin ve tekrar deneyin.
            </Text>
            <Pressable
              onPress={() => {
                setError(false);
                setLoading(true);
              }}
              style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
            >
              <Text style={styles.retryText}>Tekrar Dene</Text>
            </Pressable>
          </View>
        ) : (
          <WebView
            source={{ uri: GAME_URL }}
            style={styles.webview}
            allowsFullscreenVideo
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            domStorageEnabled
            onLoadEnd={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setError(true);
            }}
            onHttpError={() => {
              setLoading(false);
              setError(true);
            }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm
  },
  backButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  pressed: {
    opacity: 0.75
  },
  headerTitle: {
    flex: 1
  },
  title: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 18,
    fontWeight: "700"
  },
  subtitle: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 1
  },
  gameContainer: {
    flex: 1,
    overflow: "hidden",
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    backgroundColor: "#333333"
  },
  webview: {
    flex: 1,
    backgroundColor: "#333333"
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "#333333",
    justifyContent: "center",
    zIndex: 10
  },
  loadingText: {
    color: "#FFFFFF",
    fontFamily: typography.body,
    fontSize: 14,
    fontWeight: "600",
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
    fontWeight: "700"
  },
  errorText: {
    color: "#AAAAAA",
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
  }
});
