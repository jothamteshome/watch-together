import { vi } from "vitest";


type Listener = (payload: never) => unknown;


/**
 * Stands in for the socket.io-client singleton in src/services/socket.ts.
 * Outbound traffic is recorded on `emit`; inbound server events are delivered with `receive`.
 */
export class FakeSocket {
    id = "self-socket-id";
    connected = false;
    readonly emit = vi.fn<(event: string, payload?: unknown) => void>();
    readonly connect = vi.fn<() => void>();
    private listeners = new Map<string, Listener[]>();


    on(event: string, listener: Listener): this {
        this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
        return this;
    }


    once(event: string, listener: Listener): this {
        const wrapper: Listener = (payload) => {
            this.off(event, wrapper);
            return listener(payload);
        };
        return this.on(event, wrapper);
    }


    /** Like socket.io-client, omitting `listener` removes every listener for `event` */
    off(event: string, listener?: Listener): this {
        if (!listener) this.listeners.delete(event);
        else this.listeners.set(event, (this.listeners.get(event) ?? []).filter(l => l !== listener));
        return this;
    }


    /** Delivers a server event to every listener; resolves once all of them (including async ones) settle */
    receive(event: string, payload?: unknown): Promise<unknown[]> {
        const listeners = [...(this.listeners.get(event) ?? [])];
        return Promise.all(listeners.map(listener => listener(payload as never)));
    }


    /** Payloads of every `event` this client has emitted, in order */
    emitted(event: string): unknown[] {
        return this.emit.mock.calls.filter(([name]) => name === event).map(([, payload]) => payload);
    }


    reset(): void {
        this.listeners.clear();
        this.emit.mockReset();
        this.connect.mockReset();
        this.connected = false;
    }
}


export const socket = new FakeSocket();
