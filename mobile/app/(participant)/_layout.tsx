import { Tabs } from "expo-router";
import { Gamepad2, House, Radio, UserRound, Users } from "lucide-react-native";
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
          backgroundColor: "#0A0820",
          borderTopColor: "rgba(139,92,246,0.2)",
          borderTopWidth: 1,
          height: 62,
          paddingBottom: 8,
          paddingTop: 4
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "700",
          letterSpacing: 0.3
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Ana Sayfa",
          tabBarIcon: ({ color, size }) => <House color={color} size={size - 2} />
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: "Canlı",
          href: isProfileLocked ? null : undefined,
          tabBarIcon: ({ color, size }) => <Radio color={color} size={size - 2} />
        }}
      />
      <Tabs.Screen
        name="networking"
        options={{
          title: "Outliers",
          href: isProfileLocked ? null : undefined,
          tabBarIcon: ({ color, size }) => <Users color={color} size={size - 2} />
        }}
      />
      <Tabs.Screen
        name="game"
        options={{
          title: "Oyun",
          href: isProfileLocked ? null : undefined,
          tabBarStyle: {
            display: "none"
          },
          tabBarIcon: ({ color, size }) => <Gamepad2 color={color} size={size - 2} />
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "Profilim",
          tabBarIcon: ({ color, size }) => <UserRound color={color} size={size - 2} />
        }}
      />
      <Tabs.Screen
        name="uploader"
        options={{
          href: null
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          href: null,
          tabBarStyle: {
            display: "none"
          }
        }}
      />
    </Tabs>
  );
}
