Pod::Spec.new do |s|
  s.name = 'AttachmentFileInstaller'
  s.version = '1.0.0'
  s.summary = 'OpenPOS generation-bound attachment file installer'
  s.description = 'Crash-recoverable native installer for app-private OpenPOS attachment files.'
  s.homepage = 'https://github.com/dongdongbh/OpenPOS'
  s.license = { type: 'AGPL-3.0-only' }
  s.author = { 'OpenPOS' => 'dongdongli@dongdongli.com' }
  s.platform = :ios, '15.1'
  s.swift_version = '5.0'
  s.source = { git: 'https://github.com/dongdongbh/OpenPOS.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  # Keep the Swift Package test manifest and XCTest sources out of the pod.
  s.source_files = 'AttachmentFileInstallerModule.swift'
end
