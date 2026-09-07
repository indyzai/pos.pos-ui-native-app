import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

export function PosLogo({ size = 40 }: { size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      fill="none"
      accessibilityRole="image"
      accessibilityLabel="Indyz POS"
    >
      <Defs>
        <LinearGradient id="posBackground" x1="145" y1="100" x2="879" y2="924" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#6677E8" />
          <Stop offset="0.5" stopColor="#3F51B5" />
          <Stop offset="1" stopColor="#263782" />
        </LinearGradient>
        <LinearGradient id="posPaper" x1="285" y1="215" x2="770" y2="795" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#E8EBFF" />
        </LinearGradient>
      </Defs>
      <Rect x="64" y="64" width="896" height="896" rx="208" fill="url(#posBackground)" />
      <Path
        d="M156 760C156 664 234 586 330 586H694C790 586 868 664 868 760V752C868 840 797 912 709 912H315C227 912 156 840 156 752V760Z"
        fill="#1D2B76"
        fillOpacity="0.28"
      />
      <Path
        d="M292 188C272 188 256 204 256 224V773C256 793 272 809 292 809H343L387 850L431 809L475 850L519 809L563 850L607 809L651 850L695 809H733C753 809 769 793 769 773V224C769 204 753 188 733 188H292Z"
        fill="url(#posPaper)"
      />
      <Path d="M295 188H730C752 188 769 206 769 228V327H256V227C256 205 273 188 295 188Z" fill="#D7DCFF" />
      <Path d="M348 244H676" stroke="#3F51B5" strokeWidth="48" strokeLinecap="round" />
      <Path
        d="M348 426H680M348 509H598M348 592H507"
        stroke="#C0C8F9"
        strokeWidth="38"
        strokeLinecap="round"
      />
      <Circle cx="673" cy="632" r="110" fill="#3F51B5" />
      <Path
        d="M621 633L657 670L729 594"
        stroke="white"
        strokeWidth="38"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="826" cy="198" r="34" fill="#9DAAFF" fillOpacity="0.8" />
    </Svg>
  );
}
