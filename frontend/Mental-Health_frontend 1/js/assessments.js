// Render a 5-question assessment for the given type and handle scoring + optional save to journal
(function(){
  const byId = (id) => document.getElementById(id);
  const qs = new URLSearchParams(location.search);
  const type = (qs.get('type') || 'phq9').toLowerCase();

  const BANK = {
    phq9: {
      title: 'PHQ-9 Depression Assessment',
      subtitle: 'Answer five quick questions. Results estimate depression severity.',
      questions: [
        'Little interest or pleasure in doing things',
        'Feeling down, depressed, or hopeless',
        'Trouble falling or staying asleep, or sleeping too much',
        'Feeling tired or having little energy',
        'Poor appetite or overeating'
      ],
      scale: ['0 - Not at all','1 - Several days','2 - More than half the days','3 - Nearly every day']
    },
    gad7: {
      title: 'GAD-7 Anxiety Assessment',
      subtitle: 'Answer five quick questions. Results estimate anxiety severity.',
      questions: [
        'Feeling nervous, anxious, or on edge',
        'Not being able to stop or control worrying',
        'Worrying too much about different things',
        'Trouble relaxing',
        'Being so restless that it is hard to sit still'
      ],
      scale: ['0 - Not at all','1 - Several days','2 - More than half the days','3 - Nearly every day']
    },
    stress: {
      title: 'Stress Level Assessment',
      subtitle: 'Answer five quick questions. Results estimate current stress level.',
      questions: [
        'I feel overwhelmed by my tasks',
        'I feel irritable or on edge',
        'I find it hard to focus or concentrate',
        'I notice tension in my body (neck, shoulders, jaw)',
        'I feel pressure to meet expectations'
      ],
      scale: ['0 - Never','1 - Rarely','2 - Sometimes','3 - Often']
    },
    wellness: {
      title: 'Overall Wellness Check',
      subtitle: 'Answer five quick questions. Results estimate your general wellness.',
      questions: [
        'I feel positive about my day',
        'I feel connected to others',
        'I have energy to do what I need',
        'I sleep well and feel rested',
        'I can manage my stress effectively'
      ],
      scale: ['0 - Strongly disagree','1 - Disagree','2 - Agree','3 - Strongly agree']
    }
  };

  const cfg = BANK[type] || BANK.phq9;
  const titleEl = byId('assessTitle');
  const subEl = byId('assessSubtitle');
  const qWrap = byId('questions');
  const form = byId('assessmentForm');
  const status = byId('assessmentStatus');
  const resultCard = byId('resultCard');
  const resultBody = byId('resultBody');
  const saveBtn = byId('saveToJournal');

  function render() {
    if (titleEl) titleEl.textContent = cfg.title;
    if (subEl) subEl.textContent = cfg.subtitle;
    if (!qWrap) return;
    qWrap.innerHTML = '';
    cfg.questions.forEach((q, i) => {
      const div = document.createElement('div');
      div.className = 'form-group';
      const name = `q${i+1}`;
      const opts = cfg.scale.map((label, val) => {
        return `<label style="display:inline-flex;align-items:center;gap:.4rem;margin-right:1rem;">
          <input type="radio" name="${name}" value="${val}" required> <span>${label}</span>
        </label>`;
      }).join('');
      div.innerHTML = `
        <label style="font-weight:600; display:block; margin-bottom:.5rem;">${i+1}. ${q}</label>
        <div>${opts}</div>
      `;
      qWrap.appendChild(div);
    });
  }

  function scoreForm(fd) {
    let total = 0;
    for (let i=1;i<=5;i++) {
      const v = Number(fd.get(`q${i}`) || 0);
      total += isNaN(v) ? 0 : v;
    }
    const max = 5 * 3; // 0..3 scale per question
    const pct = Math.round((total / max) * 100);
    return { total, max, pct };
  }

  function labelFromScore(pct) {
    if (type === 'phq9') {
      if (pct >= 67) return {tag:'Moderately Severe', color:'#ef4444'};
      if (pct >= 45) return {tag:'Moderate', color:'#f59e0b'};
      if (pct >= 20) return {tag:'Mild', color:'#10b981'};
      return {tag:'Minimal', color:'#10b981'};
    }
    if (type === 'gad7' || type === 'stress') {
      if (pct >= 67) return {tag:'High', color:'#ef4444'};
      if (pct >= 45) return {tag:'Moderate', color:'#f59e0b'};
      return {tag:'Mild', color:'#10b981'};
    }
    // wellness
    if (pct >= 67) return {tag:'Good', color:'#10b981'};
    if (pct >= 45) return {tag:'Fair', color:'#f59e0b'};
    return {tag:'Needs Attention', color:'#ef4444'};
  }

  function summarize(type, pct){
    if (type==='phq9') return 'Screen suggests depressive symptoms proportional to score. Consider positive activities and, if needed, professional support.';
    if (type==='gad7') return 'Screen suggests anxiety symptoms proportional to score. Mindfulness and breathing routines may help.';
    if (type==='stress') return 'Elevated stress can impact health. Try short breaks, light activity and structured planning.';
    return 'Your overall wellness reflects recent patterns. Keep reinforcing helpful routines and supports.';
  }

  async function saveResultToJournal(pct, tag) {
    try {
      if (!(window.api && window.api.isAuthenticated())) throw new Error('Not authenticated');
      const text = `${cfg.title} result: ${pct}% (${tag}).`;
      const res = await window.api.createJournalEntry({ text, mood_rating: null, tags: [type, 'assessment'] });
      status.textContent = 'Saved to Journal!';
      status.style.color = '#10b981';
      saveBtn.disabled = true;
      return res;
    } catch (e) {
      status.textContent = 'Failed to save to Journal: ' + e.message;
      status.style.color = '#ef4444';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    render();
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const { total, max, pct } = scoreForm(fd);
      const { tag, color } = labelFromScore(pct);
      const sum = summarize(type, pct);
      resultBody.innerHTML = `
        <div style="font-size: var(--font-size-xl); margin-bottom: var(--spacing-3);">Score: <strong>${total}</strong> / ${max} (${pct}%)</div>
        <div style="margin-bottom: var(--spacing-3);">Category: <span style="padding:.25rem .5rem;border-radius:8px;background:${color}22;color:${color};">${tag}</span></div>
        <div style="color: var(--text-secondary);">${sum}</div>
      `;
      resultCard.style.display = 'block';
      saveBtn.disabled = false;
      status.textContent = '';
    });
    saveBtn.addEventListener('click', async () => {
      const text = resultBody.textContent || '';
      const m = text.match(/(\d+)%/);
      const pct = m ? Number(m[1]) : 0;
      const tagMatch = text.match(/Category:.*?([A-Za-z ]+)/);
      const tag = tagMatch ? tagMatch[1] : 'Assessment';
      await saveResultToJournal(pct, tag);
    });
  });
})();
