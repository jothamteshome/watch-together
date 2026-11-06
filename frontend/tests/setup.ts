import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { socket } from "./fakeSocket";


// jsdom has no layout engine and doesn't implement scrollIntoView
Element.prototype.scrollIntoView = () => {};


afterEach(() => {
    cleanup();
    socket.reset();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});
