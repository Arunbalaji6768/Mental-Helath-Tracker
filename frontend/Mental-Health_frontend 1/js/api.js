// API Client for Mental Health Tracker
class MentalHealthAPI {
    constructor() {
        const host = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : 'localhost';
        this.baseURL = `http://${host}:5000`;
        this.token = localStorage.getItem('authToken');
    }

    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('authToken', token);
        } else {
            localStorage.removeItem('authToken');
        }
    }

    clearToken() {
        this.token = null;
        localStorage.removeItem('authToken');
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            },
            ...options
        };

        // Always pick up the freshest token from localStorage in case this.token is stale
        const freshToken = this.token || localStorage.getItem('authToken');
        if (freshToken) {
            this.token = freshToken;
            config.headers['Authorization'] = `Bearer ${freshToken}`;
        }

        const response = await fetch(url, config);
        if (!response.ok) {
            let message = response.statusText;
            try {
                const err = await response.json();
                message = err.error || err.message || message;
            } catch (_) {}
            throw new Error(`${response.status} ${message}`);
        }
        return response.json();
    }

    // Auth
    async login(identifier, password) {
        const res = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username: identifier, password })
        });
        if (res.token) {
            this.setToken(res.token);
        }
        return res;
    }

    async signup({ username, email, password }) {
        const res = await this.request('/auth/signup', {
            method: 'POST',
            body: JSON.stringify({ username, email, password })
        });
        if (res.token) {
            this.setToken(res.token);
        }
        return res;
    }

    async me() {
        try {
            return await this.request('/auth/me');
        } catch (_) {
            return null;
        }
    }

    async logout() {
        try { await this.request('/auth/logout', { method: 'POST' }); } catch (_) {}
        this.clearToken();
    }

    isAuthenticated() {
        this.token = localStorage.getItem('authToken');
        return !!this.token;
    }

    // Clear all auth-related data
    clearAllAuthData() {
        this.clearToken();
        // Clear other auth-related localStorage items
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userName');
        localStorage.removeItem('userType');
    }

    // Check authentication and redirect if needed
    checkAuthAndRedirect(redirectTo = 'login.html') {
        if (!this.isAuthenticated()) {
            window.location.href = redirectTo;
            return false;
        }
        return true;
    }

    // Journal
    async getJournalEntries() {
        const res = await this.request('/journal/entries');
        return res.entries || [];
        }

    async createJournalEntry(data) {
        const res = await this.request('/journal/entry', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return res.entry || res;
    }

    async deleteJournalEntry(id) {
        return await this.request(`/journal/entry/${id}`, { method: 'DELETE' });
    }

    // Analytics
    async getOverview() {
        return await this.request('/analytics/overview');
    }

    async getTrends(days = 30) {
        return await this.request(`/analytics/trends?days=${encodeURIComponent(days)}`);
    }

    async getInsights() {
        return await this.request('/analytics/insights');
    }
}

// expose globally
window.api = new MentalHealthAPI();


