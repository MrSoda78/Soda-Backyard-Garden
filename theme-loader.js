(function () {
    const storageKey = "sbg-theme-mode-v1";
    const allowedThemes = new Set(["spring", "summer", "autumn", "winter"]);

    function automaticThemeForDate(date) {
        const month = Number.parseInt(new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Toronto",
            month: "2-digit"
        }).format(date), 10);

        if (month >= 3 && month <= 5) {
            return "spring";
        }

        if (month >= 6 && month <= 8) {
            return "summer";
        }

        if (month >= 9 && month <= 11) {
            return "autumn";
        }

        return "winter";
    }

    let mode = "automatic";

    try {
        const storedMode = window.localStorage.getItem(storageKey);

        if (storedMode === "automatic" || allowedThemes.has(storedMode)) {
            mode = storedMode;
        }
    } catch (_error) {
        // Automatic mode remains available if browser storage is disabled.
    }

    document.documentElement.dataset.themeMode = mode;
    document.documentElement.dataset.siteTheme = mode === "automatic"
        ? automaticThemeForDate(new Date())
        : mode;
})();
