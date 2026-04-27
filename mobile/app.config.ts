import type { ExpoConfig } from "expo/config";

const DEFAULT_API_BASE_URL = "https://dentcooutliers.vercel.app";

const config: ExpoConfig = {
  name: "DentCo Outlier",
  slug: "dentlinkco",
  scheme: "dentlinkco",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  icon: "./assets/icon.png",
  assetBundlePatterns: [
    "assets/**/*"
  ],
  newArchEnabled: true,
  ios: {
    icon: "./assets/ios-icon.png",
    supportsTablet: true,
    bundleIdentifier: "com.communitive.dentlinkco"
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#FFFFFF"
    },
    package: "com.communitive.dentlinkco",
    softwareKeyboardLayoutMode: "resize"
  },
  experiments: {
    typedRoutes: true
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-screen-orientation"
  ],
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_BASE_URL,
    eas: {
      projectId: "03066288-4ace-49af-abd9-b6b82b1e7041"
    }
  }
};

export default config;
