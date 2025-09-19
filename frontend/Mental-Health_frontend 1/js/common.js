// ===== Authentication Check =====
function checkAuthentication() {
  // Only check auth on protected pages (not login/signup)
  const currentPage = window.location.pathname.split('/').pop();
  const protectedPages = ['dashboard.html', 'journal.html', 'profile.html', 'progress.html', 'goals.html'];
  
  if (protectedPages.includes(currentPage)) {
    if (!window.api.isAuthenticated()) {
      window.location.href = 'login.html';
      return false;
    }
  }
  return true;
}

// ===== Logout Function =====
function logout() {
  window.api.clearAllAuthData();
  window.location.href = 'login.html';
}

// Make logout globally available
window.logout = logout;

// ===== Mobile Navigation Toggle =====
document.addEventListener('DOMContentLoaded', () => {
  // Don't run global auth check here - let individual pages handle their own auth
  // checkAuthentication(); // Removed to prevent conflicts
  
  const navbarToggle = document.getElementById('navbar-toggle');
  const mainNav = document.getElementById('main-nav');
  
  if (navbarToggle && mainNav) {
    navbarToggle.addEventListener('click', () => {
      mainNav.classList.toggle('active');
      navbarToggle.classList.toggle('active');
    });
  }
});

// ===== Navbar Scroll Effect =====
window.addEventListener('scroll', () => {
  const navbar = document.getElementById('navbar');
  if (navbar) {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }
});

// ===== Smooth Scroll for Anchor Links =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if(target){
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// ===== Hero Section Fade-in =====
window.addEventListener('DOMContentLoaded', () => {
  const heroContent = document.querySelector('.hero-content');
  const heroImage = document.querySelector('.hero-image');

  if(heroContent) heroContent.classList.add('fade-in');
  if(heroImage) heroImage.classList.add('fade-in');
});

// ===== Feature Cards Animation on Scroll =====
const featureCards = document.querySelectorAll('.feature-cards .card');
const testimonialCards = document.querySelectorAll('.testimonial-cards .testimonial-card');

const observerOptions = {
  threshold: 0.2
};

