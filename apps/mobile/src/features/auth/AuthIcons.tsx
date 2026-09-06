import { Eye, EyeOff, Globe, PanelsTopLeft } from 'lucide-react-native';

export function EyeIcon({ hidden = false }: { hidden?: boolean }) {
  const Icon = hidden ? EyeOff : Eye;
  return <Icon size={21} color="#4F46E5" strokeWidth={2} />;
}

// Lucide deliberately has no third-party brand logos. These use its closest
// provider metaphors while keeping every app icon within the Lucide set.
export function GoogleIcon() {
  return <Globe size={19} color="#4285F4" strokeWidth={2.25} />;
}

export function MicrosoftIcon() {
  return <PanelsTopLeft size={19} color="#00A4EF" strokeWidth={2.25} />;
}
