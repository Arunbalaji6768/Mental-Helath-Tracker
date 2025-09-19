// Dashboard-specific functionality
document.addEventListener('DOMContentLoaded', function() {
  // Check if user is logged in (using both localStorage and API token)
  if (localStorage.getItem('isLoggedIn') !== 'true' || !window.api || !window.api.isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }

function setupRealtimeUpdates() {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) return;
    const url = `http://localhost:5000/events/stream?jwt=${encodeURIComponent(token)}`;
    let es = new EventSource(url, { withCredentials: false });

    es.onmessage = (evt) => {
      try {
        const payload = JSON.parse(evt.data);
        if (payload && payload.event === 'journal_created') {
          // Refresh the overview to reflect the new entry immediately
          loadDashboardData();
        }
      } catch (e) {
        console.warn('SSE parse error:', e);
      }
    };

    es.onerror = () => {
      // Attempt a simple backoff reconnect
      es.close();
      setTimeout(setupRealtimeUpdates, 3000);
    };
  } catch (err) {
    console.warn('Failed to init SSE:', err);
  }
}
  
  // Update user name if available
  const userName = localStorage.getItem('userName');
  if (userName) {
    // You can update any welcome message with the user's name
    console.log('Welcome, ' + userName);
  }
  
  // Logout functionality
  const logoutBtn = document.querySelector('a[href="index.html"].btn-outline');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function(e) {
      e.preventDefault();
      if (confirm('Are you sure you want to logout?')) {
        // Clear all authentication data
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('userName');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userType');
        localStorage.removeItem('rememberMe');
        // Clear API token
        if (window.api) {
          window.api.clearAllAuthData();
        }
        window.location.href = 'index.html';
      }
    });
  }
  
  // Load dashboard data
  loadDashboardData();
  // lightweight polling for near real-time updates
  setInterval(loadDashboardData, 20000);

  // Real-time updates via SSE
  setupRealtimeUpdates();
});

async function loadDashboardData() {
  try {
    const overview = await window.api.getOverview();
    const data = overview.overview || {};
    updateDashboardStats({
      currentMood: data.average_mood || 0,
      streakDays: data.current_streak || 0
    });

    // Use recent entries from overview if provided
    const recent = Array.isArray(data.recent_entries) ? data.recent_entries.map(e => ({
      date: (e.timestamp || '').slice(0, 10),
      mood: e.mood_rating || '-',
      text: e.text || ''
    })) : [];
    updateRecentEntries(recent);
  } catch (err) {
    console.warn('Failed to load overview:', err.message);
  }
}

function updateDashboardStats(data) {
  // Update mood score (Today's Mood card)
  const moodElement = document.querySelector('.mood-value');
  if (moodElement) {
    const val = (typeof data.currentMood === 'number' && !isNaN(data.currentMood)) ? Math.round(data.currentMood * 10) / 10 : '—';
    moodElement.textContent = (val === '—' ? '—' : val + '/10');
  }

  // Update streak card
  const streakElement = document.querySelector('.streak-value');
  if (streakElement) {
    const days = data.streakDays || 0;
    streakElement.textContent = days + ' days';
  }
}

function updateRecentEntries(entries) {
  const entriesContainer = document.getElementById('recentEntries');
  if (!entriesContainer) return;
  
  entriesContainer.innerHTML = '';
  
  entries.forEach(entry => {
    const entryDiv = document.createElement('div');
    entryDiv.className = 'recent-entry';
    entryDiv.innerHTML = `
      <div class="entry-date">${entry.date || ''}</div>
      <div class="entry-mood">Mood: ${entry.mood || '-'}${entry.mood !== '-' ? '/10' : ''}</div>
      <div class="entry-text">${entry.text}</div>
    `;
    entriesContainer.appendChild(entryDiv);
  });
}
