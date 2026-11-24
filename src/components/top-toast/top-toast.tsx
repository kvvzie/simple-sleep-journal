import { useAppearance } from "@/contexts/appearance-context";
import { useToast } from "@/contexts/toast-context";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Animated, Easing, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from "./top-toast.styles";
import {
  resolveToastHostEntryMode,
  resolveToastTopOffset,
} from "./top-toast.utils";

type Props = {
  hostId: string;
};

export function ToastHost({ hostId }: Props) {
  const {
    toast,
    activeHostId,
    rootTopInset,
    registerHost,
    claimEntered,
    reportRootTopInset,
  } = useToast();
  const { colors, resolveFont } = useAppearance();
  const insets = useSafeAreaInsets();
  const localProgress = useRef(new Animated.Value(0)).current;
  const activeAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => registerHost(hostId), [hostId, registerHost]);

  useEffect(() => {
    if (hostId === "root") {
      reportRootTopInset(insets.top);
    }
  }, [hostId, insets.top, reportRootTopInset]);

  const isCurrentHost = Boolean(toast && activeHostId === hostId);
  const toastId = toast?.id ?? null;
  const phase = toast?.phase ?? null;

  useEffect(() => {
    const alreadyEntered =
      isCurrentHost && toastId !== null ? claimEntered(toastId) : false;
    const mode = resolveToastHostEntryMode({
      isCurrentHost,
      toastId,
      phase,
      alreadyEntered,
    });

    activeAnimRef.current?.stop();
    activeAnimRef.current = null;

    if (mode === "hide") {
      localProgress.setValue(0);
      return;
    }

    if (mode === "snap-visible") {
      localProgress.setValue(1);
      return;
    }

    if (mode === "animate-in") {
      localProgress.setValue(0);
      const enterAnim = Animated.spring(localProgress, {
        toValue: 1,
        damping: 20,
        stiffness: 260,
        mass: 0.85,
        useNativeDriver: true,
      });
      activeAnimRef.current = enterAnim;
      enterAnim.start(({ finished }) => {
        if (finished && activeAnimRef.current === enterAnim) {
          activeAnimRef.current = null;
        }
      });
      return;
    }

    const exitAnim = Animated.timing(localProgress, {
      toValue: 0,
      duration: 210,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    });
    activeAnimRef.current = exitAnim;
    exitAnim.start(({ finished }) => {
      if (finished && activeAnimRef.current === exitAnim) {
        activeAnimRef.current = null;
      }
    });
  }, [isCurrentHost, toastId, phase, claimEntered, localProgress]);

  useEffect(() => {
    return () => {
      activeAnimRef.current?.stop();
    };
  }, []);

  const topOffset = resolveToastTopOffset(insets.top, rootTopInset);
  const translateY = localProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-(topOffset + 64), 0],
  });
  const opacity = localProgress.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0, 1, 1],
  });
  const scale = localProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1],
  });

  if (!isCurrentHost && hostId !== "root") {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      collapsable={false}
      style={[
        styles.portalOverlay,
        { paddingTop: topOffset },
        !isCurrentHost && { opacity: 0 },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.pill,
          {
            backgroundColor: colors.modalBackground,
            borderColor: colors.textSecondary + "38",
            opacity: isCurrentHost ? opacity : 0,
            transform: [{ translateY }, { scale }],
          },
        ]}
      >
        {toast ? (
          <>
            <Ionicons name={toast.icon} size={16} color={colors.text} />
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                { color: colors.text, fontFamily: resolveFont("bold") },
              ]}
            >
              {toast.message}
            </Text>
          </>
        ) : null}
      </Animated.View>
    </View>
  );
}
