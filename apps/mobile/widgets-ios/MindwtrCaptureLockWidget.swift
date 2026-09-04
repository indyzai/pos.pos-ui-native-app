import AppIntents
import SwiftUI
import WidgetKit

private let openposCaptureLockWidgetKind = "OpenPOSCaptureLockWidget"
private let openposCaptureControlKind = "OpenPOSCaptureControl"

// Lock screen (accessory family) widget that opens quick capture (#1066).
// Reuses OpenPOSTasksWidgetProvider like the Focus lock widget: the payload
// carries the localized capture label and the quick-capture URI, so the
// launcher stays a dumb button whose strings and route live in JS.
struct OpenPOSCaptureLockWidget: Widget {
    let kind: String = openposCaptureLockWidgetKind

    private var families: [WidgetFamily] {
        if #available(iOSApplicationExtension 16.0, *) {
            return [.accessoryRectangular, .accessoryInline, .accessoryCircular]
        }
        return []
    }

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: OpenPOSTasksWidgetProvider()) { entry in
            OpenPOSCaptureLockWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Add Task")
        .description("Open quick capture")
        .supportedFamilies(families)
    }
}

private struct OpenPOSCaptureLockWidgetEntryView: View {
    let entry: OpenPOSTasksWidgetEntry

    var body: some View {
        if #available(iOSApplicationExtension 16.0, *) {
            OpenPOSCaptureLockView(entry: entry)
        } else {
            EmptyView()
        }
    }
}

// Lock screen widgets render in the system's monochrome/vibrant style, so the
// theme palette deliberately does not apply here.
@available(iOSApplicationExtension 16.0, *)
private struct OpenPOSCaptureLockView: View {
    let entry: OpenPOSTasksWidgetEntry
    @Environment(\.widgetFamily) private var widgetFamily

    var body: some View {
        content
            .widgetURL(URL(string: entry.payload.quickCaptureUri) ?? URL(fileURLWithPath: "/"))
            .openposCaptureLockWidgetBackground()
    }

    @ViewBuilder
    private var content: some View {
        switch widgetFamily {
        case .accessoryInline:
            Label {
                Text(entry.payload.captureLabel)
            } icon: {
                Image(systemName: "plus")
            }

        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                Image(systemName: "plus")
                    .font(.system(size: 20, weight: .semibold))
            }

        default:
            HStack(spacing: 6) {
                Image(systemName: "plus.circle.fill")
                    .font(.system(size: 18, weight: .semibold))
                Text(entry.payload.captureLabel)
                    .font(.system(size: 14, weight: .semibold))
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        }
    }
}

// Control Center / Lock Screen bottom-slot control (iOS 18+): the same
// quick-capture launch as the accessory widget, placeable where the
// flashlight and camera controls live (#1066).
@available(iOSApplicationExtension 18.0, iOS 18.0, *)
struct OpenPOSCaptureControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: openposCaptureControlKind) {
            ControlWidgetButton(action: OpenPOSOpenQuickCaptureIntent()) {
                Label("Add Task", systemImage: "square.and.pencil")
            }
        }
        .displayName("Add Task")
        .description("Open OpenPOS quick capture")
    }
}

// Lives in the widget extension because the control's action must be
// resolvable in this target; the app's Siri capture intents are a separate
// surface and stay in ios-app-intents.
@available(iOSApplicationExtension 18.0, iOS 18.0, *)
struct OpenPOSOpenQuickCaptureIntent: AppIntent {
    static var title: LocalizedStringResource { "Add Task" }
    static var description: IntentDescription { IntentDescription("Opens OpenPOS quick capture.") }

#if compiler(>=6.0)
    @available(iOS 26.0, *)
    static var supportedModes: IntentModes {
        .foreground(.immediate)
    }
#endif

    @available(*, deprecated, message: "Use supportedModes with newer App Intents SDKs.")
    static var openAppWhenRun: Bool {
        true
    }

    @MainActor
    func perform() async throws -> some IntentResult & OpensIntent {
        // The fallback payload is the Swift-side home of the quick-capture URI
        // (mirrors WIDGET_QUICK_CAPTURE_URI in apps/mobile/lib/widget-data.ts).
        let uri = OpenPOSTasksWidgetPayload.fallback.quickCaptureUri
        return .result(opensIntent: OpenURLIntent(URL(string: uri) ?? URL(fileURLWithPath: "/")))
    }
}

private extension View {
    @ViewBuilder
    func openposCaptureLockWidgetBackground() -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            self.containerBackground(for: .widget) { Color.clear }
        } else {
            self
        }
    }
}
