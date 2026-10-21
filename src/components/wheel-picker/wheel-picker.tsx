import { Ionicons } from "@expo/vector-icons";
import { forwardRef, useImperativeHandle, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import PagerView from "react-native-pager-view";

export type WheelPickerHandle = {
  bump: (delta: number) => void;
  syncTo: (page: number) => void;
};

type LockRef = React.MutableRefObject<string | null>;

type WheelPickerProps = {
  pagerKey?: number | string;
  page: number;
  totalPages: number;
  renderLabel: (page: number) => string;
  onSelected: (page: number) => void;
  onScrollStateChanged?: (state: "idle" | "dragging" | "settling") => void;
  canIncrease?: boolean;
  canDecrease?: boolean;
  arrowColor: string;
  arrowSize?: number;
  containerStyle?: any;
  arrowSlotStyle?: any;
  pagerStyle?: any;
  pageStyle?: any;
  labelStyle?: any;
  lockRef?: LockRef;
  lockKey?: string;
};

const WheelPicker = forwardRef<WheelPickerHandle, WheelPickerProps>(
  (
    {
      pagerKey,
      page,
      totalPages,
      renderLabel,
      onSelected,
      onScrollStateChanged,
      canIncrease = true,
      canDecrease = true,
      arrowColor,
      arrowSize = 16,
      containerStyle,
      arrowSlotStyle,
      pagerStyle,
      pageStyle,
      labelStyle,
      lockRef,
      lockKey = "wheel",
    },
    ref,
  ) => {
    const pagerRef = useRef<PagerView>(null);
    const currentPageRef = useRef(page);
    const suppressNextRef = useRef(false);

    useImperativeHandle(ref, () => ({
      bump: (delta: number) => {
        pagerRef.current?.setPage(currentPageRef.current + delta);
      },
      syncTo: (targetPage: number) => {
        if (targetPage === currentPageRef.current) return;
        suppressNextRef.current = true;
        currentPageRef.current = targetPage;
        pagerRef.current?.setPage(targetPage);
      },
    }));

    const handleSelected = (e: { nativeEvent: { position: number } }) => {
      if (suppressNextRef.current) {
        suppressNextRef.current = false;
        return;
      }
      const p = e.nativeEvent.position;
      if (p === currentPageRef.current) return;
      currentPageRef.current = p;
      onSelected(p);
    };

    const tryLock = () => {
      if (lockRef && lockRef.current === null) lockRef.current = lockKey;
    };
    const releaseLock = () => {
      if (lockRef && lockRef.current === lockKey) lockRef.current = null;
    };
    const isLockedOut = () =>
      !!lockRef && lockRef.current !== null && lockRef.current !== lockKey;

    return (
      <View
        style={containerStyle}
        pointerEvents={isLockedOut() ? "none" : "auto"}
        onTouchStart={tryLock}
        onTouchEnd={releaseLock}
        onTouchCancel={releaseLock}
      >
        <View style={arrowSlotStyle}>
          {canIncrease && (
            <Pressable
              onPress={() =>
                pagerRef.current?.setPage(currentPageRef.current + 1)
              }
              hitSlop={14}
            >
              <Ionicons name="chevron-up" size={arrowSize} color={arrowColor} />
            </Pressable>
          )}
        </View>

        <PagerView
          key={pagerKey}
          ref={pagerRef}
          style={pagerStyle}
          orientation="vertical"
          initialPage={page}
          onPageSelected={handleSelected}
          onPageScrollStateChanged={
            onScrollStateChanged
              ? (e) => onScrollStateChanged(e.nativeEvent.pageScrollState)
              : undefined
          }
        >
          {Array.from({ length: totalPages }).map((_, p) => (
            <View key={p} style={pageStyle}>
              <Text style={labelStyle}>{renderLabel(p)}</Text>
            </View>
          ))}
        </PagerView>

        <View style={arrowSlotStyle}>
          {canDecrease && (
            <Pressable
              onPress={() =>
                pagerRef.current?.setPage(currentPageRef.current - 1)
              }
              hitSlop={14}
            >
              <Ionicons
                name="chevron-down"
                size={arrowSize}
                color={arrowColor}
              />
            </Pressable>
          )}
        </View>
      </View>
    );
  },
);

export default WheelPicker;
