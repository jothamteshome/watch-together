import { pino, stdTimeFunctions } from "pino";


/**
 * The server's only logger: one JSON object per line on stdout, with an ISO timestamp and a level label.
 * Put client-supplied values in the fields object, never in the message string, so they are escaped.
 * Never log chat text, usernames, icon URLs, user ids or video URLs.
 */
export const logger = pino({
    level: process.env.LOG_LEVEL ?? "info",
    base: null, // no pid or hostname on every line
    timestamp: stdTimeFunctions.isoTime,
    formatters: { level: (label) => ({ level: label }) }
});
