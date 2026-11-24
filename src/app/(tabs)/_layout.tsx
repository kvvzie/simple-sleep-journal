import CalendarGrid from "@/components/calendar-grid";
import NavBar from "@/components/nav-bar";
import Settings from "@/components/settings";
import ToDiscuss from "@/components/to-discuss";
import { ToastHost } from "@/components/top-toast";
import { useAppearance } from "@/contexts/appearance-context";
import { useNavDirection } from "@/contexts/nav-direction-context";
import { getNavProgress, type ScreenKey } from "@/contexts/nav-utils";
import { useSettings } from "@/contexts/settings-context";
import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

export default function TabsLayout() {
  const { screen } = useNavDirection();
  const { toDiscussEnabled } = useSettings();
  const [toDiscussMounted, setToDiscussMounted] = useState(toDiscussEnabled);
  const { width } = useWindowDimensions();
  const { colors, backgrounds } = useAppearance();

  useEffect(() => {
    if (!toDiscussEnabled) {
      setToDiscussMounted(false);
      return;
    }
    if (toDiscussMounted) return;
    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    const rafId = requestAnimationFrame(() => {
      timerId = setTimeout(() => {
        if (!cancelled) setToDiscussMounted(true);
      }, 140);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      if (timerId !== null) clearTimeout(timerId);
    };
  }, [toDiscussEnabled, toDiscussMounted]);

  const targetProgress = getNavProgress(screen);
  const navProgress = useRef(new Animated.Value(targetProgress)).current;
  const prevScreenRef = useRef<ScreenKey>(screen);

  useEffect(() => {
    if (prevScreenRef.current === screen) return;
    prevScreenRef.current = screen;
    Animated.spring(navProgress, {
      toValue: targetProgress,
      useNativeDriver: true,
      damping: 22,
      stiffness: 220,
      mass: 0.9,
    }).start();
  }, [screen, targetProgress, navProgress]);

  const calendarTranslateX = toDiscussEnabled
    ? navProgress.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0, -width, -width * 2],
      })
    : navProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -width],
      });

  const toDiscussTranslateX = navProgress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [width, 0, -width],
  });

  const settingsTranslateX = toDiscussEnabled
    ? navProgress.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [width * 2, width, 0],
      })
    : navProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [width, 0],
      });

  const baseTabStyle = {
    position: "absolute" as const,
    top: 0,
    bottom: 0,
    left: 0,
    width,
    backgroundColor: colors.background,
  };

  return (
    <View
      style={{
        flex: 1,
        overflow: "hidden",
        backgroundColor: colors.background,
      }}
    >
      <Animated.View
        key="calendar"
        pointerEvents={screen === "calendar" ? "auto" : "none"}
        style={[
          baseTabStyle,
          { transform: [{ translateX: calendarTranslateX }] },
        ]}
      >
        {backgrounds.calendar && (
          <Image
            source={{ uri: backgrounds.calendar }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        )}
        <CalendarGrid />
      </Animated.View>

      {toDiscussEnabled && toDiscussMounted && (
        <Animated.View
          key="to-discuss"
          pointerEvents={screen === "to-discuss" ? "auto" : "none"}
          style={[
            baseTabStyle,
            { transform: [{ translateX: toDiscussTranslateX }] },
          ]}
        >
          {backgrounds.toDiscuss && (
            <Image
              source={{ uri: backgrounds.toDiscuss }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          )}
          <ToDiscuss />
        </Animated.View>
      )}

      <Animated.View
        key="settings"
        pointerEvents={screen === "settings" ? "auto" : "none"}
        style={[
          baseTabStyle,
          { transform: [{ translateX: settingsTranslateX }] },
        ]}
      >
        {backgrounds.settings && (
          <Image
            source={{ uri: backgrounds.settings }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        )}
        <Settings />
      </Animated.View>

      <NavBar />
      <ToastHost hostId="root" />
    </View>
  );
}
