import { Platform } from "react-native";

export const colors = {
  background: "#F2ECE1",
  backgroundDeep: "#E5DDD0",
  surface: "#FFFDF8",
  surfaceMuted: "#F8F2E8",
  ink: "#102B2D",
  inkMuted: "#5F7575",
  accent: "#0E7770",
  accentSoft: "#D9F2EE",
  copper: "#BE6D45",
  copperSoft: "#F5E2D7",
  line: "#D9D0C1",
  positive: "#24715E",
  warning: "#A06A18",
  danger: "#A04444"
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
    shadowColor: "#102B2D",
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 }
  },
  android: {
    elevation: 5
  },
  default: {}
});
