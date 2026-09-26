import ExpoModulesCore
import CoreBluetooth
import Network

private final class PrinterBleTransport: NSObject, CBCentralManagerDelegate, CBPeripheralDelegate {
  private let queue = DispatchQueue(label: "com.indyzai.printing.ble")
  private var central: CBCentralManager!
  private var scanPromise: Promise?
  private var discovered: [UUID: CBPeripheral] = [:]
  private var writePromise: Promise?
  private var writeId: UUID?
  private var peripheral: CBPeripheral?
  private var bytes = Data()
  private var offset = 0
  private var serviceUuid: CBUUID?
  private var characteristicUuid: CBUUID?

  override init() {
    super.init()
    central = CBCentralManager(delegate: self, queue: queue)
  }

  func scan(_ promise: Promise) {
    queue.async {
      guard self.scanPromise == nil && self.writePromise == nil else {
        promise.reject("PRINTER_BUSY", "Finish the current Bluetooth operation first.")
        return
      }
      self.scanPromise = promise
      self.discovered.removeAll()
      if self.central.state == .poweredOn { self.beginScan() }
      else if self.central.state != .unknown && self.central.state != .resetting {
        self.finishScan(error: "Enable Bluetooth and allow printer access in Settings.")
      }
    }
  }

  private func beginScan() {
    central.scanForPeripherals(withServices: nil, options: [CBCentralManagerScanOptionAllowDuplicatesKey: false])
    queue.asyncAfter(deadline: .now() + 6) { [weak self] in self?.finishScan(error: nil) }
  }

  private func finishScan(error: String?) {
    guard let promise = scanPromise else { return }
    central.stopScan()
    scanPromise = nil
    if let error { promise.reject("BLE_UNAVAILABLE", error) }
    else {
      promise.resolve(discovered.values.map { ["name": $0.name ?? "BLE printer", "address": $0.identifier.uuidString] })
    }
  }

  func write(config: [String: Any], data: Data, promise: Promise) {
    queue.async {
      guard self.writePromise == nil && self.scanPromise == nil else {
        promise.reject("PRINTER_BUSY", "Finish the current Bluetooth operation first.")
        return
      }
      guard let address = config["address"] as? String, let identifier = UUID(uuidString: address),
            let service = config["serviceUuid"] as? String, !service.isEmpty,
            let characteristic = config["characteristicUuid"] as? String, !characteristic.isEmpty else {
        promise.reject("BLE_CONFIG", "Select a BLE peripheral and enter its service and writable characteristic UUIDs.")
        return
      }
      let candidate = self.discovered[identifier] ?? self.central.retrievePeripherals(withIdentifiers: [identifier]).first
      guard let candidate else {
        promise.reject("BLE_NOT_FOUND", "Scan for the printer again before printing.")
        return
      }
      self.writePromise = promise
      let id = UUID()
      self.writeId = id
      self.peripheral = candidate
      self.bytes = data
      self.offset = 0
      self.serviceUuid = CBUUID(string: service)
      self.characteristicUuid = CBUUID(string: characteristic)
      candidate.delegate = self
      if self.central.state == .poweredOn { self.central.connect(candidate) }
      else if self.central.state != .unknown && self.central.state != .resetting {
        self.finishWrite(error: "Bluetooth is unavailable.")
      }
      self.queue.asyncAfter(deadline: .now() + 30) { [weak self] in
        if self?.writeId == id { self?.finishWrite(error: "BLE transmission timed out; check the printer before retrying.") }
      }
    }
  }

  private func finishWrite(error: String?) {
    guard let promise = writePromise else { return }
    let sent = bytes.count
    writePromise = nil
    writeId = nil
    if let peripheral { central.cancelPeripheralConnection(peripheral) }
    peripheral = nil
    bytes = Data()
    if let error { promise.reject("PRINT_UNCERTAIN", error) }
    else { promise.resolve(["bytesWritten": sent]) }
  }

