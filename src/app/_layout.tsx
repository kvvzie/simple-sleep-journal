import { AppearanceProvider, useAppearance } from "@/contexts/appearance-context";
import { NavDirectionProvider } from "@/contexts/nav-direction-context";
import { SettingsProvider } from "@/contexts/settings-context";
import { useAppColorScheme } from "@/hooks/use-app-color-scheme";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, View } from "react-native";

SplashScreen.preventAutoHideAsync();

function ThemedRoot() {
  const { colors } = useAppearance();
  const scheme = useAppColorScheme();
  const opacity = useRef(new Animated.Value(1)).current;
  const prevScheme = useRef(scheme);
  const [isThemeFading, setIsThemeFading] = useState(false);

  useEffect(() => {
    if (prevScheme.current === scheme) return;
    prevScheme.current = scheme;
    setIsThemeFading(true);
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      setIsThemeFading(false);
    });
  }, [scheme, opacity]);

  return (
    <Animated.View
      style={{ flex: 1, opacity, backgroundColor: colors.background }}
      renderToHardwareTextureAndroid={isThemeFading}
    >
      <StatusBar style={scheme === "dark" ? "light" : "dark"} animated />
      <Stack screenOptions={{ headerShown: false }} />
    </Animated.View>
  );
}

export default function Layout() {
  const [fontsLoaded] = useFonts({
    "Redaction70-Bold": require("../../assets/fonts/Redaction70-Bold.otf"),
    "Redaction50-Bold": require("../../assets/fonts/Redaction50-Bold.otf"),
    "Redaction35-Regular": require("../../assets/fonts/Redaction35-Regular.otf"),
    "Redaction35-Italic": require("../../assets/fonts/Redaction35-Italic.otf"),
    "Redaction35-Bold": require("../../assets/fonts/Redaction35-Bold.otf"),
    "Redaction20-Regular": require("../../assets/fonts/Redaction20-Regular.otf"),
    "Redaction20-Italic": require("../../assets/fonts/Redaction20-Italic.otf"),
    "Redaction20-Bold": require("../../assets/fonts/Redaction20-Bold.otf"),
    "ComicSans": require("../../assets/fonts/custom/ComicSans.ttf"),
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) await SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SettingsProvider>
      <AppearanceProvider>
        <NavDirectionProvider>
          <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
            <ThemedRoot />
          </View>
        </NavDirectionProvider>
      </AppearanceProvider>
    </SettingsProvider>
  );
}