const observer = new IntersectionObserver((entries, observer) => {
  entries.forEach(entry => {
    if(entry.isIntersecting){
      entry.target.classList.add('fade-in-up');
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

featureCards.forEach(card => observer.observe(card));
testimonialCards.forEach(card => observer.observe(card));

// ===== Testimonial Auto-Slider =====
let testimonialIndex = 0;
const testimonials = document.querySelectorAll('.testimonial-cards .testimonial-card');

function showTestimonial(index) {
  testimonials.forEach((card, i) => {
    card.style.display = i === index ? 'block' : 'none';
  });
}

// ===== Journal: Recent AI Analysis tiles (Today / Yesterday / 2 days ago) =====
let _tilesRefreshing = false; // debounce guard
let _tilesLastRenderAt = 0;   // cooldown to avoid rapid flip/flop
async function refreshRecentAnalysisTiles(force=false){
  if (!(window.api && typeof window.api.getJournalEntries === 'function')) return;
  // small retry/backoff to handle race when backend just started
  const fetchWithRetry = async (retries=2, delay=400) => {
    try { return await window.api.getJournalEntries(); }
    catch (e){ if (retries>0){ await new Promise(r=>setTimeout(r, delay)); return fetchWithRetry(retries-1, delay*1.5); } throw e; }
  };
  try {
    if (_tilesRefreshing) return; // avoid overlapping DOM updates
    const nowTs = Date.now();
    if (!force && (nowTs - _tilesLastRenderAt < 8000)) {
      // too soon since last render; skip to keep UI stable
      return;
    }
    _tilesRefreshing = true;

    const entries = await fetchWithRetry();
    const now = new Date();
    // Compute local midnight for stable day-diff
    const startOfDay = (d) => { const x=new Date(d); x.setHours(0,0,0,0); return x; };
    const todayStart = startOfDay(now);
    const buckets = {0: [], 1: [], 2: []};
    for (const e of entries){
      const tsRaw = e.timestamp || e.created_at || e.createdAt;
      const ts = tsRaw ? new Date(tsRaw) : null;
      if (!ts) continue;
      const entryDay = startOfDay(ts);
      const diffDays = Math.floor((todayStart - entryDay) / (1000*60*60*24));
      if (diffDays in buckets) buckets[diffDays].push(e);
    }

    const grid = document.querySelector('.grid.grid-cols-3');
    const cards = document.querySelectorAll('.grid.grid-cols-3 .card.text-center');
    const dayLabels = ['Today', 'Yesterday', '2 days ago'];

    function summarize(list){
      if (!list || list.length === 0) return null;
      // Count sentiments and compute average score for tie-breaks
      let sum = 0; const counts = {POSITIVE:0, NEUTRAL:0, NEGATIVE:0};
      for (const it of list){
        const s = typeof it.score === 'number' ? it.score : (it.sentiment_analysis && (it.sentiment_analysis.confidence_score ?? it.sentiment_analysis.score)) || 0.5;
        sum += s;
        let lab = (it.sentiment || (it.sentiment_analysis && (it.sentiment_analysis.sentiment || it.sentiment_analysis.label)) || 'NEUTRAL');
        try { lab = String(lab).toUpperCase(); } catch(_) { lab = 'NEUTRAL'; }
        if (!(lab in counts)) lab = 'NEUTRAL';
        counts[lab]++;
      }
      const avg = sum / list.length;
      // Determine dominant sentiment by counts
      const entriesCount = list.length;
      const pctFor = (label) => Math.round((counts[label] / entriesCount) * 100);
      let sentiment = 'NEUTRAL';
      let maxCount = -1;
      for (const k of ['POSITIVE','NEUTRAL','NEGATIVE']){
        if (counts[k] > maxCount){ maxCount = counts[k]; sentiment = k; }
      }
      // Tie-breaker using average score
      const uniques = Object.values(counts).filter(v=>v===maxCount).length;
      if (uniques > 1){
        if (avg >= 0.6) sentiment = 'POSITIVE';
        else if (avg <= 0.4) sentiment = 'NEGATIVE';
        else sentiment = 'NEUTRAL';
      }
      const selectedPct = pctFor(sentiment);
      return { avg, sentiment, selectedPct };
    }

    function styleFor(sent){
      if (sent === 'POSITIVE') return { emoji:'😊', bg:'#d1fae5', fg:'#065f46', label:'Positive' };
      if (sent === 'NEGATIVE') return { emoji:'😔', bg:'#fee2e2', fg:'#991b1b', label:'Negative' };
      return { emoji:'😐', bg:'#fef3c7', fg:'#92400e', label:'Neutral' };
    }

    let visibleCount = 0;
    [0,1,2].forEach((d, idx) => {
      const card = cards[idx];
      if (!card) return;
      const summary = summarize(buckets[d]);
      if (!summary){
        // No entries for that day: show a clear neutral placeholder
        card.style.display = '';
        const emojiDiv = card.querySelector('div[style*="font-size"]');
        const title = card.querySelector('h3');
        const sub = card.querySelector('p');
        const badge = card.querySelector('div[style*="border-radius"]');
        if (emojiDiv) emojiDiv.textContent = '😐';
        if (title) title.textContent = dayLabels[idx];
        if (sub) sub.textContent = 'No entries yet';
        if (badge){
          badge.textContent = '—';
          badge.style.background = '#e5e7eb';
          badge.style.color = '#374151';
        }
        return;
      }
      card.style.display = '';
      const { avg, sentiment, selectedPct } = summary;
      const pct = Math.max(0, Math.min(100, selectedPct));
      const st = styleFor(sentiment);
      // Update contents: expects first emoji div, h3 title, p subtitle, and badge div
      const emojiDiv = card.querySelector('div[style*="font-size"]');
      const title = card.querySelector('h3');
      const sub = card.querySelector('p');
      const badge = card.querySelector('div[style*="border-radius"]');
      if (emojiDiv) emojiDiv.textContent = st.emoji;
      if (title) title.textContent = dayLabels[idx];
      if (sub) sub.textContent = `${st.label} Sentiment`;
      if (badge){
        badge.style.background = st.bg;
        badge.style.color = st.fg;
        badge.textContent = `${pct}% ${st.label}`;
      }
    });
    // Always keep the three cards visible; no global empty message needed
    _tilesLastRenderAt = Date.now();
  } catch (err) {
    // On failure, keep whatever is currently shown; don't overwrite with loading.
    console.info('Recent analysis tiles: transient error, leaving current UI intact:', (err && err.message) || err);
  } finally {
    _tilesRefreshing = false;
  }
}

// On load, if we are on the journal page, refresh the tiles
document.addEventListener('DOMContentLoaded', () => {
  const onJournal = document.querySelector('#journalForm') && document.querySelector('#aiAnalysisResults');
  if (onJournal){
    refreshRecentAnalysisTiles();
    // Periodic refresh to keep tiles in sync with new entries even if user keeps tab open
    // Uses internal cooldown to avoid flicker
    setInterval(() => {
      try { refreshRecentAnalysisTiles(); } catch(_) {}
    }, 5 * 60 * 1000); // every 5 minutes

    // Ensure rollover at local midnight so 'Today' becomes 'Yesterday' automatically
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 5, 0); // 5s after midnight to avoid edge-case seconds
    const msUntilMidnight = midnight.getTime() - now.getTime();
    setTimeout(() => {
      try { refreshRecentAnalysisTiles(true); } catch(_) {}
      // schedule subsequent daily refreshes
      setInterval(() => { try { refreshRecentAnalysisTiles(); } catch(_) {} }, 24 * 60 * 60 * 1000);
    }, Math.max(1000, msUntilMidnight));
  }
});

// Watchdog: if some other code clears the AI panels, restore from lastAnalysis
setInterval(() => {
  try {
    if (!lastAnalysis) return;
    const analysisEl = document.getElementById('aiAnalysisResults');
    const insightsEl = document.getElementById('aiInsights');
    if (analysisEl && analysisEl.innerHTML.trim() === '') {
      analysisEl.innerHTML = lastAnalysis.html || analysisEl.innerHTML;
    }
    if (insightsEl && insightsEl.innerHTML.trim() === '') {
      insightsEl.innerHTML = lastAnalysis.insightsHtml || insightsEl.innerHTML;
    }
  } catch (e) {
    // no-op
  }
}, 150);

// MutationObserver to prevent unintended resets of AI panels
(function initAIPanelGuards(){
  const analysisEl = document.getElementById('aiAnalysisResults');
  const insightsEl = document.getElementById('aiInsights');
  if (!analysisEl || !insightsEl) return;

  // Avoid visual jumps by enforcing a min-height once analysis is shown
  const ensureMinHeights = () => {
    if (hasShownAnalysis) {
      analysisEl.style.minHeight = '180px';
      insightsEl.style.minHeight = '120px';
    }
  };

  const guard = (target, type) => new MutationObserver(() => {
    if (!hasShownAnalysis || !lastAnalysis) return;
    // If target was cleared or reverted to placeholder, restore the last analysis
    const html = target.innerHTML.trim();
    if (!html || /Ready to Analyze|AI insights will appear here/i.test(html)) {
      if (type === 'analysis' && lastAnalysis.html) target.innerHTML = lastAnalysis.html;
      if (type === 'insights' && lastAnalysis.insightsHtml) target.innerHTML = lastAnalysis.insightsHtml;
      ensureMinHeights();
    }
  });

  const mo1 = guard(analysisEl, 'analysis');
  const mo2 = guard(insightsEl, 'insights');
  mo1.observe(analysisEl, { childList: true, subtree: true });
  mo2.observe(insightsEl, { childList: true, subtree: true });
})();

function nextTestimonial() {
  testimonialIndex = (testimonialIndex + 1) % testimonials.length;
  showTestimonial(testimonialIndex);
}

if(testimonials.length > 0){
  showTestimonial(testimonialIndex);
  setInterval(nextTestimonial, 5000); // change testimonial every 5 sec
}

// ===== Add CSS Animations via JS =====
const style = document.createElement('style');
style.innerHTML = `
.fade-in { opacity: 0; transform: translateY(20px); animation: fadeIn 1s forwards; }
.fade-in-up { opacity: 0; transform: translateY(40px); animation: fadeInUp 0.8s forwards; }

@keyframes fadeIn {
  to { opacity: 1; transform: translateY(0); }
}

@keyframes fadeInUp {
  to { opacity: 1; transform: translateY(0); }
}
`;
document.head.appendChild(style);

// ===== Contact Form Submission =====
const contactForm = document.getElementById('contactForm');
if(contactForm){
  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const status = document.getElementById('formStatus');
    status.textContent = 'Sending message...';
    
    // Simulate sending (replace with real backend API later)
    setTimeout(() => {
      status.textContent = 'Thank you! Your message has been sent.';
      contactForm.reset();
    }, 1500);
  });
}
 
// ===== FAQ Accordion =====
const faqItems = document.querySelectorAll('.faq-item');
faqItems.forEach(item => {
  const question = item.querySelector('.faq-question');
  question.addEventListener('click', () => {
    item.classList.toggle('open');
  });
});
 
// ===== Login Form (moved to login.js to avoid conflicts) =====
// Login form handling is now in login.js for better organization

// Removed signup simulation. Signup is handled by signup.js using real API.

// ===== Onboarding Page Interactivity =====
const onboardingForm = document.getElementById('onboardingForm');
if(onboardingForm){

  // Update range slider values dynamically
  const stress = document.getElementById('stress');
  const stressValue = document.getElementById('stressValue');
  stress.addEventListener('input', () => stressValue.textContent = stress.value);

  const anxiety = document.getElementById('anxiety');
  const anxietyValue = document.getElementById('anxietyValue');
  anxiety.addEventListener('input', () => anxietyValue.textContent = anxiety.value);

  const sleep = document.getElementById('sleep');
  const sleepValue = document.getElementById('sleepValue');
  sleep.addEventListener('input', () => sleepValue.textContent = sleep.value);

  // Simulate form submission
  onboardingForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const status = document.getElementById('onboardingStatus');
    status.textContent = 'Setting up your profile...';

    setTimeout(() => {
      status.textContent = 'Profile setup complete! Welcome!';
      onboardingForm.reset();
      // Optionally, redirect to dashboard
      // window.location.href = 'dashboard.html';
    }, 1500);
  });
}

