require 'json'
package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name = 'IndyzPrintingNative'
  s.version = package['version']
  s.summary = 'Local network and BLE printer transport for IndyzAI POS'
  s.description = s.summary
  s.license = { :type => 'MIT' }
  s.author = 'IndyzAI'
  s.homepage = 'https://indyzai.com'
  s.platforms = { :ios => '16.4' }
  s.swift_version = '5.9'
  s.source = { :path => '.' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
  s.frameworks = 'CoreBluetooth', 'Network'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
