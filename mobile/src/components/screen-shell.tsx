import type { PropsWithChildren, ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View, type ScrollViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";
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
        colors={["#030816", "#07132B", "#0A1C3D"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      />

      <Svg pointerEvents="none" style={styles.blobLayer}>
        <Circle cx="14%" cy="9%" r="118" fill="rgba(94, 212, 255, 0.13)" />
        <Circle cx="88%" cy="15%" r="92" fill="rgba(47, 123, 255, 0.14)" />
        <Circle cx="78%" cy="88%" r="132" fill="rgba(32, 66, 123, 0.34)" />
      </Svg>

      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          {...scrollProps}
        >
          <View style={styles.heroCard}>
            <View style={styles.heroHeader}>
              <View style={styles.heroTextBlock}>
                <Text style={styles.kicker}>DENTCO OUTLIER</Text>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>{subtitle}</Text>
              </View>
              {rightAction}
            </View>
          </View>

          {children}
        </ScrollView>
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
  scrollContent: {
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm
  },
  heroCard: {
    backgroundColor: "rgba(10, 24, 51, 0.84)",
    borderColor: "rgba(94, 212, 255, 0.2)",
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
  kicker: {
    color: colors.copper,
    fontFamily: typography.body,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: spacing.xs
  },
  title: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 30,
    fontWeight: "700",
    lineHeight: 34
  },
  subtitle: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.sm
  }
});