// ===== Reset Password Form =====
const resetForm = document.getElementById('resetForm');
if(resetForm){
  resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = document.getElementById('resetStatus');
    if (status) status.textContent = 'Sending reset link...';
    const emailInput = document.getElementById('email');
    const email = emailInput ? emailInput.value.trim() : '';
    if (!email) {
      if (status) { status.textContent = 'Please enter your email address.'; status.style.color = '#ef4444'; }
      return;
    }

    try {
      await window.api.request('/auth/request-password-reset', {
        method: 'POST',
        body: JSON.stringify({ email })
      });
      if (status) { status.textContent = 'If the email exists, a reset link has been sent.'; status.style.color = '#10b981'; }
      resetForm.reset();
    } catch (err) {
      if (status) { status.textContent = `Failed to send reset link: ${err.message}`; status.style.color = '#ef4444'; }
    }
  });
}

// ===== Dashboard Interactivity =====
function openJournal() {
  // This can redirect to journal page or open modal
  window.location.href = 'journal.html';
}

// Simulate notifications dynamically (optional)
const notificationsList = document.getElementById('notificationsList');
if(notificationsList){
  setTimeout(() => {
    const li = document.createElement('li');
    li.textContent = 'New goal suggestion available!';
    notificationsList.appendChild(li);
  }, 5000);
}

// ===== Mood Tracking Page =====
const moodForm = document.getElementById('moodForm');
if(moodForm){
  const moodRating = document.getElementById('moodRating');
  const moodValue = document.getElementById('moodValue');

  // Update range value dynamically
  moodRating.addEventListener('input', () => {
    moodValue.textContent = moodRating.value;
  });

  // Handle form submission
  moodForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const status = document.getElementById('moodStatus');
    status.textContent = 'Saving your mood...';

    // Simulate saving data
    setTimeout(() => {
      status.textContent = 'Mood saved successfully!';
      moodForm.reset();
      moodValue.textContent = '5';
    }, 1500);
  });
}

// ===== Journal Page (backend + AI) =====
let journalSubmitting = false; // debounce guard to prevent duplicate submits
const journalForm = document.getElementById('journalForm');
const entriesContainer = document.getElementById('entriesContainer');
const journalSearch = document.getElementById('journalSearch');

