import CalendarGrid from "@/components/calendar-grid";
import NavBar from "@/components/nav-bar";
import Settings from "@/components/settings";
import { useAppearance } from "@/contexts/appearance-context";
import { useNavDirection } from "@/contexts/nav-direction-context";
import { Image } from "expo-image";
import { useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

export default function TabsLayout() {
  const { screen } = useNavDirection();
  const { width } = useWindowDimensions();
  const translateX = useRef(new Animated.Value(0)).current;
  const { colors, backgrounds } = useAppearance();

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
        <View style={{ width, height: "100%", backgroundColor: colors.background }}>
          {backgrounds.calendar && (
            <Image
              source={{ uri: backgrounds.calendar }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          )}
          <CalendarGrid />
        </View>

        <View style={{ width, height: "100%", backgroundColor: colors.background }}>
          {backgrounds.settings && (
            <Image
              source={{ uri: backgrounds.settings }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          )}
          <Settings />
        </View>
      </Animated.View>
      <NavBar />
    </View>
  );
}