  func centralManagerDidUpdateState(_ central: CBCentralManager) {
    if central.state == .poweredOn {
      if scanPromise != nil { beginScan() }
      if writePromise != nil, let peripheral { central.connect(peripheral) }
    } else if central.state != .unknown && central.state != .resetting {
      finishScan(error: "Bluetooth is unavailable or permission was denied.")
      finishWrite(error: "Bluetooth became unavailable; check the printer before retrying.")
    }
  }
  func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral,
                      advertisementData: [String: Any], rssi RSSI: NSNumber) {
    discovered[peripheral.identifier] = peripheral
  }
  func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
    peripheral.discoverServices(serviceUuid.map { [$0] })
  }
  func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
    finishWrite(error: error?.localizedDescription ?? "Could not connect to BLE printer.")
  }
  func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
    if writePromise != nil { finishWrite(error: error?.localizedDescription ?? "BLE printer disconnected during transmission.") }
  }
  func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
    if let error { finishWrite(error: error.localizedDescription); return }
    guard let service = peripheral.services?.first(where: { $0.uuid == serviceUuid }) else {
      finishWrite(error: "Configured BLE service was not found on this printer."); return
    }
    peripheral.discoverCharacteristics(characteristicUuid.map { [$0] }, for: service)
  }
  func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
    if let error { finishWrite(error: error.localizedDescription); return }
    guard let characteristic = service.characteristics?.first(where: { $0.uuid == characteristicUuid }),
          characteristic.properties.contains(.write) else {
      finishWrite(error: "Configured BLE characteristic must support writes with response."); return
    }
    sendNext(peripheral, characteristic)
  }
  private func sendNext(_ peripheral: CBPeripheral, _ characteristic: CBCharacteristic) {
    guard writePromise != nil else { return }
    if offset >= bytes.count { finishWrite(error: nil); return }
    let limit = max(1, min(peripheral.maximumWriteValueLength(for: .withResponse), 512))
    let end = min(bytes.count, offset + limit)
    let chunk = bytes.subdata(in: offset..<end)
    offset = end
    peripheral.writeValue(chunk, for: characteristic, type: .withResponse)
  }
  func peripheral(_ peripheral: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
    if let error { finishWrite(error: error.localizedDescription) }
    else { sendNext(peripheral, characteristic) }
  }
}

public class IndyzPrinterModule: Module {
  private let ble = PrinterBleTransport()
  public func definition() -> ModuleDefinition {
    Name("IndyzPrinter")
    AsyncFunction("listUsb") { () -> [[String: Any]] in [] }
    AsyncFunction("requestUsbPermission") { (_: String) -> Bool in false }
    AsyncFunction("listBluetooth") { (promise: Promise) in self.ble.scan(promise) }
    AsyncFunction("write") { (config: [String: Any], encoded: String, promise: Promise) in
      guard let data = Data(base64Encoded: encoded), !data.isEmpty, data.count <= 1_048_576 else {
        promise.reject("PRINT_DATA", "Print job must be between 1 byte and 1 MB."); return
      }
      switch config["connection"] as? String {
      case "bluetooth": self.ble.write(config: config, data: data, promise: promise)
      case "network": self.writeNetwork(config: config, data: data, promise: promise)
      default: promise.reject("UNSUPPORTED_TRANSPORT", "iOS supports BLE and raw network printers. Generic USB host access is unavailable.")
      }
    }
  }

  private func writeNetwork(config: [String: Any], data: Data, promise: Promise) {
    guard let host = config["address"] as? String, !host.isEmpty,
          let port = config["port"] as? Int, (1...65535).contains(port),
          let endpointPort = NWEndpoint.Port(rawValue: UInt16(port)) else {
      promise.reject("PRINTER_ADDRESS", "Enter a printer hostname and TCP port."); return
    }
    let queue = DispatchQueue(label: "com.indyzai.printing.network")
    let connection = NWConnection(host: NWEndpoint.Host(host), port: endpointPort, using: .tcp)
    var finished = false
    func complete(_ error: String?) {
      guard !finished else { return }
      finished = true
      connection.cancel()
      if let error { promise.reject("PRINT_UNCERTAIN", "Check printer output before retrying. \(error)") }
      else { promise.resolve(["bytesWritten": data.count]) }
    }
    connection.stateUpdateHandler = { state in
      switch state {
      case .ready:
        connection.send(content: data, completion: .contentProcessed { error in
          queue.async { complete(error?.localizedDescription) }
        })
      case .failed(let error): complete(error.localizedDescription)
      case .cancelled: if !finished { complete("Connection closed during transmission.") }
      default: break
      }
    }
    connection.start(queue: queue)
    queue.asyncAfter(deadline: .now() + 20) { complete("Network transmission timed out.") }
  }
}
