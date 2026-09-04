import { describe, expect, it } from 'vitest';
import {
    isEntityOpenUrl,
    isOpenFeatureUrl,
    isShortcutCaptureUrl,
    parseEntityOpenUrl,
    parseOpenFeatureUrl,
    parseShortcutCaptureUrl,
    resolveOpenFeaturePath,
} from './capture-deeplink';

describe('capture-deeplink', () => {
    it('parses capture URLs with title, note, project, and tags', () => {
        expect(
            parseShortcutCaptureUrl(
                'openpos://capture?title=Buy%20groceries&note=From%20store&project=Shopping&tags=errands,%20home'
            )
        ).toEqual({
            title: 'Buy groceries',
            note: 'From store',
            project: 'Shopping',
            tags: ['errands', 'home'],
        });
    });

    it('accepts triple-slash form and fallback fields', () => {
        expect(parseShortcutCaptureUrl('openpos:///capture?text=Pay%20bill&description=Utility')).toEqual({
            title: 'Pay bill',
            note: 'Utility',
            tags: [],
        });
    });

    it('returns null for unsupported URLs', () => {
        expect(parseShortcutCaptureUrl('https://openpos.app/capture?title=Test')).toBeNull();
        expect(parseShortcutCaptureUrl('openpos://focus')).toBeNull();
        expect(parseShortcutCaptureUrl('openpos://capture?title=')).toBeNull();
    });

    it('trims values and drops empty tags', () => {
        expect(parseShortcutCaptureUrl('openpos://capture?title=%20Task%20&tags=%20alpha%20,%20,%20beta%20')).toEqual({
            title: 'Task',
            tags: ['alpha', 'beta'],
        });
    });

    it('accepts App Actions create-thing parameter names', () => {
        expect(parseShortcutCaptureUrl('openpos:///capture?name=Call%20dentist&description=Tomorrow')).toEqual({
            title: 'Call dentist',
            note: 'Tomorrow',
            tags: [],
        });
    });

    it('detects capture routes even when the payload is invalid', () => {
        expect(isShortcutCaptureUrl('openpos://capture?title=')).toBe(true);
        expect(isShortcutCaptureUrl('openpos:///capture?note=Missing%20title')).toBe(true);
        expect(isShortcutCaptureUrl('openpos://focus')).toBe(false);
        // capture-quick is its own Expo Router route, not a capture payload:
        // no matcher may claim it or it never reaches the screen (#1066).
        expect(isShortcutCaptureUrl('openpos:///capture-quick?mode=text')).toBe(false);
        expect(isOpenFeatureUrl('openpos:///capture-quick?mode=text')).toBe(false);
        expect(isShortcutCaptureUrl('https://openpos.app/capture?title=Test')).toBe(false);
    });

    it('parses and resolves App Actions open-feature URLs', () => {
        expect(isOpenFeatureUrl('openpos:///open-feature?feature=focus')).toBe(true);
        expect(parseOpenFeatureUrl('openpos:///open-feature?feature=waiting')).toEqual({ feature: 'waiting' });
        expect(resolveOpenFeaturePath('today')).toBe('/focus');
        expect(resolveOpenFeaturePath('someday')).toBe('/someday');
        expect(resolveOpenFeaturePath('unknown')).toBe('/inbox');
    });

    it('parses entity-open URLs for task, project, and area (#1017)', () => {
        expect(isEntityOpenUrl('openpos://open?task=abc-123')).toBe(true);
        expect(isEntityOpenUrl('openpos:///open?project=abc-123')).toBe(true);
        expect(isEntityOpenUrl('openpos://open-feature?feature=focus')).toBe(false);
        expect(isEntityOpenUrl('openpos://capture?title=x')).toBe(false);

        expect(parseEntityOpenUrl('openpos://open?task=abc-123')).toEqual({ kind: 'task', id: 'abc-123' });
        expect(parseEntityOpenUrl('openpos:///open?project=proj-1')).toEqual({ kind: 'project', id: 'proj-1' });
        expect(parseEntityOpenUrl('openpos://open?area=area-1')).toEqual({ kind: 'area', id: 'area-1' });
    });

    it('returns null for a malformed or empty entity-open URL', () => {
        expect(parseEntityOpenUrl('openpos://open')).toBeNull();
        expect(parseEntityOpenUrl('openpos://open?task=')).toBeNull();
        expect(parseEntityOpenUrl('https://openpos.app/open?task=abc-123')).toBeNull();
        expect(parseEntityOpenUrl('openpos://focus')).toBeNull();
    });
});
