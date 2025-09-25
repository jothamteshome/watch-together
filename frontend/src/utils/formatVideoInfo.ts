export function formatCount(n: number, precision: number): string {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(precision).replace(/\.0$/, "")}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(precision).replace(/\.0$/, "")}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(precision).replace(/\.0$/, "")}K`;
    return String(n);
}


export function formatYoutubeDate(timestamp: number): string {
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