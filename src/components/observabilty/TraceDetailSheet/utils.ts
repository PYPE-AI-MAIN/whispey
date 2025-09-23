const formatTimestamp = (timestamp: number) => {
    // Handle both seconds and milliseconds timestamps
    const timestampMs = timestamp > 1e12 ? timestamp : timestamp * 1000
    const date = new Date(timestampMs)

    // Check if it's a valid date
    if (isNaN(date.getTime())) {
      return `Invalid timestamp: ${timestamp}`
    }

    // Get clean timezone abbreviation (IST, EST, PST etc.)
    const timeZoneAbbr =
      date
        .toLocaleTimeString("en-US", {
          timeZoneName: "short",
        })
        .split(" ")
        .pop() || "Local"

    // Simple format: Aug 27, 14:36:00 IST (user's timezone)
    return (
      date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }) +
      ", " +
      date.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }) +
      ` ${timeZoneAbbr}`
    )
  }

  const parseBugReportText = (data: any): string => {
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        return parsed.text || data;
      } catch {
        return data;
      }
    }
    return data?.text || JSON.stringify(data);
  };



  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(1)}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(3)}`
  }