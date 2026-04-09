import { Tabs } from "expo-router";
import { Gamepad2, House, Radio, UserRound } from "lucide-react-native";
import { colors } from "../../src/theme/tokens";
import { useMobileMe } from "../../src/hooks/use-mobile-me";

export default function ParticipantLayout() {
  const { me, query } = useMobileMe();
  const isProfileLocked =
    !query.isLoading && me?.role === "participant" && !me.attendee;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Ana Sayfa",
          tabBarIcon: ({ color, size }) => <House color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: "Canlı",
          href: isProfileLocked ? null : undefined,
          tabBarIcon: ({ color, size }) => <Radio color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="networking"
        options={{
          title: "Outliers",
          href: isProfileLocked ? null : undefined,
          tabBarIcon: ({ color, size }) => <House color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="game"
        options={{
          title: "Oyun",
          href: isProfileLocked ? null : undefined,
          tabBarIcon: ({ color, size }) => <Gamepad2 color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "Profilim",
          tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="uploader"
        options={{
          href: null
        }}
      />
    </Tabs>
  );
}
