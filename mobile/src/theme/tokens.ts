import { Platform } from "react-native";

export const colors = {
  background: "#07061A",
  backgroundDeep: "#040310",
  surface: "#0E0A26",
  surfaceMuted: "#140E30",
  ink: "#EDE8FF",
  inkMuted: "#7B6EA8",
  accent: "#8B5CF6",
  accentSoft: "#1C1040",
  copper: "#C9A96E",
  copperSoft: "#221809",
  line: "#221B4A",
  positive: "#34D399",
  warning: "#F59E0B",
  warningSoft: "rgba(245, 158, 11, 0.15)",
  danger: "#F87171",
  dangerSoft: "rgba(248, 113, 113, 0.15)"
} as const;

export const spacing = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 36
} as const;

export const radii = {
  sm: 14,
  md: 18,
  lg: 26,
  pill: 999
} as const;

export const typography = {
  display: Platform.select({
    ios: "Avenir Next",
    android: "sans-serif-condensed",
    default: "System"
  }),
  body: Platform.select({
    ios: "Avenir",
    android: "sans-serif-medium",
    default: "System"
  })
};

export const shadows = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 }
  },
  android: {
    elevation: 10
  },
  default: {}
});
