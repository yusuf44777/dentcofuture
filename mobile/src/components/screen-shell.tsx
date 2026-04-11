import type { PropsWithChildren, ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewProps
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Ellipse } from "react-native-svg";
import { colors, radii, spacing, typography } from "../theme/tokens";

type ScreenShellProps = PropsWithChildren<{
  title: string;
  subtitle: string;
  rightAction?: ReactNode;
  scrollProps?: ScrollViewProps;
}>;

export function ScreenShell({
  title,
  subtitle,
  rightAction,
  scrollProps,
  children
}: ScreenShellProps) {
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#040311", "#0F062E", "#1A0B4B"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      />

      <Svg pointerEvents="none" style={styles.blobLayer}>
        <Circle cx="10%" cy="8%" r="110" fill="rgba(139,92,246,0.12)" />
        <Circle cx="92%" cy="12%" r="80" fill="rgba(109,40,217,0.18)" />
        <Ellipse cx="75%" cy="92%" rx="140" ry="110" fill="rgba(75,0,130,0.22)" />
        <Circle cx="20%" cy="75%" r="60" fill="rgba(201,169,110,0.06)" />
      </Svg>

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardWrap}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            {...scrollProps}
          >
            <View style={styles.heroCard}>
              <View style={styles.heroHeader}>
                <View style={styles.heroTextBlock}>
                  <View style={styles.kickerRow}>
                    <View style={styles.kickerDot} />
                    <Text style={styles.kicker}>DENTCO OUTLIER</Text>
                  </View>
                  <Text style={styles.title}>{title}</Text>
                  <Text style={styles.subtitle}>{subtitle}</Text>
                </View>
                {rightAction}
              </View>
            </View>

            {children}
          </ScrollView>
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
  gradient: {
    ...StyleSheet.absoluteFillObject
  },
  blobLayer: {
    ...StyleSheet.absoluteFillObject
  },
  safeArea: {
    flex: 1
  },
  keyboardWrap: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm
  },
  heroCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(139,92,246,0.2)",
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.lg,
    padding: spacing.lg
  },
  heroHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  heroTextBlock: {
    flex: 1,
    paddingRight: spacing.md
  },
  kickerRow: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: spacing.xs
  },
  kickerDot: {
    backgroundColor: colors.copper,
    borderRadius: 999,
    height: 5,
    marginRight: 6,
    width: 5
  },
  kicker: {
    color: colors.copper,
    fontFamily: typography.body,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
  },
  title: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 33
  },
  subtitle: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.xs
  }
});