let journalEntries = []; // Store entries in memory (can later use backend/localStorage)
let lastAnalysis = null; // Persist last AI analysis to guard against accidental clears
let hasShownAnalysis = false; // Flag that we have shown an analysis at least once

// Lightweight on-device heuristic analysis as a fallback when backend fails
function localAnalyzeText(text){
  const t = (text||'').toLowerCase();
  const posWords = ['great','good','happy','relaxed','calm','better','proud','grateful','excited','peaceful','energized'];
  const negWords = ['sad','anxious','anxiety','stress','stressed','angry','upset','tired','worried','fear','panic','overwhelmed','depressed'];
  let pos=0, neg=0;
  posWords.forEach(w=>{ const m=t.match(new RegExp(`\\b${w}\\b`,'g')); if(m) pos+=m.length; });
  negWords.forEach(w=>{ const m=t.match(new RegExp(`\\b${w}\\b`,'g')); if(m) neg+=m.length; });
  const score = (pos+1)/(pos+neg+2); // 0..1, Laplace smoothing
  let sentiment='NEUTRAL';
  if (score>0.6) sentiment='POSITIVE'; else if (score<0.4) sentiment='NEGATIVE';
  const suggestions=[];
  if (sentiment==='NEGATIVE'){
    suggestions.push('Try a 5-minute breathing exercise to reduce stress.');
    suggestions.push('Write down one positive moment from today.');
  } else if (sentiment==='NEUTRAL'){
    suggestions.push('Add a bit more detail about how you felt to improve insights.');
    suggestions.push('Consider a short walk or hydration break.');
  } else {
    suggestions.push('Great job! Keep the momentum with a small goal.');
    suggestions.push('Note what contributed to your positive mood.');
  }
  return { sentiment, score, suggestions };
}

// Handle form submission
if(journalForm){
  journalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const entryText = document.getElementById('journalEntry').value.trim();
    const status = document.getElementById('journalStatus');
    const submitBtn = journalForm.querySelector('button[type="submit"], .btn-primary');

    if(entryText === ''){
      status.textContent = 'Please write something before adding.';
      return;
    }

    if (journalSubmitting) {
      return; // prevent double-clicks/rapid submits
    }
    journalSubmitting = true;

    status.textContent = 'Saving entry and analyzing...';
    status.style.color = '#6b7280';
    if (submitBtn) {
      submitBtn.disabled = true;
      const originalText = submitBtn.textContent;
      submitBtn.dataset._originalText = originalText || '';
      submitBtn.textContent = 'Analyzing…';
    }
    // Immediately show a loading state in AI panels so user sees activity
    try {
      const analysisEl0 = document.getElementById('aiAnalysisResults');
      if (analysisEl0) {
        analysisEl0.innerHTML = `
          <div style="font-size: var(--font-size-4xl); margin-bottom: var(--spacing-4);">⏳</div>
          <h3>Analyzing…</h3>
          <p style="color: var(--text-secondary);">Running AI sentiment analysis</p>
        `;
      }
      const insightsEl0 = document.getElementById('aiInsights');
      if (insightsEl0) {
        insightsEl0.innerHTML = `
          <div style="text-align:center; color: var(--text-secondary);">Generating AI insights…</div>
        `;
      }
    } catch(_) {}
    try {
      const created = await window.api.createJournalEntry({ text: entryText, mood_rating: null, tags: [] });
      // normalize for renderer (robust to different backend keys)
      const rawSent = (created && (created.sentiment
                        || (created.sentiment_analysis && (created.sentiment_analysis.sentiment || created.sentiment_analysis.label)))) || 'NEUTRAL';
      const sentiment = String(rawSent).toUpperCase();
      const rawScore = (typeof created?.score === 'number' ? created.score
                        : (created?.sentiment_analysis && (created.sentiment_analysis.confidence_score ?? created.sentiment_analysis.score)));
      const score = typeof rawScore === 'number' ? Math.max(0, Math.min(1, rawScore)) : 0.5;
      const entry = {
        id: created.id || Date.now(),
        text: created.text || entryText,
        sentiment,
        score
      };
      journalEntries.unshift(entry);
      renderEntries();
      // Refresh the recent analysis tiles to reflect this new entry immediately
      try { await refreshRecentAnalysisTiles(true); } catch(_){}
      // Keep the previous text and analysis visible until the next analysis
      // Do NOT reset the form here to avoid any visual flicker
      status.textContent = 'Entry analyzed by AI!';
      status.style.color = '#10b981';

      // Update AI Analysis panel in real-time
      const analysisEl = document.getElementById('aiAnalysisResults');
      if (analysisEl) {
        const emoji = entry.sentiment === 'POSITIVE' ? '😊' : entry.sentiment === 'NEGATIVE' ? '😔' : '😐';
        // For NEUTRAL, show a steady 50% to avoid confusing near-zero scores from certain models
        const pct = entry.sentiment === 'NEUTRAL' ? 50 : (entry.score ? Math.round(entry.score * 100) : 50);
        const badgeBg = entry.sentiment === 'POSITIVE' ? '#d1fae5' : entry.sentiment === 'NEGATIVE' ? '#fee2e2' : '#fef3c7';
        const badgeFg = entry.sentiment === 'POSITIVE' ? '#065f46' : entry.sentiment === 'NEGATIVE' ? '#991b1b' : '#92400e';
        const html = `
          <div style="font-size: var(--font-size-4xl); margin-bottom: var(--spacing-4);">${emoji}</div>
          <h3>${entry.sentiment || 'NEUTRAL'} Sentiment</h3>
          <p style="color: var(--text-secondary);">Confidence: ${pct}%</p>
          <div style="background: ${badgeBg}; color: ${badgeFg}; padding: var(--spacing-2); border-radius: var(--radius-lg); font-size: var(--font-size-sm); margin-top: var(--spacing-2); display:inline-block;">
            Real-time BERT Analysis
          </div>
        `;
        analysisEl.innerHTML = html;
        lastAnalysis = { html, sentiment: entry.sentiment, score: entry.score };
        hasShownAnalysis = true;
      }

      // Update AI Insights panel
      const insightsEl = document.getElementById('aiInsights');
      if (insightsEl) {
        const suggestions = [];
        if (entry.sentiment === 'NEGATIVE') {
          suggestions.push('Try a 5-minute breathing exercise to reduce stress.');
          suggestions.push('Consider writing about one positive moment today.');
        } else if (entry.sentiment === 'NEUTRAL') {
          suggestions.push('Expand on your feelings to help AI provide deeper insights.');
          suggestions.push('Add a mood rating (1-10) next time for better tracking.');
        } else if (entry.sentiment === 'POSITIVE') {
          suggestions.push('Great job! Consider setting a small goal to keep momentum.');
          suggestions.push('Save this entry as a “gratitude” tag for future reflection.');
        }
        const insightsHtml = `
          <ul style="list-style: disc; text-align: left; padding-left: 1.25rem;">
            ${suggestions.map(s => `<li>${s}</li>`).join('')}
          </ul>
        `;
        insightsEl.innerHTML = insightsHtml;
        lastAnalysis = { ...(lastAnalysis || {}), insightsHtml };
        hasShownAnalysis = true;
      }

      // Keep status visible; do not auto-clear so panel never appears empty between updates
      // (User can submit again; this will update the panels in place.)
    } catch (err) {
      status.textContent = `Saved offline: ${err.message}. Showing local AI estimate.`;
      status.style.color = '#ef4444';
      // Local fallback so the user still sees analysis immediately
      const { sentiment, score, suggestions } = localAnalyzeText(entryText);
      const analysisEl = document.getElementById('aiAnalysisResults');
      if (analysisEl) {
        const emoji = sentiment === 'POSITIVE' ? '😊' : sentiment === 'NEGATIVE' ? '😔' : '😐';
        const pct = Math.round(score * 100);
        const badgeBg = sentiment === 'POSITIVE' ? '#d1fae5' : sentiment === 'NEGATIVE' ? '#fee2e2' : '#fef3c7';
        const badgeFg = sentiment === 'POSITIVE' ? '#065f46' : sentiment === 'NEGATIVE' ? '#991b1b' : '#92400e';
        const html = `
          <div style="font-size: var(--font-size-4xl); margin-bottom: var(--spacing-4);">${emoji}</div>
          <h3>${sentiment} Sentiment (Local)</h3>
          <p style="color: var(--text-secondary);">Confidence: ${pct}%</p>
          <div style="background: ${badgeBg}; color: ${badgeFg}; padding: var(--spacing-2); border-radius: var(--radius-lg); font-size: var(--font-size-sm); margin-top: var(--spacing-2); display:inline-block;">
            Offline Heuristic Analysis
          </div>
        `;
        analysisEl.innerHTML = html;
        lastAnalysis = { html, sentiment, score };
        hasShownAnalysis = true;
      }
      const insightsEl = document.getElementById('aiInsights');
      if (insightsEl) {
        const insightsHtml = `
          <ul style="list-style: disc; text-align: left; padding-left: 1.25rem;">
            ${suggestions.map(s => `<li>${s}</li>`).join('')}
          </ul>
        `;
        insightsEl.innerHTML = insightsHtml;
        lastAnalysis = { ...(lastAnalysis || {}), insightsHtml };
        hasShownAnalysis = true;
      }
    }
    finally {
      journalSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = submitBtn.dataset._originalText || 'Analyze with AI';
      }
    }
  });
}

