(function () {
    const storageKey = "sbg-theme-mode-v1";
    const allowedThemes = new Set(["spring", "summer", "autumn", "winter"]);
    const root = document.documentElement;

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

    function normalizeTheme(mode, effectiveTheme) {
        const normalizedMode = mode === "automatic" || allowedThemes.has(mode)
            ? mode
            : "automatic";
        const normalizedEffectiveTheme = allowedThemes.has(effectiveTheme)
            ? effectiveTheme
            : (normalizedMode === "automatic" ? automaticThemeForDate(new Date()) : normalizedMode);

        return {
            mode: normalizedMode,
            effectiveTheme: normalizedEffectiveTheme
        };
    }

    function applyTheme(theme) {
        root.dataset.themeMode = theme.mode;
        root.dataset.siteTheme = theme.effectiveTheme;
    }

    let cachedMode = "automatic";

    try {
        const storedMode = window.localStorage.getItem(storageKey);

        if (storedMode === "automatic" || allowedThemes.has(storedMode)) {
            cachedMode = storedMode;
        }
    } catch (_error) {
        // Automatic mode remains available if browser storage is disabled.
    }

    const cachedTheme = normalizeTheme(cachedMode);
    applyTheme(cachedTheme);

    // Keep a browser-specific cached theme from flashing before the published
    // website setting arrives. Every browser now receives the same saved theme.
    const loadingStyle = document.createElement("style");
    loadingStyle.id = "sbg-theme-loader-style";
    loadingStyle.textContent = "html.sbg-theme-loading body{visibility:hidden}";
    document.head.appendChild(loadingStyle);
    root.classList.add("sbg-theme-loading");

    let revealed = false;

    function revealPage() {
        if (revealed) {
            return;
        }

        revealed = true;
        root.classList.remove("sbg-theme-loading");
        root.classList.add("sbg-theme-ready");
        loadingStyle.remove();
    }

    const revealTimeout = window.setTimeout(revealPage, 1200);

    window.sbgPublishedThemePromise = fetch("/api/theme", {
        headers: { "Accept": "application/json" },
        cache: "no-store"
    }).then(function (response) {
        if (!response.ok) {
            throw new Error("Website theme could not be loaded.");
        }

        return response.json();
    }).then(function (result) {
        const publishedTheme = normalizeTheme(
            result && result.theme && result.theme.mode,
            result && result.theme && result.theme.effectiveTheme
        );

        applyTheme(publishedTheme);

        try {
            window.localStorage.setItem(storageKey, publishedTheme.mode);
        } catch (_error) {
            // The published theme still applies when browser storage is disabled.
        }

        return publishedTheme;
    }).catch(function () {
        return cachedTheme;
    }).finally(function () {
        window.clearTimeout(revealTimeout);
        revealPage();
    });
})();
