import { useState, useSyncExternalStore } from 'react';
import { ScrollView, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { AppPressable } from './AppPressable';
import { clearLogs, formatLogs, getLogs, isLogCaptureEnabled, setLogCaptureEnabled, subscribeToLogs } from '@indyzai/pos-core';

export function DeviceLogViewer({ colors, onMessage }: {
  colors: { text: string; textSecondary: string; background: string; outlineMuted: string; primary: string; primarySoft: string };
  onMessage?: (title: string, message: string) => void;
}) {
  const entries = useSyncExternalStore(subscribeToLogs, getLogs, getLogs);
  const [expanded, setExpanded] = useState(false);
  const [enabled, setEnabled] = useState(isLogCaptureEnabled());
  const toggle = (value: boolean) => { setLogCaptureEnabled(value); setEnabled(value); };
  const copy = async () => {
    const value = formatLogs();
    if (!value) return onMessage?.('Device logs', 'There are no captured logs to copy.');
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
      else await Share.share({ message: value });
      onMessage?.('Logs copied', `${entries.length} log entries are ready to paste.`);
    } catch { onMessage?.('Copy failed', 'The device could not copy the captured logs.'); }
  };
  return <View style={[s.panel, { backgroundColor: colors.background, borderColor: colors.outlineMuted }]}>
    <View style={s.header}><View style={s.copy}><Text style={[s.title, { color: colors.text }]}>Capture device logs</Text><Text style={[s.hint, { color: colors.textSecondary }]}>Console output · up to 500 entries</Text></View><Switch value={enabled} onValueChange={toggle} trackColor={{ false: colors.outlineMuted, true: colors.primarySoft }} thumbColor={enabled ? colors.primary : colors.textSecondary} /></View>
    <AppPressable onPress={() => setExpanded((value) => !value)} style={[s.expand, { borderTopColor: colors.outlineMuted }]}><Text style={[s.title, { color: colors.text }]}>{expanded ? 'Hide logs' : 'Show logs'} ({entries.length})</Text><Text style={[s.action, { color: colors.primary }]}>{expanded ? 'Collapse' : 'Expand'}</Text></AppPressable>
    {expanded ? <View style={{ borderTopColor: colors.outlineMuted, borderTopWidth: StyleSheet.hairlineWidth }}><ScrollView style={s.logs} nestedScrollEnabled><Text selectable style={[s.logText, { color: colors.textSecondary }]}>{formatLogs() || 'No logs captured. Enable capture and reproduce the issue.'}</Text></ScrollView><View style={s.actions}><AppPressable onPress={() => void copy()} style={[s.button, { backgroundColor: colors.primarySoft }]}><Text style={[s.action, { color: colors.primary }]}>Copy logs</Text></AppPressable><AppPressable onPress={clearLogs} style={s.button}><Text style={[s.action, { color: colors.textSecondary }]}>Clear</Text></AppPressable></View></View> : null}
  </View>;
}

const s = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' }, header: { minHeight: 58, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }, copy: { flex: 1 }, title: { fontSize: 12, fontWeight: '900' }, hint: { marginTop: 2, fontSize: 10 }, expand: { minHeight: 46, paddingHorizontal: 14, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, logs: { maxHeight: 260, padding: 12 }, logText: { fontFamily: 'monospace', fontSize: 10, lineHeight: 15 }, actions: { padding: 10, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }, button: { minHeight: 34, paddingHorizontal: 12, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }, action: { fontSize: 11, fontWeight: '900' },
});
