import { Tabs } from "expo-router";
import { Gamepad2, House, MessageCircleHeart, Radio, Settings2 } from "lucide-react-native";
import { colors } from "../../src/theme/tokens";

export default function ParticipantLayout() {
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
          tabBarIcon: ({ color, size }) => <Radio color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="networking"
        options={{
          title: "Networking",
          tabBarIcon: ({ color, size }) => <MessageCircleHeart color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="game"
        options={{
          title: "Oyun",
          tabBarIcon: ({ color, size }) => <Gamepad2 color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "Diğer",
          tabBarIcon: ({ color, size }) => <Settings2 color={color} size={size} />
        }}
      />
    </Tabs>
  );
}
