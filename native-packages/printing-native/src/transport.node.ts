import { execFile, spawn } from "node:child_process";
import net from "node:net";
import type {
    BluetoothPrinter,
    PrinterTarget,
    SystemPrinter,
    TransportCapabilities,
    UsbPrinter,
} from "./types";
export type {
    BluetoothPrinter,
    PrinterTarget,
    SystemPrinter,
    TransportCapabilities,
    UsbPrinter,
} from "./types";

const limit = 1_048_576;
const unsupported = (): never => {
    throw new Error(
        "Direct USB and Bluetooth discovery is mobile-only. Install the printer in the operating system and use its print queue.",
    );
};

function command(file: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) =>
        execFile(
            file,
            args,
            { timeout: 10_000, maxBuffer: 256_000, windowsHide: true },
            (error, stdout) => (error ? reject(error) : resolve(stdout)),
        ),
    );
}

const windowsPrinters =
    "Get-CimInstance Win32_Printer | Select-Object Name,PortName | ConvertTo-Json -Compress";
const windowsPrint = `
$ErrorActionPreference = 'Stop'
$job = [Console]::In.ReadToEnd() | ConvertFrom-Json
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class RawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] public struct DOCINFO { public string pDocName; public string pOutputFile; public string pDatatype; }
  [DllImport("winspool.drv", EntryPoint="OpenPrinterW", SetLastError=true, CharSet=CharSet.Unicode)] public static extern bool OpenPrinter(string name, out IntPtr handle, IntPtr defaults);
  [DllImport("winspool.drv", EntryPoint="ClosePrinter", SetLastError=true)] public static extern bool ClosePrinter(IntPtr handle);
  [DllImport("winspool.drv", EntryPoint="StartDocPrinterW", SetLastError=true, CharSet=CharSet.Unicode)] public static extern int StartDocPrinter(IntPtr handle, int level, ref DOCINFO info);
  [DllImport("winspool.drv", EntryPoint="EndDocPrinter", SetLastError=true)] public static extern bool EndDocPrinter(IntPtr handle);
  [DllImport("winspool.drv", EntryPoint="StartPagePrinter", SetLastError=true)] public static extern bool StartPagePrinter(IntPtr handle);
  [DllImport("winspool.drv", EntryPoint="EndPagePrinter", SetLastError=true)] public static extern bool EndPagePrinter(IntPtr handle);
  [DllImport("winspool.drv", EntryPoint="WritePrinter", SetLastError=true)] public static extern bool WritePrinter(IntPtr handle, byte[] data, int count, out int written);
  public static int Print(string name, byte[] data) {
    IntPtr handle; if (!OpenPrinter(name, out handle, IntPtr.Zero)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    try {
      DOCINFO info = new DOCINFO { pDocName="IndyzAI POS", pDatatype="RAW" };
      if (StartDocPrinter(handle, 1, ref info) == 0) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
      try {
        if (!StartPagePrinter(handle)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
        try {
          int written; if (!WritePrinter(handle, data, data.Length, out written) || written != data.Length) throw new Exception("Incomplete spool write");
          return written;
        } finally { EndPagePrinter(handle); }
      } finally { EndDocPrinter(handle); }
    } finally { ClosePrinter(handle); }
  }
}
'@
$bytes = [Convert]::FromBase64String($job.data)
[RawPrinter]::Print([string]$job.name, $bytes)
`;

function feed(
    file: string,
    args: string[],
    input: string | Buffer,
): Promise<string> {
    return new Promise((resolve, reject) => {
        const child = spawn(file, args, {
            stdio: ["pipe", "pipe", "pipe"],
            windowsHide: true,
        });
        const timeout = setTimeout(() => child.kill(), 20_000);
        let output = "",
            errors = "",
            done = false;
        const finish = (error?: Error) => {
            if (done) return;
            done = true;
            clearTimeout(timeout);
            error ? reject(error) : resolve(output);
        };
        child.stdout.on("data", (chunk: Buffer) => {
            output += chunk.toString().slice(0, 4096);
        });
        child.stderr.on("data", (chunk: Buffer) => {
            errors += chunk.toString().slice(0, 4096);
        });
        child.on("error", finish);
        child.on("close", (code) =>
            finish(
                code === 0
                    ? undefined
                    : new Error(
                          errors || `Printer spooler exited with ${code}.`,
                      ),
            ),
        );
        child.stdin.on("error", finish);
        child.stdin.end(input);
    });
}

