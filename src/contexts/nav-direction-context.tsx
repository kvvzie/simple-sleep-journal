import { createContext, useContext, useState } from "react";

type ScreenKey = "calendar" | "settings";

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
  const [screen, setScreen] = useState<ScreenKey>("calendar");
  return (
    <NavDirectionContext.Provider value={{ screen, setScreen }}>
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
