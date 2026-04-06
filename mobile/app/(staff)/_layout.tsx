import { Tabs } from "expo-router";
import { BarChart3, Gift, RadioTower, Settings2, UsersRound } from "lucide-react-native";
import { colors } from "../../src/theme/tokens";

export default function StaffLayout() {
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
          title: "Panel",
          tabBarIcon: ({ color, size }) => <BarChart3 color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="live-ops"
        options={{
          title: "Canlı Operasyon",
          tabBarIcon: ({ color, size }) => <RadioTower color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="raffle"
        options={{
          title: "Çekiliş",
          tabBarIcon: ({ color, size }) => <Gift color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: "Katılımcılar",
          tabBarIcon: ({ color, size }) => <UsersRound color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Ayarlar",
          tabBarIcon: ({ color, size }) => <Settings2 color={color} size={size} />
        }}
      />
    </Tabs>
  );
}
