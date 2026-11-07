import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatCount, formatExactCount, formatExactDate, formatRelativeDate } from "../../src/utils/formatVideoInfo";


const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

// Midday UTC, so the calendar date is the same in every timezone the tests might run in
const NOW = Date.UTC(2026, 2, 20, 12);


describe("formatCount", () => {
    it.each([
        { n: 999, precision: 1, expected: "999" },
        { n: 1_000, precision: 1, expected: "1K" },
        { n: 1_500, precision: 1, expected: "1.5K" },
        { n: 1_000_000, precision: 1, expected: "1M" },
        { n: 2_500_000, precision: 1, expected: "2.5M" },
        { n: 1_000_000_000, precision: 1, expected: "1B" },
        { n: 1_234_000_000, precision: 1, expected: "1.2B" },
        { n: 1_500, precision: 0, expected: "2K" },
        { n: 1_050, precision: 2, expected: "1.05K" },
        { n: 1_050_000, precision: 2, expected: "1.05M" },
        { n: 1_050_000_000, precision: 2, expected: "1.05B" }
    ])("formats $n at precision $precision as $expected", ({ n, precision, expected }) => {
        // Act
        const formatted = formatCount(n, precision);

        // Assert
        expect(formatted).toBe(expected);
    });

    it.each([null, undefined, NaN, Infinity])("formats %s as 0", (n) => {
        // Act
        const formatted = formatCount(n, 1);

        // Assert
        expect(formatted).toBe("0");
    });

    it.each([
        { n: 999_999, precision: 1, expected: "1M" },
        { n: 999_500, precision: 0, expected: "1M" },
        { n: 999_999_999, precision: 1, expected: "1B" }
    ])("formats $n at precision $precision as $expected, not 1000 of the smaller unit", ({ n, precision, expected }) => {
        // Act
        const formatted = formatCount(n, precision);

        // Assert
        expect(formatted).toBe(expected);
    });
});


describe("formatExactCount", () => {
    it("keeps every digit of the count", () => {
        // Act: digits only, since the grouping separator depends on the locale
        const digits = formatExactCount(1_234_567).replace(/\D/g, "");

        // Assert
        expect(digits).toBe("1234567");
    });

    it.each([null, undefined, NaN])("formats %s as 0", (n) => {
        // Act
        const formatted = formatExactCount(n);

        // Assert
        expect(formatted).toBe("0");
    });
});


describe("formatExactDate", () => {
    it("shows the day, long month name and year, without a time", () => {
        // Arrange: the month name is locale-dependent, so it comes from Intl rather than a literal.
        // The 15th, because "20" would also match inside the year
        const timestamp = Date.UTC(2026, 0, 15, 12);
        const longMonth = new Intl.DateTimeFormat(undefined, { month: "long" }).format(timestamp);

        // Act
        const formatted = formatExactDate(timestamp);

        // Assert
        expect(formatted).toContain("15");
        expect(formatted).toContain(longMonth);
        expect(formatted).toContain("2026");
        expect(formatted).not.toContain(":");
    });

    it.each([null, undefined, NaN, Infinity, 8.64e15 + 1])("formats %s as an empty string", (timestamp) => {
        // Act
        const formatted = formatExactDate(timestamp);

        // Assert
        expect(formatted).toBe("");
    });
});


describe("formatRelativeDate", () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(NOW);
    });

    it.each([
        { ago: "0s", timestamp: NOW, expected: "0 seconds ago" },
        { ago: "1s", timestamp: NOW - SECOND, expected: "1 second ago" },
        { ago: "30s", timestamp: NOW - 30 * SECOND, expected: "30 seconds ago" },
        { ago: "1min", timestamp: NOW - MINUTE, expected: "1 minute ago" },
        { ago: "59min", timestamp: NOW - 59 * MINUTE, expected: "59 minutes ago" },
        { ago: "1h", timestamp: NOW - HOUR, expected: "1 hour ago" },
        { ago: "23h", timestamp: NOW - 23 * HOUR, expected: "23 hours ago" },
        { ago: "1d", timestamp: NOW - DAY, expected: "1 day ago" },
        { ago: "6d", timestamp: NOW - 6 * DAY, expected: "6 days ago" },
        { ago: "1w", timestamp: NOW - WEEK, expected: "1 week ago" },
        { ago: "2w", timestamp: NOW - 2 * WEEK, expected: "2 weeks ago" },
        { ago: "1 month", timestamp: Date.UTC(2026, 1, 20, 12), expected: "1 month ago" },
        { ago: "2 months", timestamp: Date.UTC(2026, 0, 20, 12), expected: "2 months ago" },
        { ago: "1 year", timestamp: Date.UTC(2025, 2, 20, 12), expected: "1 year ago" },
        { ago: "3 years", timestamp: Date.UTC(2023, 2, 20, 12), expected: "3 years ago" }
    ])("reads $expected for a timestamp $ago earlier", ({ timestamp, expected }) => {
        // Act
        const formatted = formatRelativeDate(timestamp);

        // Assert
        expect(formatted).toBe(expected);
    });

    it.each([null, undefined, NaN])("formats %s as an empty string", (timestamp) => {
        // Act
        const formatted = formatRelativeDate(timestamp);

        // Assert
        expect(formatted).toBe("");
    });

    it.each([
        { case: "2h across New Year", now: Date.UTC(2026, 0, 1, 1), timestamp: Date.UTC(2025, 11, 31, 23), expected: "2 hours ago" },
        { case: "1d across a month end", now: Date.UTC(2026, 2, 1, 12), timestamp: Date.UTC(2026, 1, 28, 12), expected: "1 day ago" },
        { case: "11 months across New Year", now: NOW, timestamp: Date.UTC(2025, 3, 20, 12), expected: "11 months ago" },
        { case: "a month less a minute", now: NOW, timestamp: Date.UTC(2026, 1, 20, 12, 1), expected: "3 weeks ago" },
        { case: "a year less a minute", now: NOW, timestamp: Date.UTC(2025, 2, 20, 12, 1), expected: "11 months ago" },
        { case: "a month and a minute", now: NOW, timestamp: Date.UTC(2026, 1, 20, 11, 59), expected: "1 month ago" },
        { case: "a year and a minute", now: NOW, timestamp: Date.UTC(2025, 2, 20, 11, 59), expected: "1 year ago" }
    ])("reads $expected for $case", ({ now, timestamp, expected }) => {
        // Arrange
        vi.setSystemTime(now);

        // Act
        const formatted = formatRelativeDate(timestamp);

        // Assert
        expect(formatted).toBe(expected);
    });
});