function tcp(host: string, port: number, bytes: Buffer): Promise<number> {
    return new Promise((resolve, reject) => {
        const socket = net.createConnection({ host, port });
        let done = false;
        const finish = (error?: Error) => {
            if (done) return;
            done = true;
            socket.destroy();
            error ? reject(error) : resolve(bytes.length);
        };
        socket.setTimeout(20_000, () =>
            finish(
                new Error(
                    "Printer network transmission timed out; check output before retrying.",
                ),
            ),
        );
        socket.once("error", finish);
        socket.once("connect", () => socket.end(bytes, () => finish()));
    });
}

export const printerTransport = {
    capabilities(): TransportCapabilities {
        return { usb: false, bluetooth: false, network: true, system: true };
    },
    listUsb: async (): Promise<UsbPrinter[]> => unsupported(),
    listBluetooth: async (): Promise<BluetoothPrinter[]> => unsupported(),
    async listSystemPrinters(): Promise<SystemPrinter[]> {
        if (process.platform === "win32") {
            const output = await command("powershell.exe", [
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                windowsPrinters,
            ]);
            if (!output.trim()) return [];
            const values = JSON.parse(output) as
                | { Name: string; PortName?: string }
                | Array<{ Name: string; PortName?: string }>;
            return (Array.isArray(values) ? values : [values]).map((item) => ({
                name: item.Name,
                detail: item.PortName,
            }));
        }
        if (process.platform === "linux" || process.platform === "darwin") {
            const output = await command("lpstat", ["-v"]);
            return output.split(/\r?\n/).flatMap((line) => {
                const match = /^device for (.+?): (.+)$/.exec(line);
                return match ? [{ name: match[1], detail: match[2] }] : [];
            });
        }
        return [];
    },
    async connect(target: PrinterTarget): Promise<PrinterTarget> {
        if (target.connection === "system") {
            if (
                !target.address?.trim() ||
                !(await this.listSystemPrinters()).some(
                    (printer) => printer.name === target.address,
                )
            )
                throw new Error("Select an installed printer queue.");
        } else if (target.connection === "network") {
            if (
                !target.address?.trim() ||
                !Number.isInteger(target.port) ||
                (target.port ?? 0) < 1 ||
                (target.port ?? 0) > 65535
            )
                throw new Error("Enter a printer hostname and TCP port.");
        } else unsupported();
        return target;
    },
    async write(
        target: PrinterTarget,
        base64: string,
    ): Promise<{ bytesWritten: number }> {
        const bytes = Buffer.from(base64, "base64");
        if (
            !bytes.length ||
            bytes.length > limit ||
            bytes.toString("base64").replace(/=+$/, "") !==
                base64.replace(/=+$/, "")
        )
            throw new Error(
                "Print job must be valid base64 between 1 byte and 1 MB.",
            );
        await this.connect(target);
        if (target.connection === "network")
            return {
                bytesWritten: await tcp(target.address!, target.port!, bytes),
            };
        if (process.platform === "win32") {
            const output = await feed(
                "powershell.exe",
                ["-NoProfile", "-NonInteractive", "-Command", windowsPrint],
                JSON.stringify({ name: target.address, data: base64 }),
            );
            const written = Number(output.trim());
            if (written !== bytes.length)
                throw new Error(
                    "Printer spooler did not accept the complete job.",
                );
            return { bytesWritten: written };
        }
        await feed("lp", ["-d", target.address!, "-o", "raw"], bytes);
        return { bytesWritten: bytes.length };
    },
};
