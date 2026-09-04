import { describe, expect, it } from 'vitest';

const fs = require('fs');
const path = require('path');
const plugin = require('./ios-widgets-and-shortcuts');

const {
  APP_INTENTS_FOLDER,
  SIRI_CAPTURE_SHORTCUTS_PROVIDER,
  SPOTLIGHT_INDEXER,
  addSiriShortcutsRegistrationToAppDelegate,
  collectSwiftFiles,
  ensureSourceFileInTarget,
} = plugin.__testables;

describe('ios-widgets-and-shortcuts', () => {
  it('ships App Intents sources for Siri Inbox capture and v1 Shortcuts actions', () => {
    const sourceDir = path.resolve(__dirname, '..', APP_INTENTS_FOLDER);
    const source = fs.readFileSync(
      path.join(sourceDir, 'OpenPOSSiriCaptureIntents.swift'),
      'utf8'
    );

    expect(collectSwiftFiles(sourceDir)).toContain('OpenPOSSiriCaptureIntents.swift');
    expect(source).toContain('struct OpenPOSSiriCaptureIntent: AppIntent');
    expect(source).toContain('struct OpenPOSOpenListIntent: AppIntent');
    expect(source).toContain('enum OpenPOSShortcutList: String, AppEnum');
    expect(source).toContain('struct OpenPOSSiriCaptureShortcuts: AppShortcutsProvider');
    expect(source).toContain('"Capture in \\(.applicationName)"');
    const phraseBlock = source.match(/phrases:\s*\[[\s\S]*?\]/)?.[0] ?? '';
    expect(phraseBlock).not.toContain('\\(\\.$task)');
    expect(source).toContain('openpos');
    expect(source).toContain('/capture');
    expect(source).toContain('/open-feature');
    expect(source).toContain('requestId');
    expect(source).toContain('UUID().uuidString');
    expect(source).toContain('@Parameter(title: "Project")');
    expect(source).toContain('@Parameter(title: "Tags")');
    expect(source).toContain('URLQueryItem(name: "project"');
    expect(source).toContain('URLQueryItem(name: "tags"');
    expect(source).toContain('case focus');
    expect(source).toContain('case review');
    expect(source).toContain('@Parameter(title: "List", default: OpenPOSShortcutList.inbox)');
    expect(source).toContain('var list: OpenPOSShortcutList');
    expect(source).not.toContain('var list: OpenPOSShortcutList = .inbox');
    expect(source).toContain('.foreground(.immediate)');
  });

  it('ships a background capture intent that only writes the pending-captures queue', () => {
    const sourceDir = path.resolve(__dirname, '..', APP_INTENTS_FOLDER);
    const source = fs.readFileSync(
      path.join(sourceDir, 'OpenPOSSiriCaptureIntents.swift'),
      'utf8'
    );

    expect(source).toContain('struct OpenPOSBackgroundCaptureIntent: AppIntent');
    expect(source).toContain('"pending-captures"');

    const backgroundIntent = source.slice(source.indexOf('struct OpenPOSBackgroundCaptureIntent'));
    // Background capture must never foreground the app or open deep links.
    expect(backgroundIntent).toContain('.background');
    expect(backgroundIntent).not.toContain('.foreground');
    expect(backgroundIntent).not.toContain('UIApplication');
    expect(backgroundIntent).not.toContain('OpenPOSSiriCaptureLauncher.open');

    // No SQLite or store writes from Swift: the queue file is the only output.
    expect(source).not.toContain('sqlite');
    expect(source).not.toContain('SQLite');
  });

  it('renames the background capture intent to "Add to OpenPOS" with due/start date params (#980 stage 1)', () => {
    const sourceDir = path.resolve(__dirname, '..', APP_INTENTS_FOLDER);
    const source = fs.readFileSync(
      path.join(sourceDir, 'OpenPOSSiriCaptureIntents.swift'),
      'utf8'
    );
    const backgroundIntent = source.slice(
      source.indexOf('struct OpenPOSBackgroundCaptureIntent'),
      source.indexOf('// MARK: - Shortcuts snapshot')
    );

    expect(backgroundIntent).toContain('static var title: LocalizedStringResource = "Add to OpenPOS"');
    expect(backgroundIntent).toContain('@Parameter(title: "Due date")');
    expect(backgroundIntent).toContain('var dueDate: Date?');
    expect(backgroundIntent).toContain('@Parameter(title: "Start date")');
    expect(backgroundIntent).toContain('var startDate: Date?');
    expect(backgroundIntent).toContain('\\.$dueDate');
    expect(backgroundIntent).toContain('\\.$startDate');
    expect(backgroundIntent).toContain('dueDate: dueDate');
    expect(backgroundIntent).toContain('startDate: startDate');
    expect(backgroundIntent).toContain('"Added to OpenPOS."');
    // The dialog must not promise a specific project placement -- the drain
    // decides that, and an unknown project falls back to Inbox.
    expect(backgroundIntent).not.toMatch(/dialog:\s*"[^"]*Inbox[^"]*"/);
  });

  it('ships a background, read-only Get OpenPOS Tasks intent over the shortcuts snapshot (#980 stage 2)', () => {
    const sourceDir = path.resolve(__dirname, '..', APP_INTENTS_FOLDER);
    const source = fs.readFileSync(
      path.join(sourceDir, 'OpenPOSSiriCaptureIntents.swift'),
      'utf8'
    );

    expect(source).toContain('struct OpenPOSGetTasksIntent: AppIntent');
    expect(source).toContain('enum OpenPOSGetTasksList: String, AppEnum');
    expect(source).toContain('openpos-ios-shortcuts-snapshot');
    expect(source).toContain('UserDefaults(suiteName: appGroup)');

    // The store's `items(forList:)` takes the iOS 16-only `OpenPOSGetTasksList`
    // while the deployment target is 15.1 -- the enclosing enum must carry an
    // iOS 16 guard or this is a hard compile error the CI validator can't
    // catch (it only checks IntentModes/phrases/@Parameter defaults, not
    // signature availability).
    expect(source).toContain('@available(iOS 16.0, *)\nprivate enum OpenPOSShortcutsSnapshotStore');

    const getTasksIntent = source.slice(source.indexOf('struct OpenPOSGetTasksIntent'));
    const getTasksIntentBody = getTasksIntent.slice(0, getTasksIntent.indexOf('\n}\n'));
    expect(getTasksIntentBody).toContain('.background');
    expect(getTasksIntentBody).not.toContain('.foreground');
    expect(getTasksIntentBody).not.toContain('UIApplication');
    // The intent must never touch the store or SQLite -- it only reads the
    // app-maintained snapshot.
    expect(getTasksIntentBody).not.toContain('sqlite');
    expect(getTasksIntentBody).not.toContain('SQLite');
  });

  it('ships a Task entity (iOS 16+) with IndexedEntity Spotlight indexing guarded to iOS 18+ (#980 stage 3)', () => {
    const sourceDir = path.resolve(__dirname, '..', APP_INTENTS_FOLDER);
    const source = fs.readFileSync(
      path.join(sourceDir, 'OpenPOSSiriCaptureIntents.swift'),
      'utf8'
    );

    expect(source).toContain('@available(iOS 16.0, *)\nstruct OpenPOSTaskEntity: AppEntity');
    expect(source).toContain('static var defaultQuery = OpenPOSTaskEntityQuery()');
    expect(source).toContain('struct OpenPOSTaskEntityQuery: EntityStringQuery');
    expect(source).toContain('@available(iOS 18.0, *)\nextension OpenPOSTaskEntity: IndexedEntity');
    expect(source).toContain('CSSearchableIndex.default().indexAppEntities(');
    expect(source).toContain('@available(iOS 18.0, *)\nenum OpenPOSShortcutsSpotlightIndexer');

    // Reindexing must be driven by the app's refresh path, never by an
    // intent's perform().
    const getTasksIntent = source.slice(
      source.indexOf('struct OpenPOSGetTasksIntent'),
      source.indexOf('enum OpenPOSShortcutsSpotlightIndexer')
    );
    expect(getTasksIntent).not.toContain('reindexIfNeeded');

    // Get Tasks: a project override must be stated in the summary, not just
    // implemented, per the complete-sentence rule.
    expect(getTasksIntent).toContain('overridden by \\(\\.$project) if set');

    // Fixed-format date parsing/formatting needs a fixed locale (Apple
    // QA1480) or non-ASCII digit locales silently drop the date on the RN
    // drain side.
    expect(source).toContain('formatter.locale = Locale(identifier: "en_US_POSIX")');

    // Spotlight must clear stale entries before reindexing -- indexAppEntities
    // is additive and never removes completed/deleted/capped-out tasks on its
    // own.
    const spotlightIndexer = source.slice(source.indexOf('enum OpenPOSShortcutsSpotlightIndexer'));
    const deleteIndex = spotlightIndexer.indexOf('deleteAllSearchableItems');
    const indexEntities = spotlightIndexer.indexOf('indexAppEntities(entities)');
    expect(deleteIndex).toBeGreaterThan(-1);
    expect(indexEntities).toBeGreaterThan(deleteIndex);
  });

  it('wires Spotlight reindexing into AppDelegate launch, guarded to iOS 18+, idempotently', () => {
    const appDelegate = `public class AppDelegate: ExpoAppDelegate {
  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    bindReactNativeFactory(factory)

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
`;

    const patched = addSiriShortcutsRegistrationToAppDelegate(appDelegate);

    expect(patched).toContain('if #available(iOS 18.0, *)');
    expect(patched).toContain(`${SPOTLIGHT_INDEXER}.reindexIfNeeded()`);
    expect(addSiriShortcutsRegistrationToAppDelegate(patched)).toBe(patched);
  });

  it('registers App Shortcuts from AppDelegate idempotently', () => {
    const appDelegate = `public class AppDelegate: ExpoAppDelegate {
  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    bindReactNativeFactory(factory)

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
`;

    const patched = addSiriShortcutsRegistrationToAppDelegate(appDelegate);

    expect(patched).toContain('if #available(iOS 16.0, *)');
    expect(patched).toContain(`${SIRI_CAPTURE_SHORTCUTS_PROVIDER}.updateAppShortcutParameters()`);
    expect(addSiriShortcutsRegistrationToAppDelegate(patched)).toBe(patched);
  });

  it('adds App Intents Swift files to the main target once', () => {
    const calls = [];
    const xcodeProject = {
      hasFile: (filePath) => filePath === 'OpenPOS/Existing.swift',
      addSourceFile: (...args) => calls.push(args),
    };

    expect(ensureSourceFileInTarget(xcodeProject, {
      filePath: 'OpenPOS/OpenPOSSiriCaptureIntents.swift',
      groupKey: 'MAIN_GROUP',
      targetUuid: 'MAIN_TARGET',
    })).toBe(true);
    expect(ensureSourceFileInTarget(xcodeProject, {
      filePath: 'OpenPOS/Existing.swift',
      groupKey: 'MAIN_GROUP',
      targetUuid: 'MAIN_TARGET',
    })).toBe(false);

    expect(calls).toEqual([
      [
        'OpenPOS/OpenPOSSiriCaptureIntents.swift',
        { target: 'MAIN_TARGET' },
        'MAIN_GROUP',
      ],
    ]);
  });
});
