// Analytics page logic: fetch real data and render charts; refresh on SSE events
(function(){
  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  let moodChart, sentimentChart;
  let stressChart, activityChart, sleepMoodChart;
  let refreshing = false; // prevent overlapping refreshes

  function pct(n) { return Math.max(0, Math.min(100, Math.round(n))); }

  async function loadOverview() {
    try {
      const data = await window.api.getOverview();
      if (data && data.counts && (data.counts.positive || data.counts.neutral || data.counts.negative)) {
        renderSentimentChart(data.counts);
        return;
      }
      // Fallback: compute counts from journal entries
      await computeOverviewFromEntries();
    } catch (e) {
      console.warn('Overview load failed, using fallback from entries:', e);
      await computeOverviewFromEntries();
    }
  }

  async function loadTrends() {
    try {
      const res = await window.api.getTrends(30);
      if (Array.isArray(res) && res.length) {
        const labels = res.map(d => new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric'}));
        const values = res.map(d => Math.round((d.avg_score || 0.5) * 10)); // convert 0..1 to 0..10 mood scale
        renderMoodChart(labels, values);
        return;
      }
      await computeTrendsFromEntries();
    } catch (e) {
      console.warn('Trends load failed, using fallback from entries:', e);
      await computeTrendsFromEntries();
    }
  }

  async function computeOverviewFromEntries(){
    try {
      const entries = await window.api.getJournalEntries();
      const counts = { positive:0, neutral:0, negative:0 };
      entries.forEach(e => {
        const s = (e.sentiment || (e.sentiment_analysis && e.sentiment_analysis.sentiment) || 'NEUTRAL').toUpperCase();
        if (s === 'POSITIVE') counts.positive++;
        else if (s === 'NEGATIVE') counts.negative++;
        else counts.neutral++;
      });
      renderSentimentChart(counts);
    } catch (e) {
      console.warn('Fallback overview failed:', e);
      renderSentimentChart({positive:0, neutral:0, negative:0});
    }
  }

  async function computeTrendsFromEntries(){
    try {
      const entries = await window.api.getJournalEntries();
      // Bucket last 30 days by date
      const map = new Map();
      const today = new Date();
      for (let i=29; i>=0; i--) {
        const d = new Date(today); d.setDate(d.getDate()-i);
        const key = d.toISOString().slice(0,10);
        map.set(key, []);
      }
      (entries||[]).forEach(e => {
        const ts = e.timestamp || e.created_at || e.createdAt;
        if (!ts) return;
        const key = new Date(ts).toISOString().slice(0,10);
        if (map.has(key)) map.get(key).push(e);
      });
      const labels = [];
      const values = [];
      for (const [key, arr] of map.entries()){
        labels.push(new Date(key).toLocaleDateString(undefined, { month:'short', day:'numeric'}));
        if (!arr.length){ values.push(5); continue; }
        const avg = arr.reduce((s,it)=> s + (typeof it.score==='number'? it.score : (it.sentiment_analysis && it.sentiment_analysis.confidence_score) || 0.5), 0) / arr.length;
        values.push(Math.round(avg*10));
      }
      renderMoodChart(labels, values);
    } catch (e) {
      console.warn('Fallback trends failed:', e);
      renderMoodChart(['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], [6,5,8,5,7,6,8]);
    }
  }

  function renderMoodChart(labels, values) {
    const ctx = document.getElementById('moodChart');
    if (!ctx) return;
    try {
      const existing = Chart.getChart(ctx);
      if (existing) existing.destroy();
      if (moodChart) moodChart.destroy();
    } catch(_) {}
    moodChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Mood (0-10)',
          data: values,
          tension: 0.35,
          fill: true,
          backgroundColor: 'rgba(59,130,246,0.12)',
          borderColor: 'rgba(59,130,246,1)',
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { min: 0, max: 10, ticks: { stepSize: 2 } }
        },
        plugins: { legend: { display: false } }
      }
    });
  }

  function renderSentimentChart(counts) {
    const ctx = document.getElementById('sentimentChart');
    if (!ctx) return;
    try {
      const existing = Chart.getChart(ctx);
      if (existing) existing.destroy();
      if (sentimentChart) sentimentChart.destroy();
    } catch(_) {}
    const pos = counts.positive || 0;
    const neu = counts.neutral || 0;
    const neg = counts.negative || 0;
    const total = Math.max(1, pos + neu + neg);
    const labels = ['Positive', 'Neutral', 'Negative'];
    const values = [pos, neu, neg];

    sentimentChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }

  async function computeStressPatternsFromEntries(){
    try {
      const entries = await window.api.getJournalEntries();
      const stressVals = [];
      entries.forEach(it=>{
        let tags = Array.isArray(it.tags) ? it.tags.join(',') : (it.tags || '');
        try { tags = String(tags).toLowerCase(); } catch(_) { tags = ''; }
        if (tags.includes('stress')){
          // If text like "result: 72% (High)", parse percent
          const m=(it.text||'').match(/(\d+)%/);
          const pct=m?Number(m[1]):(typeof it.score==='number'? Math.round(it.score*100):50);
          stressVals.push(Math.round(Math.min(100,Math.max(0,pct)))/10);
        } else {
          const sent=(it.sentiment||(it.sentiment_analysis&&it.sentiment_analysis.sentiment)||'NEUTRAL').toUpperCase();
          const inferred = sent==='NEGATIVE'?8 : sent==='NEUTRAL'?5 : 3; // heuristic
          stressVals.push(inferred);
        }
      });
      const avg = stressVals.length ? Math.round((stressVals.reduce((a,b)=>a+b,0)/stressVals.length)*10)/10 : 0;
      const ctx = document.getElementById('stressChart');
      if (!ctx) return;
      try {
        if (stressChart) stressChart.destroy();
        stressChart = new Chart(ctx, {
          type: 'bar',
          data: { labels: ['Stress'], datasets: [{ label: 'Stress (0-10)', data: [avg], backgroundColor: 'rgba(239,68,68,0.3)', borderColor: '#ef4444' }]},
          options: { responsive:true, maintainAspectRatio:false, scales:{ y:{ min:0, max:10 } }, plugins:{ legend:{ display:false } } }
        });
      } catch (e) { console.warn('Render stress chart failed:', e); }
    } catch (e) {
      console.warn('Compute stress patterns failed:', e);
    }
  }

  async function computeActivityImpactFromEntries(){
    try {
      const entries = await window.api.getJournalEntries();
      const active=[], inactive=[];
      entries.forEach(e=>{
        const text=(e.text||'');
        let tags = Array.isArray(e.tags) ? e.tags.join(',') : (e.tags || '');
        const score = typeof e.score==='number'? e.score : (e.sentiment_analysis&&e.sentiment_analysis.confidence_score)||0.5;
        const mood = Math.round(score*10); // 0..10
        if (/\b(run|walk|gym|exercise|workout|yoga|cycle|swim)\b/i.test(text) || /activity/i.test(String(tags))) active.push(mood); else inactive.push(mood);
      });
      const ctx = document.getElementById('activityChart');
      if (!ctx) return;
      try {
        const avgActive = active.length ? Math.round(active.reduce((s,it)=>s+it,0)/active.length) : 0;
        const avgInactive = inactive.length ? Math.round(inactive.reduce((s,it)=>s+it,0)/inactive.length) : 0;
        if (activityChart) activityChart.destroy();
        activityChart = new Chart(ctx, {
          type: 'bar',
          data: { labels: ['Active', 'Inactive'], datasets: [{ label: 'Mood (0-10)', data: [avgActive, avgInactive], backgroundColor: ['rgba(59,130,246,0.3)', 'rgba(239,68,68,0.3)'], borderColor: ['#10b981', '#ef4444'] }]},
          options: { responsive:true, maintainAspectRatio:false, scales:{ y:{ min:0, max:10 } }, plugins:{ legend:{ display:false } } }
        });
      } catch (e) { console.warn('Render activity chart failed:', e); }
    } catch (e) {
      console.warn('Compute activity impact failed:', e);
    }
  }

  async function computeSleepVsMoodFromEntries(){
    try {
      const entries = await window.api.getJournalEntries();
      const sleepMood = [];
      entries.forEach(e=>{
        const text=(e.text||'');
        let tags = Array.isArray(e.tags) ? e.tags.join(',') : (e.tags || '');
        const score = typeof e.score==='number'? e.score : (e.sentiment_analysis&&e.sentiment_analysis.confidence_score)||0.5;
        const mood = Math.round(score*10); // 0..10
        if (/\bsleep\b/i.test(text) || /sleep/i.test(String(tags))) sleepMood.push(mood);
      });
      const ctx = document.getElementById('sleepMoodChart');
      if (!ctx) return;
      try {
        const avgSleepMood = sleepMood.length ? Math.round(sleepMood.reduce((s,it)=>s+it,0)/sleepMood.length) : 0;
        if (sleepMoodChart) sleepMoodChart.destroy();
        sleepMoodChart = new Chart(ctx, {
          type: 'bar',
          data: { labels: ['Sleep Mood'], datasets: [{ label: 'Mood (0-10)', data: [avgSleepMood], backgroundColor: 'rgba(59,130,246,0.3)', borderColor: '#10b981' }]},
          options: { responsive:true, maintainAspectRatio:false, scales:{ y:{ min:0, max:10 } }, plugins:{ legend:{ display:false } } }
        });
      } catch (e) { console.warn('Render sleep mood chart failed:', e); }
    } catch (e) {
      console.warn('Compute sleep vs mood failed:', e);
    }
  }

  async function refreshAll() {
    if (!(window.api && window.api.isAuthenticated())) return; // require login
    if (refreshing) return; // throttle overlapping calls
    refreshing = true;
    try {
      await Promise.all([loadOverview(), loadTrends()]);
      // Also refresh the derived charts from journal entries
      await Promise.allSettled([
        computeStressPatternsFromEntries(),
        computeActivityImpactFromEntries(),
        computeSleepVsMoodFromEntries()
      ]);
    } finally {
      refreshing = false;
    }
  }

  function setupRealtime() {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;
      const url = `http://localhost:5000/events/stream?jwt=${encodeURIComponent(token)}`;
      let es = new EventSource(url, { withCredentials: false });
      es.onmessage = async (evt) => {
        try {
          const payload = JSON.parse(evt.data);
          if (payload && payload.event === 'journal_created') {
            // A new journal entry was created, refresh analytics
            await refreshAll();
          }
        } catch (_) {}
      };
      es.onerror = () => {
        es.close();
        setTimeout(setupRealtime, 3000);
      };
    } catch (err) {
      console.warn('Failed to init analytics SSE:', err);
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if (!window.api) return;
    await refreshAll();
    setupRealtime();
  });

  // ===== Real-time Export & Share =====
  async function snapshotData(){
    // Always fetch latest; use fallbacks if analytics endpoints are empty
    const [overview, trends] = await Promise.allSettled([
      (async ()=>{
        try { return await window.api.getOverview(); } catch(e){ return null; }
      })(),
      (async ()=>{
        try { return await window.api.getTrends(30); } catch(e){ return null; }
      })()
    ]);
    let counts = overview.value && overview.value.counts ? overview.value.counts : null;
    if (!counts) {
      await computeOverviewFromEntries(); // renders chart
      const entries = await window.api.getJournalEntries();
      counts = { positive:0, neutral:0, negative:0 };
      entries.forEach(e=>{
        const s = (e.sentiment || (e.sentiment_analysis && e.sentiment_analysis.sentiment) || 'NEUTRAL').toUpperCase();
        if (s==='POSITIVE') counts.positive++; else if (s==='NEGATIVE') counts.negative++; else counts.neutral++;
      });
    }

    let series = Array.isArray(trends.value) && trends.value.length ? trends.value : null;
    if (!series) {
      // fallback build
      const entries = await window.api.getJournalEntries();
      const map = new Map();
      const today = new Date();
      for (let i=29; i>=0; i--) { const d=new Date(today); d.setDate(d.getDate()-i); map.set(d.toISOString().slice(0,10), []);}    
      (entries||[]).forEach(e=>{ const ts=e.timestamp||e.created_at||e.createdAt; if(!ts) return; const k=new Date(ts).toISOString().slice(0,10); if(map.has(k)) map.get(k).push(e); });
      series = Array.from(map.entries()).map(([date, arr])=>({ date, avg_score: arr.length? (arr.reduce((s,it)=> s + (typeof it.score==='number'? it.score : (it.sentiment_analysis && it.sentiment_analysis.confidence_score) || 0.5),0)/arr.length) : 0.5 }));
    }
    const entries = await window.api.getJournalEntries();
    return { counts, series, entries };
  }

  function toCSV({counts, series, entries}){
    const lines = [];
    lines.push('Section,Field,Value');
    lines.push(`Overview,Positive,${counts.positive||0}`);
    lines.push(`Overview,Neutral,${counts.neutral||0}`);
    lines.push(`Overview,Negative,${counts.negative||0}`);
    lines.push('');
    lines.push('Trends,Date,AvgScore(0-1)');
    series.forEach(d=> lines.push(`Trend,${d.date},${(d.avg_score||0).toFixed(4)}`));
    lines.push('');
    lines.push('Entries,Timestamp,Sentiment,Score,Text');
    (entries||[]).forEach(e => {
      const ts = e.timestamp || '';
      const sent = e.sentiment || (e.sentiment_analysis && e.sentiment_analysis.sentiment) || '';
      const sc = (typeof e.score==='number'? e.score : (e.sentiment_analysis && e.sentiment_analysis.confidence_score)) || '';
      const text = (e.text||'').replace(/"/g,'""');
      lines.push(`Entry,${ts},${sent},${sc},"${text}"`);
    });
    return lines.join('\n');
  }

  async function exportProgress(kind){
    try {
      const data = await snapshotData();
      if (kind === 'csv') {
        const csv = toCSV(data);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `mht_analytics_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        return;
      }
      if (kind === 'pdf') {
        // Lightweight printable report (user can Save as PDF)
        const w = window.open('', '_blank');
        const donut = document.getElementById('sentimentChart');
        const mood = document.getElementById('moodChart');
        const donutImg = donut ? donut.toDataURL('image/png') : '';
        const moodImg = mood ? mood.toDataURL('image/png') : '';
        w.document.write(`<!DOCTYPE html><html><head><title>Analytics Report</title>
          <style>body{font-family:Inter, Arial, sans-serif; padding:24px;} h1{margin:0 0 8px;} .sec{margin:16px 0;} img{max-width:100%; height:auto;}</style>
        </head><body>
          <h1>AI Mental Health Analytics</h1>
          <div class="sec"><strong>Date:</strong> ${new Date().toLocaleString()}</div>
          <div class="sec"><h2>Overview</h2><div>Positive: ${data.counts.positive||0} | Neutral: ${data.counts.neutral||0} | Negative: ${data.counts.negative||0}</div></div>
          <div class="sec"><h2>Mood Trends (30d)</h2>${moodImg?`<img src="${moodImg}"/>`:'<div>(chart not available)</div>'}</div>
          <div class="sec"><h2>BERT Sentiment Distribution</h2>${donutImg?`<img src="${donutImg}"/>`:'<div>(chart not available)</div>'}</div>
          <div class="sec"><h2>Recent Entries</h2><ol>${(data.entries||[]).slice(0,10).map(e=>`<li>${(e.timestamp||'')} — ${(e.sentiment|| (e.sentiment_analysis&&e.sentiment_analysis.sentiment)||'')} — ${(e.text||'').replace(/</g,'&lt;')}</li>`).join('')}</ol></div>
        </body></html>`);
        w.document.close(); w.focus(); w.print();
        return;
      }
    } catch (e) {
      alert('Export failed: ' + e.message);
    }
  }

  async function shareProgress(){
    try {
      const { counts } = await snapshotData();
      const body = encodeURIComponent(
        `Hi,\n\nHere is my current AI Mental Health Tracker summary:\n\n`+
        `Positive: ${counts.positive||0}\nNeutral: ${counts.neutral||0}\nNegative: ${counts.negative||0}\n\n`+
        `Shared from AI Mental Health Tracker.`
      );
      const subject = encodeURIComponent('My AI Mental Health Analytics');
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
    } catch (e) {
      alert('Share failed: ' + e.message);
    }
  }

  // expose for buttons used in progress.html
  window.exportProgress = exportProgress;
  window.shareProgress = shareProgress;
})();