// Render journal entries
function renderEntries(){
  if (!entriesContainer) return; // Add null check
  entriesContainer.innerHTML = '';
  journalEntries.forEach(entry => {
    const div = document.createElement('div');
    div.className = 'entry';
    const sentimentBadge = entry.sentiment ? `<span class="badge">${entry.sentiment} ${(entry.score ? Math.round(entry.score*100) : 0)}%</span>` : '';
    div.innerHTML = `<p>${entry.text}</p>${sentimentBadge}<button class="delete-btn" data-entry-id="${entry.id}">X</button>`;
    entriesContainer.appendChild(div);
  });
}

// Delete entry
function deleteEntry(id){
  journalEntries = journalEntries.filter(e => e.id !== id);
  renderEntries();
}

// Add event delegation for delete buttons
if(entriesContainer){
  entriesContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('delete-btn')) {
      const entryId = parseInt(e.target.getAttribute('data-entry-id'));
      deleteEntry(entryId);
    }
  });
}

// Search functionality
if(journalSearch){
  journalSearch.addEventListener('input', () => {
    const query = journalSearch.value.toLowerCase();
    const filtered = journalEntries.filter(e => e.text.toLowerCase().includes(query));
    entriesContainer.innerHTML = '';
    filtered.forEach(entry => {
      const div = document.createElement('div');
      div.className = 'entry';
      div.innerHTML = `<p>${entry.text}</p><button class="delete-btn" onclick="deleteEntry(${entry.id})">X</button>`;
      entriesContainer.appendChild(div);
    });
  });
}

