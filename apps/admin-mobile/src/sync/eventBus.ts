type SyncListener = () => void;

const listeners = new Set<SyncListener>();

export const syncEventBus = {
    subscribe(listener: SyncListener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },
    notify() {
        listeners.forEach((listener) => listener());
    },
};
