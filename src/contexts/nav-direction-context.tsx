import { useSettings } from "@/contexts/settings-context";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { resolveVisibleScreen, type ScreenKey } from "./nav-utils";

export type { ScreenKey };

type NavDirectionState = {
  screen: ScreenKey;
  setScreen: (s: ScreenKey) => void;
};

const NavDirectionContext = createContext<NavDirectionState | null>(null);

export function NavDirectionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { toDiscussEnabled } = useSettings();
  const [screen, setScreen] = useState<ScreenKey>("calendar");

  useEffect(() => {
    if (!toDiscussEnabled && screen === "to-discuss") {
      setScreen("calendar");
    }
  }, [toDiscussEnabled, screen]);

  const effectiveScreen = resolveVisibleScreen(screen, toDiscussEnabled);

  const value = useMemo(
    () => ({
      screen: effectiveScreen,
      setScreen,
    }),
    [effectiveScreen],
  );

  return (
    <NavDirectionContext.Provider value={value}>
      {children}
    </NavDirectionContext.Provider>
  );
}

export function useNavDirection() {
  const ctx = useContext(NavDirectionContext);
  if (!ctx)
    throw new Error("useNavDirection must be used within NavDirectionProvider");
  return ctx;
}