// ===== Progress Page =====
document.addEventListener('DOMContentLoaded', () => {
  const moodCanvas = document.getElementById('moodChart');
  const sleepMoodCanvas = document.getElementById('sleepMoodChart');
  if (!moodCanvas || !sleepMoodCanvas || typeof Chart === 'undefined') {
    return;
  }
  const moodCtx = moodCanvas ? moodCanvas.getContext('2d') : null;
  const sleepMoodCtx = sleepMoodCanvas ? sleepMoodCanvas.getContext('2d') : null;
  
  if (!moodCtx || !sleepMoodCtx) {
    return;
  }

  // Sample mood data for last 7 days
  const moodChart = new Chart(moodCtx, {
    type: 'line',
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [{
        label: 'Mood Rating',
        data: [7, 6, 8, 5, 7, 6, 8],
        borderColor: '#4f46e5',
        backgroundColor: 'rgba(79, 70, 229, 0.2)',
        tension: 0.3,
        fill: true,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { mode: 'index', intersect: false }
      },
      scales: {
        y: { min: 0, max: 10 }
      }
    }
  });

  // Sample Sleep vs Mood correlation chart
  const sleepMoodChart = new Chart(sleepMoodCtx, {
    type: 'bar',
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [
        {
          label: 'Sleep Hours',
          data: [6, 7, 5, 8, 6, 7, 6],
          backgroundColor: '#10b981'
        },
        {
          label: 'Mood Rating',
          data: [7, 6, 8, 5, 7, 6, 8],
          backgroundColor: '#4f46e5'
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        tooltip: { mode: 'index', intersect: false }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
});

// Export function (simulated)
function exportProgress(){
  alert('Progress exported as PDF! (Simulation)');
}
 
// ===== Assessments Page =====
const assessmentType = document.getElementById('assessmentType');
const questionsContainer = document.getElementById('questionsContainer');
const assessmentForm = document.getElementById('assessmentForm');
const assessmentResult = document.getElementById('assessmentResult');

// Question sets
const assessments = {
  phq9: [
    "Little interest or pleasure in doing things?",
    "Feeling down, depressed, or hopeless?",
    "Trouble falling or staying asleep?",
    "Feeling tired or having little energy?",
    "Poor appetite or overeating?",
    "Feeling bad about yourself?",
    "Trouble concentrating on tasks?",
    "Moving or speaking slowly or too fidgety?",
    "Thoughts that you would be better off dead or hurting yourself?"
  ],
  gad7: [
    "Feeling nervous, anxious, or on edge?",
    "Not being able to stop or control worrying?",
    "Worrying too much about different things?",
    "Trouble relaxing?",
    "Being so restless it’s hard to sit still?",
    "Becoming easily annoyed or irritable?",
    "Feeling afraid as if something awful might happen?"
  ]
};

// Render questions dynamically
assessmentType?.addEventListener('change', () => {
  const selected = assessmentType.value;
  questionsContainer.innerHTML = '';
  assessmentResult.innerHTML = '';
  if(selected && assessments[selected]){
    assessments[selected].forEach((q, idx) => {
      const div = document.createElement('div');
      div.className = 'question-group';
      div.innerHTML = `<label>${idx + 1}. ${q}</label>
        <div>
          <label><input type="radio" name="q${idx}" value="0"> Not at all</label>
          <label><input type="radio" name="q${idx}" value="1"> Several days</label>
          <label><input type="radio" name="q${idx}" value="2"> More than half the days</label>
          <label><input type="radio" name="q${idx}" value="3"> Nearly every day</label>
        </div>`;
      questionsContainer.appendChild(div);
    });
  }
});

// Handle form submission
assessmentForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const selected = assessmentType.value;
  if(!selected) return;

  let score = 0;
  const questions = assessments[selected];
  for(let i=0; i<questions.length; i++){
    const val = document.querySelector(`input[name="q${i}"]:checked`);
    if(val) score += parseInt(val.value);
  }

  // Generate feedback
  let feedback = '';
  if(selected === 'phq9'){
    if(score <= 4) feedback = 'Minimal depression';
    else if(score <= 9) feedback = 'Mild depression';
    else if(score <= 14) feedback = 'Moderate depression';
    else if(score <= 19) feedback = 'Moderately severe depression';
    else feedback = 'Severe depression';
  } else if(selected === 'gad7'){
    if(score <= 4) feedback = 'Minimal anxiety';
    else if(score <= 9) feedback = 'Mild anxiety';
    else if(score <= 14) feedback = 'Moderate anxiety';
    else feedback = 'Severe anxiety';
  }

  assessmentResult.innerHTML = `Your score: ${score} <br> Feedback: ${feedback}`;
});


// ===== Resources Page =====
const startBreathing = document.getElementById('startBreathing');
const breathingStatus = document.getElementById('breathingStatus');

if(startBreathing){
  startBreathing.addEventListener('click', () => {
    breathingStatus.textContent = 'Inhale...';
    let step = 0;
    const steps = ['Inhale...', 'Hold...', 'Exhale...'];
    const interval = setInterval(() => {
      step++;
      if(step >= steps.length) step = 0;
      breathingStatus.textContent = steps[step];
    }, 4000); // 4 seconds per step

    // Stop after 4 cycles (12 steps)
    setTimeout(() => {
      clearInterval(interval);
      breathingStatus.textContent = 'Done! Relax.';
    }, 48000); // 12 steps x 4 sec = 48 sec
  });
}


// ===== Goals & Habits Page =====
const goalForm = document.getElementById('goalForm');
const goalInput = document.getElementById('goalInput');
const goalsList = document.getElementById('goalsList');

let goals = [];

// Handle form submission
goalForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const goalText = goalInput.value.trim();
  if(!goalText) return;

  const goal = {
    id: Date.now(),
    text: goalText,
    completed: false
  };
  goals.push(goal);
  renderGoals();
  goalForm.reset();
});

