Pod::Spec.new do |s|
  s.name = 'CloudKitSync'
  s.version = '1.0.0'
  s.summary = 'OpenPOS CloudKit sync Expo module'
  s.description = 'CloudKit sync native module used by OpenPOS on iOS.'
  s.homepage = 'https://github.com/indyzai/OpenPOS'
  s.license = { type: 'AGPL-3.0-only' }
  s.author = { 'OpenPOS' => 'dongdongli@dongdongli.com' }
  s.platform = :ios, '15.1'
  s.swift_version = '5.0'
  s.source = { git: 'https://github.com/indyzai/OpenPOS.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.{h,m,swift}'
end
