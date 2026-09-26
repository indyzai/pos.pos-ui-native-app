package com.indyzai.printing

import android.app.PendingIntent
import android.bluetooth.BluetoothManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Base64
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.net.InetSocketAddress
import java.net.Socket
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

class IndyzPrinterModule : Module() {
  private val worker = Executors.newSingleThreadExecutor()
  private val deadlines = Executors.newSingleThreadScheduledExecutor()
  private val permissions = ConcurrentHashMap<String, () -> Unit>()
  private val context get() = requireNotNull(appContext.reactContext) { "Application context unavailable" }
  private val usb get() = context.getSystemService(Context.USB_SERVICE) as UsbManager

  override fun definition() = ModuleDefinition {
    Name("IndyzPrinter")
    AsyncFunction("listUsb") {
      usb.deviceList.values.flatMap { device ->
        (0 until device.interfaceCount).flatMap { index ->
          val intf = device.getInterface(index)
          if (intf.interfaceClass != UsbConstants.USB_CLASS_PRINTER && intf.interfaceClass != UsbConstants.USB_CLASS_VENDOR_SPEC) emptyList()
          else (0 until intf.endpointCount).mapNotNull { epIndex ->
            val endpoint = intf.getEndpoint(epIndex)
            if (endpoint.type != UsbConstants.USB_ENDPOINT_XFER_BULK || endpoint.direction != UsbConstants.USB_DIR_OUT) null
            else mapOf("deviceName" to device.deviceName, "name" to (device.productName ?: "USB printer"),
              "vendorId" to device.vendorId, "productId" to device.productId,
              "interfaceId" to intf.id, "endpointAddress" to endpoint.address)
          }
        }
      }
    }
    AsyncFunction("requestUsbPermission") { deviceName: String, promise: Promise ->
      val manager = usb
      val device = manager.deviceList[deviceName]
      if (device == null) promise.reject("USB_DETACHED", "Reconnect the USB printer and select it again.", null)
      else if (manager.hasPermission(device)) promise.resolve(true)
      else {
        val ctx = context
        val action = ctx.packageName + ".USB_PERMISSION." + UUID.randomUUID()
        val finished = AtomicBoolean(false)
        val handler = Handler(Looper.getMainLooper())
        lateinit var receiver: BroadcastReceiver
        lateinit var timeout: Runnable
        fun finish(allowed: Boolean) {
          if (!finished.compareAndSet(false, true)) return
          handler.removeCallbacks(timeout)
          try { ctx.unregisterReceiver(receiver) } catch (_: Exception) {}
          permissions.remove(action)
          promise.resolve(allowed)
        }
        receiver = object : BroadcastReceiver() {
          override fun onReceive(context: Context, intent: Intent) {
            if (intent.action == action) finish(manager.hasPermission(device))
          }
        }
        timeout = Runnable { finish(false) }
        try {
          if (Build.VERSION.SDK_INT >= 33) ctx.registerReceiver(receiver, IntentFilter(action), Context.RECEIVER_NOT_EXPORTED)
          else { @Suppress("DEPRECATION") ctx.registerReceiver(receiver, IntentFilter(action)) }
          permissions[action] = { finish(false) }
          handler.postDelayed(timeout, 30000)
          val intent = PendingIntent.getBroadcast(ctx, 0, Intent(action).setPackage(ctx.packageName), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
          manager.requestPermission(device, intent)
        } catch (_: Exception) { finish(false) }
      }
    }
    AsyncFunction("listBluetooth") {
      val adapter = (context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager).adapter
      require(adapter != null && adapter.isEnabled) { "Enable Bluetooth and pair the printer in Android Settings." }
      adapter.bondedDevices.map { mapOf("name" to (it.name ?: "Bluetooth printer"), "address" to it.address) }
    }
    AsyncFunction("write") { config: Map<String, Any?>, encoded: String, promise: Promise ->
      worker.execute {
        try {
          val bytes = Base64.decode(encoded, Base64.DEFAULT)
          require(bytes.isNotEmpty() && bytes.size <= 1048576) { "Print job must be between 1 byte and 1 MB." }
          when (config["connection"]) {
            "usb" -> writeUsb(config, bytes)
            "bluetooth" -> writeBluetooth(config, bytes)
            "network" -> writeNetwork(config, bytes)
            else -> error("Unsupported printer connection")
          }
          // Transport acknowledgement only: these devices do not guarantee physical output.
          promise.resolve(mapOf("bytesWritten" to bytes.size))
        } catch (error: Exception) {
          promise.reject("PRINT_UNCERTAIN", "Printer transmission failed; check output before retrying. ${error.message}", error)
        }
      }
    }
    OnDestroy {
      permissions.values.toList().forEach { it() }
      worker.shutdownNow()
      deadlines.shutdown()
    }
  }

  private fun number(config: Map<String, Any?>, key: String) = (config[key] as? Number)?.toInt() ?: error("Missing $key")
  private fun writeUsb(config: Map<String, Any?>, bytes: ByteArray) {
    val manager = usb
    val matches = manager.deviceList.values.filter { it.vendorId == number(config, "vendorId") && it.productId == number(config, "productId") }
    val device = matches.find { it.deviceName == config["deviceName"] }
      ?: matches.singleOrNull() ?: error("USB printer missing or ambiguous. Select the connected device again.")
    require(manager.hasPermission(device)) { "USB permission is required. Connect the printer first." }
    val intf = (0 until device.interfaceCount).map { device.getInterface(it) }.find { it.id == number(config, "interfaceId") }
      ?: error("USB interface not found")
    val endpoint = (0 until intf.endpointCount).map { intf.getEndpoint(it) }.find {
      it.address == number(config, "endpointAddress") && it.type == UsbConstants.USB_ENDPOINT_XFER_BULK && it.direction == UsbConstants.USB_DIR_OUT
    } ?: error("Printer bulk OUT endpoint not found")
    val connection = manager.openDevice(device) ?: error("Unable to open USB printer")
    try {
      require(connection.claimInterface(intf, true)) { "USB printer is in use" }
      var offset = 0
      val expires = SystemClock.elapsedRealtime() + 30000
      while (offset < bytes.size) {
        require(SystemClock.elapsedRealtime() < expires) { "USB transmission timed out" }
        val written = connection.bulkTransfer(endpoint, bytes, offset, minOf(16384, bytes.size - offset), 5000)
        require(written > 0) { "USB transfer interrupted at byte $offset" }
        offset += written
      }
    } finally { connection.releaseInterface(intf); connection.close() }
  }
  private fun writeBluetooth(config: Map<String, Any?>, bytes: ByteArray) {
    val adapter = (context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager).adapter
    require(adapter != null && adapter.isEnabled) { "Bluetooth is disabled" }
    val address = config["address"] as? String ?: error("Bluetooth address missing")
    val device = adapter.bondedDevices.find { it.address.equals(address, true) } ?: error("Pair this printer in Android Settings first")
    val socket = device.createRfcommSocketToServiceRecord(UUID.fromString("00001101-0000-1000-8000-00805F9B34FB"))
    val deadline = deadlines.schedule({ try { socket.close() } catch (_: Exception) {} }, 20000, TimeUnit.MILLISECONDS)
    try { socket.connect(); socket.outputStream.write(bytes); socket.outputStream.flush() }
    finally { deadline.cancel(false); socket.close() }
  }
  private fun writeNetwork(config: Map<String, Any?>, bytes: ByteArray) {
    val socket = Socket()
    val deadline = deadlines.schedule({ try { socket.close() } catch (_: Exception) {} }, 20000, TimeUnit.MILLISECONDS)
    try {
      socket.connect(InetSocketAddress(config["address"] as? String ?: error("Printer host missing"), number(config, "port")), 8000)
      socket.getOutputStream().write(bytes); socket.getOutputStream().flush()
    } finally { deadline.cancel(false); socket.close() }
  }
}
