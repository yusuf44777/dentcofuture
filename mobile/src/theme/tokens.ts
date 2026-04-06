import { Platform } from "react-native";

export const colors = {
  background: "#040B1E",
  backgroundDeep: "#020714",
  surface: "#0C1833",
  surfaceMuted: "#132447",
  ink: "#F1F6FF",
  inkMuted: "#95A8CB",
  accent: "#2F7BFF",
  accentSoft: "#1A2F5A",
  copper: "#5ED4FF",
  copperSoft: "#17324A",
  line: "#243960",
  positive: "#35D7A5",
  warning: "#FFBE55",
  warningSoft: "rgba(255, 190, 85, 0.18)",
  danger: "#FF6E9B",
  dangerSoft: "rgba(255, 110, 155, 0.18)"
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
    shadowColor: "#01040B",
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 }
  },
  android: {
    elevation: 8
  },
  default: {}
});
