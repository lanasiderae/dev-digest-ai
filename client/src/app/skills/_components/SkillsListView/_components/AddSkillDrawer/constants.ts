import type { IconName } from "../../../../../../vendor/ui/icons";

export const DRAWER_WIDTH = 560;

export const TABS: readonly { key: string; labelKey: string; icon: IconName }[] = [
  { key: "file", labelKey: "drawer.tabs.file", icon: "FileText" },
  { key: "url", labelKey: "drawer.tabs.url", icon: "Link" },
  { key: "community", labelKey: "drawer.tabs.community", icon: "Globe" },
];
