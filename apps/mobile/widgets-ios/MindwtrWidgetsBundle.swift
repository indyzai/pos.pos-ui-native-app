import WidgetKit
import SwiftUI

@main
struct OpenPOSWidgetsBundle: WidgetBundle {
    var body: some Widget {
        OpenPOSTasksWidget()
        // These two offer no families before iOS 16, so they stay invisible on iOS 15.
        OpenPOSFocusLockWidget()
        OpenPOSCaptureLockWidget()
        if #available(iOSApplicationExtension 18.0, iOS 18.0, *) {
            OpenPOSCaptureControl()
        }
    }
}
