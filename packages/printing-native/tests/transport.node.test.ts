import { afterEach, expect, test } from "bun:test";
import net from "node:net";
import { printerTransport } from "../src/transport.node";

const servers: net.Server[] = [];
afterEach(() => {
    for (const server of servers.splice(0)) server.close();
});

test("desktop transport reports network and installed queues", () => {
    expect(printerTransport.capabilities()).toEqual({
        usb: false,
        bluetooth: false,
        network: true,
        system: true,
    });
});

test("desktop raw TCP sends exactly the decoded printer bytes", async () => {
    const received = new Promise<Buffer>((resolve) => {
        const server = net.createServer((socket) => {
            const chunks: Buffer[] = [];
            socket.on("data", (chunk) =>
                chunks.push(
                    typeof chunk === "string" ? Buffer.from(chunk) : chunk,
                ),
            );
            socket.on("end", () => resolve(Buffer.concat(chunks)));
        });
        servers.push(server);
        server.listen(0, "127.0.0.1");
    });
    const server = servers[0];
    await new Promise<void>((resolve) =>
        server.listening ? resolve() : server.once("listening", resolve),
    );
    const port = (server.address() as net.AddressInfo).port;
    const payload = Buffer.from([0x1b, 0x40, 0x0a, 0x00]);
    expect(
        await printerTransport.write(
            { connection: "network", address: "127.0.0.1", port },
            payload.toString("base64"),
        ),
    ).toEqual({ bytesWritten: payload.length });
    expect(await received).toEqual(payload);
});

test("desktop rejects unsupported direct devices and malformed jobs", async () => {
    await expect(
        printerTransport.connect({ connection: "usb" }),
    ).rejects.toThrow("operating system");
    await expect(
        printerTransport.connect({
            connection: "network",
            address: "",
            port: 9100,
        }),
    ).rejects.toThrow("hostname");
    await expect(
        printerTransport.write(
            { connection: "network", address: "127.0.0.1", port: 9100 },
            "not base64",
        ),
    ).rejects.toThrow("valid base64");
});
