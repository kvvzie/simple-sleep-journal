import { useAppearance } from "@/contexts/appearance-context";
import { useNavDirection } from "@/contexts/nav-direction-context";
import {
  getNavBarBottomOffset,
  getNextTabIndexOnSwipe,
  getTabIndex,
  getVisibleTabs,
  ScreenKey,
} from "@/contexts/nav-utils";
import { useSettings } from "@/contexts/settings-context";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Animated, PanResponder, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  MIDDLE_BUTTON_WIDTH,
  OUTER_BUTTON_WIDTH,
  styles,
} from "./nav-bar.styles";
import { ReadingModeMobileIcon } from "../icons";

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "").trim();
  let r = 0;
  let g = 0;
  let b = 0;
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16);
    g = parseInt(clean[1] + clean[1], 16);
    b = parseInt(clean[2] + clean[2], 16);
  } else if (clean.length === 6) {
    r = parseInt(clean.slice(0, 2), 16);
    g = parseInt(clean.slice(2, 4), 16);
    b = parseInt(clean.slice(4, 6), 16);
  } else if (clean.startsWith("rgb")) {
    return clean;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function NavBar() {
  const { colors } = useAppearance();
  const { toDiscussEnabled } = useSettings();
  const { screen, setScreen } = useNavDirection();
  const insets = useSafeAreaInsets();

  const tabs = getVisibleTabs(toDiscussEnabled);
  const activeIndex = getTabIndex(screen, toDiscussEnabled);

  const tabsRef = useRef<ScreenKey[]>(tabs);
  const activeIndexRef = useRef(activeIndex);
  const setScreenRef = useRef(setScreen);
  tabsRef.current = tabs;
  activeIndexRef.current = activeIndex;
  setScreenRef.current = setScreen;

  const scaleCalendar = useRef(new Animated.Value(1)).current;
  const scaleToDiscuss = useRef(new Animated.Value(1)).current;
  const scaleSettings = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scaleCalendar, {
      toValue: screen === "calendar" ? 1.18 : 1,
      useNativeDriver: true,
      damping: 18,
      stiffness: 340,
    }).start();
    Animated.spring(scaleToDiscuss, {
      toValue: screen === "to-discuss" ? 1.18 : 1,
      useNativeDriver: true,
      damping: 18,
      stiffness: 340,
    }).start();
    Animated.spring(scaleSettings, {
      toValue: screen === "settings" ? 1.18 : 1,
      useNativeDriver: true,
      damping: 18,
      stiffness: 340,
    }).start();
  }, [screen]);

  const goTo = (target: ScreenKey) => {
    if (target === screen) return;
    setScreen(target);
  };

  const swipePan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderRelease: (_, g) => {
        const nextIdx = getNextTabIndexOnSwipe(
          activeIndexRef.current,
          g.dx,
          tabsRef.current.length,
          12,
        );
        if (nextIdx !== null) {
          setScreenRef.current(tabsRef.current[nextIdx]);
        }
      },
    }),
  ).current;

  const renderIcon = (key: ScreenKey) => {
    const isActive = screen === key;
    if (key === "calendar") {
      return (
        <Animated.View style={{ transform: [{ scale: scaleCalendar }] }}>
          <Ionicons
            name={isActive ? "calendar" : "calendar-outline"}
            size={26}
            color={isActive ? colors.text : colors.textSecondary}
          />
        </Animated.View>
      );
    }
    if (key === "to-discuss") {
      return (
        <Animated.View style={{ transform: [{ scale: scaleToDiscuss }] }}>
          <ReadingModeMobileIcon
            size={26}
            color={isActive ? colors.text : colors.textSecondary}
            cutoutColor={colors.background}
            filled={isActive}
          />
        </Animated.View>
      );
    }
    return (
      <Animated.View style={{ transform: [{ scale: scaleSettings }] }}>
        <Ionicons
          name={isActive ? "settings" : "settings-outline"}
          size={26}
          color={isActive ? colors.text : colors.textSecondary}
        />
      </Animated.View>
    );
  };

  const isTriple = tabs.length === 3;

  return (
    <View
      style={[
        styles.wrapper,
        {
          bottom: getNavBarBottomOffset(insets.bottom),
          borderColor: colors.textSecondary,
          backgroundColor: hexToRgba(colors.background, 0.5),
        },
      ]}
      {...swipePan.panHandlers}
    >
      <View style={[styles.hintWrap, styles.hintLeft, { opacity: 0.35 }]}>
        <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
      </View>

      {tabs.map((key, index) => {
        const isFirst = index === 0;
        const isLast = index === tabs.length - 1;
        const isMiddle = isTriple && index === 1;
        return (
          <Pressable
            key={key}
            onPress={() => goTo(key)}
            style={[
              styles.button,
              isTriple &&
                (isMiddle
                  ? { width: MIDDLE_BUTTON_WIDTH }
                  : {
                      width: OUTER_BUTTON_WIDTH,
                      marginLeft: isFirst ? 10 : 0,
                      marginRight: isLast ? 10 : 0,
                    }),
              !isTriple && {
                marginLeft: isFirst ? 4 : 0,
                marginRight: isLast ? 4 : 0,
              },
            ]}
          >
            {renderIcon(key)}
          </Pressable>
        );
      })}

      <View style={[styles.hintWrap, styles.hintRight, { opacity: 0.35 }]}>
        <Ionicons
          name="chevron-forward"
          size={16}
          color={colors.textSecondary}
        />
      </View>
    </View>
  );
}
