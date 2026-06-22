export function formatCount(n: number | null | undefined, precision: number): string {
    const safeN = n ?? 0;
    if (!Number.isFinite(safeN)) return "0";

    if (safeN >= 1_000_000_000) return `${(safeN / 1_000_000_000).toFixed(precision).replace(/\.0$/, "")}B`;
    if (safeN >= 1_000_000) return `${(safeN / 1_000_000).toFixed(precision).replace(/\.0$/, "")}M`;
    if (safeN >= 1_000) return `${(safeN / 1_000).toFixed(precision).replace(/\.0$/, "")}K`;
    return String(safeN);
}


export function formatExactCount(n: number | null | undefined): string {
    const safeN = n ?? 0;
    return Number.isFinite(safeN) ? safeN.toLocaleString() : "0";
}


export function formatExactDate(timestamp: number | null | undefined): string {
    if (timestamp == null || !Number.isFinite(timestamp)) return "";

    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "";

    return date.toLocaleString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric"
    });
}


export function formatYoutubeDate(timestamp: number | null | undefined): string {
    if (timestamp == null || !Number.isFinite(timestamp)) return "";

    const now = new Date();
    const then = new Date(timestamp);
    const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);


    // Store number of seconds in each unit
    const secondsInUnit = {
        MINUTE: 60,
        HOUR:   60 * 60,
        DAY:    60 * 60 * 24,
        WEEK:   60 * 60 * 24 * 7
    }


    // Store value for timedelta experienced
    const timeDeltaMap = {
        YEARS: now.getUTCFullYear() - then.getUTCFullYear(),
        MONTHS: (now.getUTCMonth() - then.getUTCMonth()) + (now.getUTCFullYear() - then.getUTCFullYear()) * 12,
        WEEKS: Math.floor(seconds / secondsInUnit.WEEK),
        DAYS: Math.floor(seconds / secondsInUnit.DAY),
        HOURS: Math.floor(seconds / secondsInUnit.HOUR),
        MINUTES: Math.floor(seconds / secondsInUnit.MINUTE),
        SECONDS: seconds
    }


    // Initialize value and unit variables
    let value: number;
    let unit: string;


    if (timeDeltaMap.YEARS) {
        value = timeDeltaMap.YEARS;
        unit = "year";
    } else if (timeDeltaMap.MONTHS) {
        value = timeDeltaMap.MONTHS;
        unit = "month";
    } else if (timeDeltaMap.WEEKS) { 
        value = timeDeltaMap.WEEKS;
        unit = "week";
    } else if (timeDeltaMap.DAYS) {
        value = timeDeltaMap.DAYS;
        unit = "day";
    } else if (timeDeltaMap.HOURS) {
        value = timeDeltaMap.HOURS;
        unit = "hour";
    } else if (timeDeltaMap.MINUTES) {
        value = timeDeltaMap.MINUTES;
        unit = "minute";
    } else {
        value = timeDeltaMap.SECONDS;
        unit = "second";
    }

    // Compute label for plural words
    const label: string = value === 1 ? unit : `${unit}s`;

    return `${value} ${label} ago`;
}