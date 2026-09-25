import type { LucideIcon } from "lucide-react-native";

export type NavigationItemConfig<Destination> = {
    label: string;
    icon: LucideIcon;
    href: Destination;
};

/** Apps own routing and access policy; shared views render the supplied items. */
export type NavigationViewProps<Destination> = {
    isActive: (href: Destination) => boolean;
    onNavigate: (href: Destination) => void;
};
