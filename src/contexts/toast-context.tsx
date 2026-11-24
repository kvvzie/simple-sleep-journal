import { Ionicons } from "@expo/vector-icons";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type ToastIconName = keyof typeof Ionicons.glyphMap;
export type ToastPhase = "visible" | "exiting";

export type ShowToastOptions = {
  message: string;
  icon?: ToastIconName;
  durationMs?: number;
};

export type ActiveToast = {
  id: number;
  message: string;
  icon: ToastIconName;
  phase: ToastPhase;
};

type ToastContextValue = {
  toast: ActiveToast | null;
  activeHostId: string | null;
  rootTopInset: number;
  showToast: (options: ShowToastOptions) => void;
  hideToast: () => void;
  registerHost: (hostId: string) => () => void;
  claimEntered: (toastId: number) => boolean;
  reportRootTopInset: (topInset: number) => void;
};

const DEFAULT_DURATION_MS = 1900;
const EXIT_DURATION_MS = 230;

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ActiveToast | null>(null);
  const [hostStack, setHostStack] = useState<string[]>([]);
  const [rootTopInset, setRootTopInset] = useState(0);
  const seqRef = useRef(0);
  const enteredIdsRef = useRef<Set<number>>(new Set());
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (hideTimerRef.current !== null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (clearTimerRef.current !== null) {
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  const startExitSequence = useCallback(
    (targetSeq: number) => {
      if (clearTimerRef.current !== null) {
        clearTimeout(clearTimerRef.current);
      }
      setToast((prev) =>
        prev && prev.id === targetSeq ? { ...prev, phase: "exiting" } : prev,
      );
      clearTimerRef.current = setTimeout(() => {
        clearTimerRef.current = null;
        if (seqRef.current !== targetSeq) return;
        enteredIdsRef.current.delete(targetSeq);
        setToast(null);
      }, EXIT_DURATION_MS);
    },
    [],
  );

  const hideToast = useCallback(() => {
    const targetSeq = seqRef.current;
    clearTimers();
    startExitSequence(targetSeq);
  }, [clearTimers, startExitSequence]);

  const showToast = useCallback(
    ({
      message,
      icon = "checkmark-outline",
      durationMs = DEFAULT_DURATION_MS,
    }: ShowToastOptions) => {
      const nextId = ++seqRef.current;
      clearTimers();
      enteredIdsRef.current.clear();
      setToast({ id: nextId, message, icon, phase: "visible" });

      hideTimerRef.current = setTimeout(() => {
        hideTimerRef.current = null;
        if (seqRef.current !== nextId) return;
        startExitSequence(nextId);
      }, durationMs);
    },
    [clearTimers, startExitSequence],
  );

  const claimEntered = useCallback((toastId: number) => {
    if (enteredIdsRef.current.has(toastId)) {
      return true;
    }
    enteredIdsRef.current.add(toastId);
    return false;
  }, []);

  const registerHost = useCallback((hostId: string) => {
    setHostStack((prev) => [...prev.filter((id) => id !== hostId), hostId]);
    return () => {
      setHostStack((prev) => prev.filter((id) => id !== hostId));
    };
  }, []);

  const reportRootTopInset = useCallback((topInset: number) => {
    const next = Math.max(0, Math.round(topInset));
    setRootTopInset((prev) => (prev === next ? prev : next));
  }, []);

  const activeHostId =
    hostStack.length > 0 ? hostStack[hostStack.length - 1] : null;

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      activeHostId,
      rootTopInset,
      showToast,
      hideToast,
      registerHost,
      claimEntered,
      reportRootTopInset,
    }),
    [
      toast,
      activeHostId,
      rootTopInset,
      showToast,
      hideToast,
      registerHost,
      claimEntered,
      reportRootTopInset,
    ],
  );

  return (
    <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
