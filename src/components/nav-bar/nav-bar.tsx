import { Colors } from "@/constants/theme";
import { useNavDirection } from "@/contexts/nav-direction-context";
import { useAppColorScheme } from "@/hooks/use-app-color-scheme";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Animated, PanResponder, Pressable, View } from "react-native";
import { styles } from "./nav-bar.styles";

export default function NavBar() {
  const scheme = useAppColorScheme();
  const colors = Colors[scheme];
  const { screen, setScreen } = useNavDirection();

  const activeIndex = screen === "settings" ? 1 : 0;

  const scaleCalendar = useRef(new Animated.Value(1)).current;
  const scaleSettings = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scaleCalendar, {
      toValue: activeIndex === 0 ? 1.18 : 1,
      useNativeDriver: true,
      damping: 18,
      stiffness: 340,
    }).start();
    Animated.spring(scaleSettings, {
      toValue: activeIndex === 1 ? 1.18 : 1,
      useNativeDriver: true,
      damping: 18,
      stiffness: 340,
    }).start();
  }, [activeIndex]);

  const goTo = (index: number) => {
    if (index === activeIndex) return;
    setScreen(index === 0 ? "calendar" : "settings");
  };

  const swipePan = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) =>
      Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderRelease: (_, g) => {
      if (g.dx < -12 && activeIndex === 0) goTo(1);
      else if (g.dx > 12 && activeIndex === 1) goTo(0);
    },
  });

  return (
    <View
      style={[
        styles.wrapper,
        {
          borderColor: colors.textSecondary,
          backgroundColor: colors.background,
        },
      ]}
      {...swipePan.panHandlers}
    >
      <View style={[styles.hintWrap, styles.hintLeft, { opacity: 0.35 }]}>
        <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
      </View>

      <Pressable onPress={() => goTo(0)} style={styles.button}>
        <Animated.View style={{ transform: [{ scale: scaleCalendar }] }}>
          <Ionicons
            name={activeIndex === 0 ? "calendar" : "calendar-outline"}
            size={26}
            color={activeIndex === 0 ? colors.text : colors.textSecondary}
          />
        </Animated.View>
      </Pressable>

      <Pressable onPress={() => goTo(1)} style={styles.button}>
        <Animated.View style={{ transform: [{ scale: scaleSettings }] }}>
          <Ionicons
            name={activeIndex === 1 ? "settings" : "settings-outline"}
            size={26}
            color={activeIndex === 1 ? colors.text : colors.textSecondary}
          />
        </Animated.View>
      </Pressable>

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
