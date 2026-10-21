import CalendarGrid from "@/components/calendar-grid";
import NavBar from "@/components/nav-bar";
import Settings from "@/components/settings";
import { Colors } from "@/constants/theme";
import { useNavDirection } from "@/contexts/nav-direction-context";
import { useAppColorScheme } from "@/hooks/use-app-color-scheme";
import { useEffect, useRef } from "react";
import { Animated, useWindowDimensions, View } from "react-native";

export default function TabsLayout() {
  const { screen } = useNavDirection();
  const { width } = useWindowDimensions();
  const translateX = useRef(new Animated.Value(0)).current;
  const scheme = useAppColorScheme();
  const colors = Colors[scheme];

  useEffect(() => {
    Animated.spring(translateX, {
      toValue: screen === "calendar" ? 0 : -width,
      useNativeDriver: true,
      damping: 22,
      stiffness: 220,
      mass: 0.9,
    }).start();
  }, [screen, width]);

  return (
    <View
      style={{
        flex: 1,
        overflow: "hidden",
        backgroundColor: colors.background,
      }}
    >
      <Animated.View
        style={{
          flexDirection: "row",
          width: width * 2,
          height: "100%",
          backgroundColor: colors.background,
          transform: [{ translateX }],
        }}
      >
        <View style={{ width, backgroundColor: colors.background }}>
          <CalendarGrid />
        </View>
        <View style={{ width, backgroundColor: colors.background }}>
          <Settings />
        </View>
      </Animated.View>
      <NavBar />
    </View>
  );
}
