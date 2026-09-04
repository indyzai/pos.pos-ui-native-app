import { describe, expect, it } from 'vitest';

import {
    isOpenPOSMirrorCalendar,
    mergeExternalCalendarSources,
} from './external-calendar-ingestion';

describe('external calendar ingestion', () => {
    it('recognizes managed OpenPOS calendar names without matching unrelated names', () => {
        expect(isOpenPOSMirrorCalendar({ name: ' OpenPOS Calendar ' })).toBe(true);
        expect(isOpenPOSMirrorCalendar({ name: 'openposcal' })).toBe(true);
        expect(isOpenPOSMirrorCalendar({ name: 'OpenPOS Planning' })).toBe(false);
    });

    it('filters mirrored data, dedupes by event identity, and sorts deterministically', () => {
        const result = mergeExternalCalendarSources([
            {
                calendars: [
                    { id: 'work', name: 'Work', url: 'ics://work', enabled: true },
                    { id: 'mirror', name: 'OpenPOS', url: 'system://mirror', enabled: true },
                ],
                events: [
                    {
                        id: 'event-late',
                        sourceId: 'work',
                        title: 'Later',
                        start: '2026-07-23T15:00:00.000Z',
                        end: '2026-07-23T16:00:00.000Z',
                        allDay: false,
                    },
                    {
                        id: 'event-early',
                        sourceId: 'work',
                        title: 'Early old',
                        start: '2026-07-23T09:00:00.000Z',
                        end: '2026-07-23T10:00:00.000Z',
                        allDay: false,
                    },
                    {
                        id: 'mirrored',
                        sourceId: 'mirror',
                        title: 'Mirrored Task',
                        start: '2026-07-23T08:00:00.000Z',
                        end: '2026-07-23T08:30:00.000Z',
                        allDay: false,
                    },
                    {
                        id: 'pushed',
                        sourceId: 'work',
                        title: 'OpenPOS: Pushed Task',
                        start: '2026-07-23T11:00:00.000Z',
                        end: '2026-07-23T11:30:00.000Z',
                        allDay: false,
                    },
                ],
            },
            {
                calendars: [
                    { id: 'work', name: 'Work renamed', url: 'system://work', enabled: true },
                ],
                events: [
                    {
                        id: 'event-early',
                        sourceId: 'work',
                        title: 'Early',
                        start: '2026-07-23T09:00:00.000Z',
                        end: '2026-07-23T10:00:00.000Z',
                        allDay: false,
                    },
                ],
            },
        ]);

        expect(result.calendars).toEqual([
            { id: 'work', name: 'Work renamed', url: 'system://work', enabled: true },
        ]);
        expect(result.events.map((event) => event.title)).toEqual(['Early', 'Later']);
    });
});