// Render goals
function renderGoals(){
  if (!goalsList) return; // Add null check
  goalsList.innerHTML = '';
  goals.forEach(goal => {
    const div = document.createElement('div');
    div.className = 'goal-item' + (goal.completed ? ' completed' : '');
    div.innerHTML = `
      <span data-goal-id="${goal.id}" class="goal-text">${goal.text}</span>
      <button data-goal-id="${goal.id}" class="delete-goal-btn">X</button>
    `;
    goalsList.appendChild(div);
  });
}

// Toggle goal completion
function toggleGoal(id){
  goals = goals.map(goal => goal.id === id ? {...goal, completed: !goal.completed} : goal);
  renderGoals();
}

// Delete goal
function deleteGoal(id){
  goals = goals.filter(goal => goal.id !== id);
  renderGoals();
}

// Add event delegation for goals
if(goalsList){
  goalsList.addEventListener('click', (e) => {
    if (e.target.classList.contains('goal-text')) {
      const goalId = parseInt(e.target.getAttribute('data-goal-id'));
      toggleGoal(goalId);
    } else if (e.target.classList.contains('delete-goal-btn')) {
      const goalId = parseInt(e.target.getAttribute('data-goal-id'));
      deleteGoal(goalId);
    }
  });
}


// ===== Profile Page =====
const profileForm = document.getElementById('profileForm');
const profileStatus = document.getElementById('profileStatus');

profileForm?.addEventListener('submit', (e) => {
  e.preventDefault();

  // Collect values (in real app, send to backend)
  const profileData = {
    name: document.getElementById('name').value,
    email: document.getElementById('email').value,
    password: document.getElementById('password').value,
    shareData: document.getElementById('shareData').checked,
    publicProfile: document.getElementById('publicProfile').checked,
    emailNotif: document.getElementById('emailNotif').checked,
    pushNotif: document.getElementById('pushNotif').checked
  };

  console.log('Profile Updated:', profileData);

  profileStatus.textContent = 'Profile updated successfully!';
  setTimeout(() => { profileStatus.textContent = ''; }, 3000);

  profileForm.reset(); // optional, remove if you want to keep inputs
});


// ===== Therapist Dashboard =====

// Sample high-risk alerts
const alertsList = document.getElementById('alertsList');
const sampleAlerts = [
  "Client John Doe - Mood score very low today",
  "Client Jane Smith - Missed 3 mood entries in a row",
  "Client Alice - High anxiety score in last assessment"
];

if(alertsList){
  sampleAlerts.forEach(alert => {
    const li = document.createElement('li');
    li.textContent = alert;
    alertsList.appendChild(li);
  });
}

// Sample clients list
const clientsList = document.getElementById('clientsList');
const sampleClients = [
  {name: "John Doe", mood: "3/10", assessment: "PHQ-9: 15", id: 1},
  {name: "Jane Smith", mood: "6/10", assessment: "GAD-7: 8", id: 2},
  {name: "Alice Brown", mood: "4/10", assessment: "PHQ-9: 12", id: 3}
];

