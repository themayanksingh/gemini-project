/**
 * Account module - Detect current Google account
 */

// Cache the account ID to avoid repeated DOM queries
let cachedAccountId = null;

/**
 * Extract account identifier from Gemini page
 * Looks for profile button aria-label or account menu
 */
export const getAccountId = () => {
    if (cachedAccountId) return cachedAccountId;

    // Strategy 1: Look for profile button with email in aria-label
    // Gemini uses a button like: <button aria-label="Google Account: user@gmail.com">
    const profileButton = document.querySelector(
        '[aria-label*="Google Account"],' +
        '[aria-label*="@gmail.com"],' +
        '[aria-label*="@googlemail.com"],' +
        'a[href*="accounts.google.com"][aria-label*="@"]'
    );

    if (profileButton) {
        const label = profileButton.getAttribute('aria-label') || '';
        const emailMatch = label.match(/[\w.-]+@[\w.-]+\.\w+/);
        if (emailMatch) {
            cachedAccountId = sanitizeAccountId(emailMatch[0]);
            return cachedAccountId;
        }
    }

    // Strategy 2: Look for email in any visible element with email pattern
    // This is a fallback - check common account menu locations
    const accountMenuItems = document.querySelectorAll(
        '[data-email],' +
        '.gb_lb,' + // Google bar account email class
        '[aria-label*="Signed in as"]'
    );

    for (const el of accountMenuItems) {
        const email = el.getAttribute('data-email') ||
            el.textContent?.match(/[\w.-]+@[\w.-]+\.\w+/)?.[0];
        if (email) {
            cachedAccountId = sanitizeAccountId(email);
            return cachedAccountId;
        }
    }

    // Strategy 3: Try to find in window data (Gemini sometimes embeds user info)
    try {
        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
            const content = script.textContent || '';
            // Look for email pattern in script content
            const emailMatch = content.match(/"([\w.-]+@(?:gmail|googlemail)\.com)"/);
            if (emailMatch) {
                cachedAccountId = sanitizeAccountId(emailMatch[1]);
                return cachedAccountId;
            }
        }
    } catch (e) {
        // Ignore errors from script parsing
    }

    // Fallback: Use 'default' namespace if we can't detect the account
    console.warn('[GCM] Could not detect Google account, using default namespace');
    cachedAccountId = 'default';
    return cachedAccountId;
};

/**
 * Sanitize email for use as storage key suffix
 * Removes special characters that might cause issues
 */
const sanitizeAccountId = (email) => {
    return email.toLowerCase().replace(/[^a-z0-9@.]/g, '_');
};

/**
 * Clear cached account ID (useful after navigation)
 */
export const clearAccountCache = () => {
    cachedAccountId = null;
};

/**
 * Wait for account to be detectable (page might still be loading)
 */
export const waitForAccount = (maxAttempts = 10, delayMs = 500) => {
    return new Promise((resolve) => {
        let attempts = 0;

        const tryDetect = () => {
            attempts++;
            const accountId = getAccountId();

            if (accountId !== 'default' || attempts >= maxAttempts) {
                resolve(accountId);
            } else {
                cachedAccountId = null; // Reset cache for retry
                setTimeout(tryDetect, delayMs);
            }
        };

        tryDetect();
    });
};
