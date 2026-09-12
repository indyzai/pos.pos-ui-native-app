/** Serializes snapshot and outbox writes so concurrent checkout/sync calls cannot lose data. */
export class SerialQueue {
    private tail: Promise<unknown> = Promise.resolve();

    run<T>(action: () => Promise<T>): Promise<T> {
        const result = this.tail.then(action, action);
        this.tail = result.catch(() => undefined);
        return result;
    }
}
