import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { TopNav } from "../../src/features/dashboard/components/top-nav";
import { useAuthSession } from "../../src/features/auth/providers/auth-provider";
import { useTheme } from "../../src/theme/theme-provider";
import { AnimatedPressable } from "../../src/components/animated-pressable";

function TabIcon(props: {
  color: string;
  focused: boolean;
  name: keyof typeof Ionicons.glyphMap;
  outlineName: keyof typeof Ionicons.glyphMap;
}) {
  return <Ionicons color={props.color} name={props.focused ? props.name : props.outlineName} size={20} />;
}

export default function TabsLayout() {
  const { colors } = useTheme();
  const { isLoading, user } = useAuthSession();

  if (isLoading) {
    return (
      <View
        style={{
          alignItems: "center",
          backgroundColor: colors.background,
          flex: 1,
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!user?.uid) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        header: () => <TopNav />,
        tabBarButton: (props) => <AnimatedPressable {...(props as any)} />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
          marginBottom: 2,
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 72,
          paddingBottom: 10,
          paddingTop: 10,
        },
        tabBarItemStyle: {
          borderRadius: 18,
          marginHorizontal: 4,
        },
        sceneStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} name="grid" outlineName="grid-outline" />
          ),
        }}
      />
      <Tabs.Screen
        name="devices"
        options={{
          title: "Devices",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} name="cube" outlineName="cube-outline" />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} name="options" outlineName="options-outline" />
          ),
        }}
      />
    </Tabs>
  );
}
