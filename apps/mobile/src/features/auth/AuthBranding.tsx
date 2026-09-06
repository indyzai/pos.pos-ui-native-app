import { LinearGradient } from 'expo-linear-gradient';
import { Moon, Sparkles, Sun } from 'lucide-react-native';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { PosLogo } from '../../components/branding/PosLogo';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppPressable } from '../../components/ui/AppPressable';

export function AuthBranding({
  title,
  subtitle,
  fullScreen = false,
}: {
  title: string;
  subtitle: string;
  fullScreen?: boolean;
}) {
  const { width, height } = useWindowDimensions();
  const { isDark } = useAppTheme();
  const isWide = width >= 768 && height >= 600 && width > height;
  const isCompactLandscape = width > height && height < 600;
  const mobileColors = isDark
    ? (['#071B42', '#182C72', '#3D2474'] as const)
    : (['#0E3A8A', '#3446B8', '#6D3CC6'] as const);
  const wideColors = isDark
    ? (['#041630', '#17275F', '#34205E'] as const)
    : (['#082C69', '#233FAD', '#6633B8'] as const);

  if (!isWide) {
    const header = (
      <>
        <View style={[s.orb, s.mobileOrb]} />
        <ThemeToggle />
        <View style={[s.mobileLayout, isCompactLandscape && s.landscapeLayout]}>
          <BrandLockup compact />
          <View style={[s.mobileCopy, isCompactLandscape && s.landscapeCopy]}>
            <Text style={[s.mobileTitle, isCompactLandscape && s.landscapeTitle]}>{title}</Text>
            <Text style={[s.mobileSubtitle, isCompactLandscape && s.landscapeSubtitle]}>{subtitle}</Text>
          </View>
        </View>
      </>
    );

    if (fullScreen) {
      return (
        <>
          <LinearGradient
            colors={mobileColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.mobileFullBackground}
          />
          <View
            pointerEvents="box-none"
            style={[s.mobileHeaderOverlay, isCompactLandscape && s.landscapeRoot]}
          >
            {header}
          </View>
        </>
      );
    }

    return (
      <LinearGradient
        colors={mobileColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.mobileRoot, isCompactLandscape && s.landscapeRoot]}
      >
        {header}
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={wideColors}
      locations={[0, 0.5, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={s.root}
    >
      <View style={[s.glow, s.glowTop]} />
      <View style={[s.glow, s.glowBottom]} />
      <View style={[s.orb, s.orbOne]} />
      <View style={[s.orb, s.orbTwo]} />
      <View style={[s.orb, s.orbThree]} />
      <ThemeToggle />
      <BrandLockup />
      <View style={s.content}>
        <View style={s.eyebrow}>
          <Sparkles size={15} color="#C7D2FE" strokeWidth={2.5} />
          <Text style={s.eyebrowText}>BUSINESS, SIMPLIFIED</Text>
        </View>
        <Text style={s.title}>{title}</Text>
        <Text style={s.subtitle}>{subtitle}</Text>
        <View style={s.visual}>
          <View style={s.visualTop}>
            <View style={s.visualDot} />
            <Text style={s.visualTitle}>Your business at a glance</Text>
          </View>
          <View style={s.chart}>
            <View style={[s.bar, { height: 38 }]} />
            <View style={[s.bar, { height: 66 }]} />
            <View style={[s.bar, { height: 48 }]} />
            <View style={[s.bar, { height: 92 }]} />
            <View style={[s.bar, { height: 76 }]} />
          </View>
          <View style={s.metric}>
            <Text style={s.metricCaption}>TODAY’S SALES</Text>
            <Text style={s.metricValue}>₹ 24,850</Text>
            <View style={s.metricPill}>
              <Text style={s.metricPillText}>↑ 18.4%</Text>
            </View>
          </View>
        </View>
        <View style={s.valueRow}>
          <ValuePill label="SELL" />
          <ValuePill label="MANAGE" />
          <ValuePill label="GROW" />
        </View>
      </View>
      <Text style={s.footer}>Made for the people building what’s next</Text>
    </LinearGradient>
  );
}

function ThemeToggle() {
  const { mode, setMode } = useAppTheme();
  const Icon = mode === 'light' ? Moon : Sun;
  return (
    <AppPressable
      accessibilityRole="button"
      accessibilityLabel={mode === 'light' ? 'Use dark theme' : 'Use light theme'}
      onPress={() => setMode(mode === 'light' ? 'dark' : 'light')}
      style={s.themeToggle}
    >
      <Icon size={18} color="#FFFFFF" strokeWidth={2.3} />
    </AppPressable>
  );
}

function ValuePill({ label }: { label: string }) {
  return (
    <View style={s.valuePill}>
      <View style={s.valueDot} />
      <Text style={s.valueText}>{label}</Text>
    </View>
  );
}

function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[s.brand, compact && s.mobileBrand]}>
      <PosLogo size={compact ? 34 : 43} />
      <View>
        <Text style={[s.brandName, compact && s.mobileBrandName]}>INDYZ POS</Text>
        <Text style={s.brandTagline}>SMARTER BUSINESS, EVERY DAY</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden', padding: 38 },
  mobileRoot: {
    minHeight: 174,
    overflow: 'hidden',
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
  },
  mobileLayout: { zIndex: 1 },
  mobileCopy: { marginTop: 28 },
  landscapeRoot: { minHeight: 112, paddingTop: 16, paddingBottom: 14, justifyContent: 'center' },
  landscapeLayout: { flexDirection: 'row', alignItems: 'center', gap: 28, paddingRight: 50 },
  landscapeCopy: { flex: 1, marginTop: 0 },
  mobileFullBackground: { ...StyleSheet.absoluteFill, zIndex: 0 },
  mobileHeaderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    minHeight: 174,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    zIndex: 2,
  },
  themeToggle: {
    position: 'absolute',
    top: 26,
    right: 24,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.24)',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 11, zIndex: 1 },
  mobileBrand: { gap: 9 },
  brandName: { color: '#fff', fontSize: 20, letterSpacing: 1.2, fontWeight: '900' },
  mobileBrandName: { fontSize: 16, letterSpacing: 0.9 },
  brandTagline: {
    color: 'rgba(255,255,255,.67)',
    fontSize: 7,
    letterSpacing: 1.15,
    fontWeight: '800',
    marginTop: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 36,
    zIndex: 1,
  },
  eyebrow: {
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(199,210,254,.12)',
    borderWidth: 1,
    borderColor: 'rgba(199,210,254,.22)',
    marginBottom: 20,
  },
  eyebrowText: { color: '#C7D2FE', fontSize: 10, letterSpacing: 1.3, fontWeight: '800' },
  title: {
    color: '#fff',
    fontSize: 39,
    lineHeight: 47,
    fontWeight: '800',
    textAlign: 'center',
    maxWidth: 430,
  },
  subtitle: {
    color: 'rgba(255,255,255,.8)',
    fontSize: 16,
    lineHeight: 25,
    textAlign: 'center',
    marginTop: 15,
    maxWidth: 390,
  },
  visual: {
    width: 268,
    borderRadius: 22,
    marginTop: 38,
    padding: 17,
    backgroundColor: 'rgba(255,255,255,.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.2)',
    shadowColor: '#13195A',
    shadowOpacity: 0.32,
    shadowRadius: 22,
    elevation: 8,
  },
  visualTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  visualDot: { height: 8, width: 8, borderRadius: 4, backgroundColor: '#A7F3D0' },
  visualTitle: { color: 'rgba(255,255,255,.92)', fontSize: 11, fontWeight: '700' },
  chart: {
    height: 96,
    paddingHorizontal: 7,
    paddingTop: 4,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,.16)',
  },
  bar: {
    width: 27,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    backgroundColor: 'rgba(199,210,254,.9)',
  },
  metric: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingTop: 15 },
  metricCaption: { color: 'rgba(255,255,255,.6)', fontSize: 8, fontWeight: '800', letterSpacing: 0.8 },
  metricValue: { color: '#fff', fontSize: 18, fontWeight: '800' },
  metricPill: {
    backgroundColor: 'rgba(167,243,208,.18)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
  },
  metricPillText: { color: '#BBF7D0', fontSize: 9, fontWeight: '800' },
  valueRow: { flexDirection: 'row', gap: 8, marginTop: 22 },
  valuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.14)',
  },
  valueDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#A7F3D0' },
  valueText: { color: 'rgba(255,255,255,.84)', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  footer: { color: 'rgba(255,255,255,.48)', fontSize: 11, textAlign: 'center', zIndex: 1 },
  mobileTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  mobileSubtitle: {
    color: 'rgba(255,255,255,.76)',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    maxWidth: 340,
  },
  landscapeTitle: { fontSize: 18, marginTop: 0 },
  landscapeSubtitle: { fontSize: 11, lineHeight: 16, maxWidth: 360 },
  glow: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(147,197,253,.18)' },
  glowTop: { width: 420, height: 420, right: -210, top: -155 },
  glowBottom: { width: 360, height: 360, left: -210, bottom: -100, backgroundColor: 'rgba(196,181,253,.18)' },
  orb: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.13)',
  },
  orbOne: { width: 92, height: 92, top: '23%', left: '11%' },
  orbTwo: { width: 136, height: 136, right: '8%', bottom: '17%' },
  orbThree: { width: 54, height: 54, left: '24%', bottom: '21%' },
  mobileOrb: { width: 190, height: 190, right: -70, top: -94 },
});
