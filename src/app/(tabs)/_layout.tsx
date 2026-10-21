import CalendarGrid from "@/components/calendar-grid";
import NavBar from "@/components/nav-bar";
import Settings from "@/components/settings";
import { useAppearance } from "@/contexts/appearance-context";
import { useNavDirection } from "@/contexts/nav-direction-context";
import { useEffect, useRef } from "react";
import {
  Animated,
  ImageBackground,
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
          {backgrounds.calendar ? (
            <ImageBackground
              source={{ uri: backgrounds.calendar }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            >
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: colors.background, opacity: 0.65 },
                ]}
              />
              <CalendarGrid />
            </ImageBackground>
          ) : (
            <CalendarGrid />
          )}
        </View>

        <View style={{ width, height: "100%", backgroundColor: colors.background }}>
          {backgrounds.settings ? (
            <ImageBackground
              source={{ uri: backgrounds.settings }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            >
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: colors.background, opacity: 0.65 },
                ]}
              />
              <Settings />
            </ImageBackground>
          ) : (
            <Settings />
          )}
        </View>
      </Animated.View>
      <NavBar />
    </View>
  );
}