if(clientsList){
  sampleClients.forEach(client => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${client.name}</td>
      <td>${client.mood}</td>
      <td>${client.assessment}</td>
      <td>
        <button class="view-client-btn" data-client-id="${client.id}">View</button>
      </td>
    `;
    clientsList.appendChild(tr);
  });
}

// View client action
function viewClient(id){
  alert("Redirecting to client reports page for client ID: " + id);
}

// Add event delegation for client view buttons
if(clientsList){
  clientsList.addEventListener('click', (e) => {
    if (e.target.classList.contains('view-client-btn')) {
      const clientId = parseInt(e.target.getAttribute('data-client-id'));
      viewClient(clientId);
    }
  });
}


// ===== Client Reports Page =====
const clientSelect = document.getElementById('clientSelect');
const reportContent = document.getElementById('reportContent');
const downloadReport = document.getElementById('downloadReport');

// Sample clients
const clientsData = [
  {id: 1, name: "John Doe", moodHistory: [3,4,2,5], assessments: [{type: "PHQ-9", score: 15}]},
  {id: 2, name: "Jane Smith", moodHistory: [6,5,7,6], assessments: [{type: "GAD-7", score: 8}]},
  {id: 3, name: "Alice Brown", moodHistory: [4,3,5,4], assessments: [{type: "PHQ-9", score: 12}]}
];

// Populate client selector
if(clientSelect){
  clientsData.forEach(client => {
    const option = document.createElement('option');
    option.value = client.id;
    option.textContent = client.name;
    clientSelect.appendChild(option);
  });
}

// Display client report
clientSelect?.addEventListener('change', () => {
  const selectedId = parseInt(clientSelect.value);
  const client = clientsData.find(c => c.id === selectedId);

  if(client){
    reportContent.innerHTML = `
      <h2>${client.name}'s Report</h2>
      <h3>Mood History</h3>
      <p>${client.moodHistory.join(' | ')}</p>
      <h3>Assessments</h3>
      <ul>
        ${client.assessments.map(a => `<li>${a.type}: ${a.score}</li>`).join('')}
      </ul>
    `;
  } else {
    reportContent.innerHTML = `<h2>Client Report</h2><p>Select a client to view reports</p>`;
  }
});

// Download PDF simulation
downloadReport?.addEventListener('click', () => {
  const selectedId = parseInt(clientSelect.value);
  if(!selectedId) {
    alert("Select a client first");
    return;
  }
  alert("Downloading PDF report for client ID: " + selectedId);
});

// ===== Messaging Page =====
(function(){
  const clientSelect = document.getElementById('clientSelect');
  const chatWindow = document.getElementById('chatWindow');
  const messageInput = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');

  const clientsData = [
    {id: 1, name: "John Doe", messages: []},
    {id: 2, name: "Jane Smith", messages: []},
    {id: 3, name: "Alice Brown", messages: []}
  ];

  // Populate client selector
  if(clientSelect){
    clientsData.forEach(client => {
      const option = document.createElement('option');
      option.value = client.id;
      option.textContent = client.name;
      clientSelect.appendChild(option);
    });
  }

  let selectedClient = null;

  clientSelect?.addEventListener('change', () => {
    const clientId = parseInt(clientSelect.value);
    selectedClient = clientsData.find(c => c.id === clientId);
    renderChat();
  });

  sendBtn?.addEventListener('click', () => {
    if(!selectedClient) {
      alert("Select a client first!");
      return;
    }
    const text = messageInput.value.trim();
    if(!text) return;
    
    // Add therapist message
    selectedClient.messages.push({from: "therapist", text});
    messageInput.value = '';
    renderChat();
  });

  function renderChat(){
    if (!chatWindow) return; // Add null check
    const selectedId = clientSelect.value;
    const selectedClient = clientsData.find(c => c.id == selectedId);
    if(!selectedClient){
      chatWindow.innerHTML = '<p>Select a client to start chatting.</p>';
      return;
    }
    chatWindow.innerHTML = '';
    selectedClient.messages.forEach(msg => {
      const p = document.createElement('p');
      p.classList.add('message', msg.from);
      p.textContent = msg.text;
      chatWindow.appendChild(p);
    });
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }
})();


// ===== Admin Dashboard =====
(function(){
  const totalUsers = document.getElementById('totalUsers');
  const highRiskUsers = document.getElementById('highRiskUsers');
  const flaggedContent = document.getElementById('flaggedContent');

  // Sample data
  const users = [
    {id:1,name:"John Doe",risk:"high"},
    {id:2,name:"Jane Smith",risk:"low"},
    {id:3,name:"Alice Brown",risk:"medium"}
  ];
  const flaggedPosts = [
    {id:1,content:"Example flagged post"}
  ];

  if (totalUsers) totalUsers.textContent = users.length;
  if (highRiskUsers) highRiskUsers.textContent = users.filter(u=>u.risk==="high").length;
  if (flaggedContent) flaggedContent.textContent = flaggedPosts.length;
})();


// ===== User Management =====
(function(){
  const userList = document.getElementById('userList');
  const users = [
    {id:1,name:"John Doe",role:"therapist"},
    {id:2,name:"Jane Smith",role:"user"},
    {id:3,name:"Alice Brown",role:"admin"}
  ];

  function renderUsers(){
    if (!userList) return; // Add null check
    userList.innerHTML = '';
    users.forEach(user=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${user.name}</td>
        <td>${user.role}</td>
        <td>
          <button class="edit-user-btn" data-user-id="${user.id}">Edit</button>
          <button class="delete-user-btn" data-user-id="${user.id}">Delete</button>
        </td>
      `;
      userList.appendChild(tr);
    });
  }

  window.editUser = function(id){
    alert("Edit user ID: "+id);
  }

  window.deleteUser = function(id){
    alert("Delete user ID: "+id);
  }

  // Add event delegation for user management buttons
  if(userList){
    userList.addEventListener('click', (e) => {
      if (e.target.classList.contains('edit-user-btn')) {
        const userId = parseInt(e.target.getAttribute('data-user-id'));
        editUser(userId);
      } else if (e.target.classList.contains('delete-user-btn')) {
        const userId = parseInt(e.target.getAttribute('data-user-id'));
        deleteUser(userId);
      }
    });
  }

  renderUsers();
})();


// ===== Content Moderation =====
(function(){
  const flaggedPosts = document.getElementById('flaggedPosts');
  if (!flaggedPosts) return; // Add null check - exit if element doesn't exist
  
  const posts = [
    {id:1, content:"This is inappropriate content"},
    {id:2, content:"Another flagged post"}
  ];

  posts.forEach(post=>{
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${post.content}</span>
      <button class="approve-post-btn" data-post-id="${post.id}">Approve</button>
    `;
    flaggedPosts.appendChild(li);
  });

  window.approvePost = function(id){
    alert("Approved post ID: "+id);
  }

  // Add event delegation for approve post buttons
  if(flaggedPosts){
    flaggedPosts.addEventListener('click', (e) => {
      if (e.target.classList.contains('approve-post-btn')) {
        const postId = parseInt(e.target.getAttribute('data-post-id'));
        approvePost(postId);
      }
    });
  }
})();


// ===== System Analytics =====
(function(){
  const usageGraph = document.getElementById('usageGraph');
  const postsGraph = document.getElementById('postsGraph');

  // Sample data (last 7 days)
  const dailyActiveUsers = [50, 65, 70, 80, 90, 75, 85];
  const postsPerDay = [10, 12, 8, 15, 18, 13, 20];

  function renderGraph(container, data){
    if (!container) return; // Add null check
    container.innerHTML = '';
    const max = Math.max(...data);
    data.forEach(value=>{
      const bar = document.createElement('div');
      bar.classList.add('graph-bar');
      bar.style.height = `${(value/max)*100}%`;
      bar.textContent = value;
      container.appendChild(bar);
    });
  }

  if(usageGraph) renderGraph(usageGraph, dailyActiveUsers);
  if(postsGraph) renderGraph(postsGraph, postsPerDay);
})();

// ===== Dashboard Page Event Listeners =====
const openJournalBtn = document.getElementById('openJournalBtn');
if(openJournalBtn){
  openJournalBtn.addEventListener('click', () => {
    window.location.href = 'journal.html';
  });
}
