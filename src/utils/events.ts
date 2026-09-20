export const safeDispatchEvent = (eventName: string, params: any = null) => {
    if (typeof window === 'undefined') return;
    try {
        const evt = new CustomEvent(eventName, params);
        window.dispatchEvent(evt);
    } catch (e) {
        try {
            const evt = document.createEvent('CustomEvent');
            evt.initCustomEvent(eventName, params?.bubbles || false, params?.cancelable || false, params?.detail || null);
            window.dispatchEvent(evt);
        } catch (err) {
            console.error("Failed to dispatch custom event", err);
        }
    }
};

export const createSafeCustomEvent = (eventName: string, params: any = null): Event | null => {
    try {
        return new CustomEvent(eventName, params);
    } catch (e) {
        try {
            const evt = document.createEvent('CustomEvent');
            evt.initCustomEvent(eventName, params?.bubbles || false, params?.cancelable || false, params?.detail || null);
            return evt;
        } catch (err) {
            console.error("Failed to create custom event", err);
            return null;
        }
    }
};
