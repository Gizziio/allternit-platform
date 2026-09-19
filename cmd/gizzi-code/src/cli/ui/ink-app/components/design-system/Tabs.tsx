import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useIsInsideModal, useModalScrollRef } from '../../context/modalContext';
import { useTerminalSize } from '../../hooks/useTerminalSize';
import ScrollBox from '../../ink/components/ScrollBox';
import type { KeyboardEvent } from '../../ink/events/keyboard-event';
import { stringWidth } from '../../ink/stringWidth';
import { Box, Text } from '../../ink';
import { useKeybindings } from '../../keybindings/useKeybinding';
import type { Theme } from '../../utils/theme';
type TabsProps = {
  children: Array<React.ReactElement<TabProps>>;
  title?: string;
  color?: keyof Theme;
  defaultTab?: string;
  hidden?: boolean;
  useFullWidth?: boolean;
  /** Controlled mode: current selected tab id/title */
  selectedTab?: string;
  /** Controlled mode: callback when tab changes */
  onTabChange?: (tabId: string) => void;
  /** Optional banner to display below tabs header */
  banner?: React.ReactNode;
  /** Disable keyboard navigation (e.g. when a child component handles arrow keys) */
  disableNavigation?: boolean;
  /**
   * Initial focus state for the tab header row. Defaults to true (header
   * focused, nav always works). Keep the default for Select/list content —
   * those only use up/down so there's no conflict; pass
   * isDisabled={headerFocused} to the Select instead. Only set false when
   * content actually binds left/right/tab (e.g. enum cycling), and show a
   * "↑ tabs" footer hint — without it tabs look broken.
   */
  initialHeaderFocused?: boolean;
  /**
   * Fixed height for the content area. When set, all tabs render within the
   * same height (overflow hidden) so switching tabs doesn't cause layout
   * shifts. Shorter tabs get whitespace; taller tabs are clipped.
   */
  contentHeight?: number;
  /**
   * Let Tab/←/→ switch tabs from focused content. Opt-in since some
   * content uses those keys; pass a reactive boolean to cede them when
   * needed. Switching from content focuses the header.
   */
  navFromContent?: boolean;
};
type TabsContextValue = {
  selectedTab: string | undefined;
  width: number | undefined;
  headerFocused: boolean;
  focusHeader: () => void;
  blurHeader: () => void;
  registerOptIn: () => () => void;
};
const TabsContext = createContext<TabsContextValue>({
  selectedTab: undefined,
  width: undefined,
  // Default for components rendered outside a Tabs (tests, standalone):
  // content has focus, focusHeader is a no-op.
  headerFocused: false,
  focusHeader: () => {},
  blurHeader: () => {},
  registerOptIn: () => () => {}
});
export function Tabs({
    title,
    color,
    defaultTab,
    children,
    hidden,
    useFullWidth,
    selectedTab: controlledSelectedTab,
    onTabChange,
    banner,
    disableNavigation,
    initialHeaderFocused: t1,
    contentHeight,
    navFromContent: t2
}: TabsProps) {
  const initialHeaderFocused = t1 === undefined ? true : t1;
  const navFromContent = t2 === undefined ? false : t2;
  const {
    columns: terminalWidth
  } = useTerminalSize();
  const tabs = children.map(_temp);
  const defaultTabIndex = defaultTab ? tabs.findIndex(tab => defaultTab === tab[0]) : 0;
  const isControlled = controlledSelectedTab !== undefined;
  const [internalSelectedTab, setInternalSelectedTab] = useState(defaultTabIndex !== -1 ? defaultTabIndex : 0);
  const controlledTabIndex = isControlled ? tabs.findIndex(tab_0 => tab_0[0] === controlledSelectedTab) : -1;
  const selectedTabIndex = isControlled ? controlledTabIndex !== -1 ? controlledTabIndex : 0 : internalSelectedTab;
  const modalScrollRef = useModalScrollRef();
  const [headerFocused, setHeaderFocused] = useState(initialHeaderFocused);
  const t3 = () => setHeaderFocused(true);

  const focusHeader = t3;
  const t4 = () => setHeaderFocused(false);

  const blurHeader = t4;
  const [optInCount, setOptInCount] = useState(0);
  const t5 = () => {
      setOptInCount(_temp2);
      return () => setOptInCount(_temp3);
    };

  const registerOptIn = t5;
  const optedIn = optInCount > 0;
  const handleTabChange = offset => {
    const newIndex = (selectedTabIndex + tabs.length + offset) % tabs.length;
    const newTabId = tabs[newIndex]?.[0];
    if (isControlled && onTabChange && newTabId) {
      onTabChange(newTabId);
    } else {
      setInternalSelectedTab(newIndex);
    }
    setHeaderFocused(true);
  };
  const t6 = !hidden && !disableNavigation && headerFocused;
  const t7 = {
      context: "Tabs",
      isActive: t6
    };

  useKeybindings({
    "tabs:next": () => handleTabChange(1),
    "tabs:previous": () => handleTabChange(-1)
  }, t7);
  const t8 = e => {
      if (!headerFocused || !optedIn || hidden) {
        return;
      }
      if (e.key === "down") {
        e.preventDefault();
        setHeaderFocused(false);
      }
    };

  const handleKeyDown = t8;
  const t9 = navFromContent && !headerFocused && optedIn && !hidden && !disableNavigation;
  const t10 = {
      context: "Tabs",
      isActive: t9
    };

  useKeybindings({
    "tabs:next": () => {
      handleTabChange(1);
      setHeaderFocused(true);
    },
    "tabs:previous": () => {
      handleTabChange(-1);
      setHeaderFocused(true);
    }
  }, t10);
  const titleWidth = title ? stringWidth(title) + 1 : 0;
  const tabsWidth = tabs.reduce(_temp4, 0);
  const usedWidth = titleWidth + tabsWidth;
  const spacerWidth = useFullWidth ? Math.max(0, terminalWidth - usedWidth) : 0;
  const contentWidth = useFullWidth ? terminalWidth : undefined;
  const T0 = Box;
  const t11 = "column";
  const t12 = 0;
  const t13 = true;
  const t14 = modalScrollRef ? 0 : undefined;
  const t15 = !hidden && <Box flexDirection="row" gap={1} flexShrink={modalScrollRef ? 0 : undefined}>{title !== undefined && <Text bold={true} color={color}>{title}</Text>}{tabs.map((t16, i) => {
      const [id, title_0] = t16;
      const isCurrent = selectedTabIndex === i;
      const hasColorCursor = color && isCurrent && headerFocused;
      return <Text key={id} backgroundColor={hasColorCursor ? color : undefined} color={hasColorCursor ? "inverseText" : undefined} inverse={isCurrent && !hasColorCursor} bold={isCurrent}>{" "}{title_0}{" "}</Text>;
    })}{spacerWidth > 0 && <Text>{" ".repeat(spacerWidth)}</Text>}</Box>;
  const t17 = modalScrollRef ? <Box width={contentWidth} marginTop={hidden ? 0 : 1} flexShrink={0}><ScrollBox key={selectedTabIndex} ref={modalScrollRef} flexDirection="column" flexShrink={0}>{children}</ScrollBox></Box> : <Box width={contentWidth} marginTop={hidden ? 0 : 1} height={contentHeight} overflowY={contentHeight !== undefined ? "hidden" : undefined}>{children}</Box>;

  const t18 = <T0 flexDirection={t11} tabIndex={t12} autoFocus={t13} onKeyDown={handleKeyDown} flexShrink={t14}>{t15}{banner}{t17}</T0>;

  return <TabsContext.Provider value={{
    selectedTab: tabs[selectedTabIndex][0],
    width: contentWidth,
    headerFocused,
    focusHeader,
    blurHeader,
    registerOptIn
  }}>{t18}</TabsContext.Provider>;
}
function _temp4(sum, t0) {
  const [, tabTitle] = t0;
  return sum + (tabTitle ? stringWidth(tabTitle) : 0) + 2 + 1;
}
function _temp3(n_0) {
  return n_0 - 1;
}
function _temp2(n) {
  return n + 1;
}
function _temp(child) {
  return [child.props.id ?? child.props.title, child.props.title];
}
type TabProps = {
  title: string;
  id?: string;
  children: React.ReactNode;
};
export function Tab({
    title,
    id,
    children
}: TabProps) {
  const {
    selectedTab,
    width
  } = useContext(TabsContext);
  const insideModal = useIsInsideModal();
  if (selectedTab !== (id ?? title)) {
    return null;
  }
  const t1 = insideModal ? 0 : undefined;
  const t2 = <Box width={width} flexShrink={t1}>{children}</Box>;

  return t2;
}
export function useTabsWidth() {
  const {
    width
  } = useContext(TabsContext);
  return width;
}

/**
 * Opt into header-focus gating. Returns the current header focus state and a
 * callback to hand focus back to the tab row. For a Select, pass
 * `isDisabled={headerFocused}` and `onUpFromFirstItem={focusHeader}`; keep the
 * parent Tabs' initialHeaderFocused at its default so tab/←/→ work on mount.
 *
 * Calling this hook registers a ↓-blurs-header opt-in on mount. Don't call it
 * above an early return that renders static text — ↓ will blur the header with
 * no onUpFromFirstItem to recover. Split the component so the hook only runs
 * when the Select renders.
 */
export function useTabHeaderFocus() {
  const {
    headerFocused,
    focusHeader,
    blurHeader,
    registerOptIn
  } = useContext(TabsContext);
  const t0 = [registerOptIn];

  useEffect(registerOptIn, t0);
  const t1 = {
      headerFocused,
      focusHeader,
      blurHeader
    };

  return t1;
}
