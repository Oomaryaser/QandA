(function(){
  'use strict';

  // Quiz data
  const questions = [
    {
      q: 'What does IVF stand for?',
      options: [
        'In Vitro Fertilization.',
        'In Vivo Fertilization.',
        'Intravenous Fertilization.',
        'Internal Vaginal Fertilization.'
      ],
      answer: 0,
    },
    {
      q: 'What is the main purpose of IVF treatment?',
      options: [
        'To prevent pregnancy.',
        'To help couples conceive when natural conception fails.',
        'To treat sexually transmitted infections.',
        'To reduce menstrual pain.'
      ],
      answer: 1,
    },
    {
      q: 'How does ICSI differs from standard IVF?',
      options: [
        'ICSI involves injecting sperm directly into the egg, while IVF mixes sperms and eggs in a dish.',
        'ICSI is done inside the women\'s body, while IVF is done in a lab.',
        'ICSI does not require sperm, while IVF do.',
        'ICSI is done for female infertility, while IVF is for male infertility.'
      ],
      answer: 0,
    },
    {
      q: 'What is the first step in IVF process?',
      options: [
        'Egg retrieval.',
        'Embryo transfer.',
        'Ovarian stimulation with hormones.',
        'Sperm collection.'
      ],
      answer: 2,
    },
    {
      q: 'Why is ICSI commonly used in IVF programs?',
      options: [
        'To increase egg production.',
        'To help with severe male infertility (low sperm count/poor motility).',
        'To prevent multiple pregnancies.',
        'To reduce treatment costs.'
      ],
      answer: 1,
    },
    {
      q: 'Where does fertilization occur in IVF?',
      options: [
        'Inside the fallopian tube.',
        'In the uterus.',
        'In a laboratory dish.',
        'In the ovary.'
      ],
      answer: 2,
    },
    {
      q: 'What is a key advantage of IVF over natural conception for infertile couples?',
      options: [
        'It guarantees a pregnancy in the first attempt.',
        'It allows fertilization to occur outside the body, bypassing certain infertility barriers.',
        'It eliminates the need for sperm entirely.',
        'It prevents all risks of genetic disorders.'
      ],
      answer: 1,
    },
    {
      q: 'How many days after fertilization is an embryo typically transferred to the uterus?',
      options: [
        '1 day.',
        '3-5 days.',
        '10 days.',
        '14 days.'
      ],
      answer: 1,
    },
    {
      q: 'What is a common risk associated with IVF pregnancies?',
      options: [
        'Higher chance of twins or triplets.',
        'Guaranteed ectopic pregnancy.',
        'No risks at all.',
        'Increased risk of cancer.'
      ],
      answer: 0,
    },
    {
      q: 'Is ICSI is recommended for all male infertility cases?',
      options: [
        'Yes, it is the only solution.',
        'No, only when there is poor sperm quality or low count.',
        'Only for female infertility.',
        'Never recommended.'
      ],
      answer: 1,
    },
  ];

  const QUIZ_KEY = 'ivf-icsi-quiz-state-v2';
  const $ = (sel, ctx=document) => ctx.querySelector(sel);
  const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));

  const quizEl = $('#quiz');
  const correctCountEl = $('#correctCount');
  const wrongCountEl = $('#wrongCount');
  const unansweredCountEl = $('#unansweredCount');
  const skippedCountEl = $('#skippedCount');
  const barCorrect = $('#barCorrect');
  const barWrong = $('#barWrong');
  const barRest = $('#barRest');
  const barSkipped = $('#barSkipped');

  const resetBtn = $('#resetBtn');

  const letters = ['A', 'B', 'C', 'D'];
  const AUTO_ADVANCE_DELAY = 1500; // ms (slightly slower so the user can see the correct answer)
  const SKIPPED = -1; // sentinel for skipped question
  let advanceTimer = null;

  // --- Audio helpers (for reliable playback) ---
  let audioCtx = null;
  function ensureAudioCtx(){
    if(!audioCtx){
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return null;
      audioCtx = new AC();
    }
    return audioCtx;
  }
  async function resumeAudio(){
    try{
      const ctx = ensureAudioCtx();
      if(!ctx) return;
      if(ctx.state === 'suspended'){
        await ctx.resume();
      }
    } catch(_){}
  }
  // Attempt to unlock audio on first user interaction
  window.addEventListener('pointerdown', () => { resumeAudio(); }, { once:true });

  function playPassSound(ctx){
    try{
      const master = ctx.createGain();
      master.gain.value = 0.35; // louder than before
      master.connect(ctx.destination);

      // Layer 1: triangle arpeggio (C5 -> E5 -> G5)
      const tri = ctx.createOscillator(); tri.type = 'triangle';
      const tg = ctx.createGain(); tg.gain.value = 0.0001; tg.connect(master);
      tri.connect(tg);
      const t0 = ctx.currentTime; const step = 0.12;
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((f, i) => {
        const t = t0 + i*step;
        tri.frequency.setValueAtTime(f, t);
        tg.gain.setValueAtTime(0.0001, t);
        tg.gain.exponentialRampToValueAtTime(0.28, t + 0.05);
        tg.gain.exponentialRampToValueAtTime(0.0001, t + step);
      });

      // Layer 2: sine sparkle on top (G5 -> C6)
      const sin = ctx.createOscillator(); sin.type = 'sine';
      const sg = ctx.createGain(); sg.gain.value = 0.0001; sg.connect(master);
      sin.connect(sg);
      sin.frequency.setValueAtTime(783.99, t0 + step*0.5);
      sin.frequency.linearRampToValueAtTime(1046.5, t0 + step*2);
      sg.gain.setValueAtTime(0.0001, t0 + step*0.5);
      sg.gain.exponentialRampToValueAtTime(0.22, t0 + step*0.5 + 0.05);
      sg.gain.exponentialRampToValueAtTime(0.0001, t0 + step*2 + 0.1);

      // Layer 3: short shimmer noise
      const noise = ctx.createBufferSource();
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for(let i=0;i<data.length;i++){ data[i] = (Math.random()*2-1) * (1 - i/data.length); }
      noise.buffer = buffer;
      const ng = ctx.createGain(); ng.gain.value = 0.08;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000;
      noise.connect(ng).connect(hp).connect(master);

      tri.start(t0); sin.start(t0 + step*0.4); noise.start(t0 + step);
      const end = t0 + step*3 + 0.3;
      tri.stop(end); sin.stop(end); noise.stop(end);
    } catch(_){}
  }
  function playFailSound(ctx){
    try{
      const master = ctx.createGain();
      master.gain.value = 0.8; // even louder
      // Add a compressor to increase perceived loudness without clipping
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.setValueAtTime(-24, ctx.currentTime);
      comp.knee.setValueAtTime(30, ctx.currentTime);
      comp.ratio.setValueAtTime(12, ctx.currentTime);
      comp.attack.setValueAtTime(0.003, ctx.currentTime);
      comp.release.setValueAtTime(0.25, ctx.currentTime);
      comp.connect(master);
      master.connect(ctx.destination);
      const base = 196.00; // G3
      const seq = [base*1.0, base*0.84, base*0.75];
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
  lowpass.frequency.value = 3200; // allow more highs for presence
      lowpass.Q.value = 0.9;
      lowpass.connect(comp);
      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      o1.type = 'triangle';
      o2.type = 'triangle';
      o1.detune.value = -7;
      o2.detune.value = +7;
  const g = ctx.createGain();
  g.gain.value = 0.0001;
      g.connect(lowpass);
      o1.connect(g); o2.connect(g);
      const t0 = ctx.currentTime;
      const step = 0.22;
      seq.forEach((f, i) => {
        const t = t0 + i*step;
        o1.frequency.setValueAtTime(f, t);
        o2.frequency.setValueAtTime(f*0.995, t);
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.5, t + 0.06); // much stronger peak
        g.gain.exponentialRampToValueAtTime(0.0001, t + step - 0.02);
      });
      // short noise sigh
      const noise = ctx.createBufferSource();
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for(let i=0;i<data.length;i++){ data[i] = (Math.random()*2-1) * (1 - i/data.length); }
      noise.buffer = buffer;
      const ng = ctx.createGain(); ng.gain.value = 0.28; // louder sigh
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 380;
      noise.connect(ng).connect(hp).connect(lowpass);

      // Add a low sine "thump" layer for impact
      const kick = ctx.createOscillator();
      const kg = ctx.createGain();
      kick.type = 'sine';
      kg.gain.setValueAtTime(0.0001, ctx.currentTime);
      kg.gain.exponentialRampToValueAtTime(0.7, ctx.currentTime + 0.02);
      kg.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      kick.frequency.setValueAtTime(140, ctx.currentTime);
      kick.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.2);
      kick.connect(kg).connect(comp);
      o1.start(t0); o2.start(t0); kick.start(t0);
      noise.start(t0 + seq.length*step - 0.1);
      const end = t0 + seq.length*step + 0.35;
      o1.stop(end); o2.stop(end); noise.stop(end); kick.stop(t0 + 0.36);
    } catch(_){}
  }
  async function playResultSound(passed){
    try{
      const ctx = ensureAudioCtx();
      if(!ctx) return;
      if(ctx.state === 'suspended') await ctx.resume();
      // Simple reverb send for more spatial feel
      const reverbIn = ctx.createGain();
      const reverbOut = ctx.createGain();
      reverbIn.gain.value = 0.3; // send amount
      reverbOut.gain.value = 0.4;
      // Build a tiny feedback delay network (very lightweight)
      const d1 = ctx.createDelay(); d1.delayTime.value = 0.045;
      const d2 = ctx.createDelay(); d2.delayTime.value = 0.075;
      const d3 = ctx.createDelay(); d3.delayTime.value = 0.12;
      const fg = ctx.createGain(); fg.gain.value = 0.35;
      const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 3800;
      // reverb network wiring
      reverbIn.connect(d1); d1.connect(d2); d2.connect(d3); d3.connect(tone).connect(reverbOut);
      d3.connect(fg).connect(d1); // feedback loop
      reverbOut.connect(ctx.destination);

      // Wrap the original play functions to also feed reverb
      const originalDest = ctx.destination;
      const mix = ctx.createGain(); mix.gain.value = 1.0;
      mix.connect(originalDest);
      mix.connect(reverbIn);

      // Patch internal play functions to use 'mix' as destination by temporarily overriding connect
      const nodeConnect = AudioNode.prototype.connect;
      try{
        AudioNode.prototype.connect = function(){
          const args = Array.from(arguments);
          if(args[0] === originalDest){ args[0] = mix; }
          return nodeConnect.apply(this, args);
        };
        if(passed) playPassSound(ctx); else playFailSound(ctx);
      } finally {
        AudioNode.prototype.connect = nodeConnect;
      }
    } catch(_){}
  }

  function loadState(){
    try {
      // Prefer localStorage for persistent progress
      let raw = localStorage.getItem(QUIZ_KEY);
      // Migrate from sessionStorage if found and localStorage empty
      if(!raw){
        const sessionRawV2 = sessionStorage.getItem(QUIZ_KEY);
        const sessionRawV1 = sessionStorage.getItem('ivf-icsi-quiz-state-v1');
        raw = sessionRawV2 || sessionRawV1;
        if(raw){
          try { localStorage.setItem(QUIZ_KEY, raw); } catch(_) {}
        }
      }
      if(!raw) return { answers: Array(questions.length).fill(null), index: 0 };
      const parsed = JSON.parse(raw);
      if(!Array.isArray(parsed.answers) || parsed.answers.length !== questions.length){
        return { answers: Array(questions.length).fill(null), index: 0 };
      }
      // normalize index
      let idx = typeof parsed.index === 'number' ? parsed.index : 0;
      if(idx < 0) idx = 0;
      if(idx >= questions.length) idx = questions.length - 1;
      const state = { answers: parsed.answers, index: idx };
      return state;
    } catch(e){
      return { answers: Array(questions.length).fill(null), index: 0 };
    }
  }

  function saveState(state){
    try { localStorage.setItem(QUIZ_KEY, JSON.stringify(state)); } catch(_) {}
  }

  function tally(state){
    let c=0, w=0, u=0, s=0;
    state.answers.forEach((a, i) => {
      if(a === SKIPPED){ s++; return; }
      if(a === null || a === undefined){ u++; return; }
      if(a === questions[i].answer) c++; else w++;
    });
    return {c,w,u,s};
  }

  function updateProgress(state){
    const {c,w,u,s} = tally(state);
    correctCountEl.textContent = c;
    wrongCountEl.textContent = w;
    unansweredCountEl.textContent = u;
    if (skippedCountEl) skippedCountEl.textContent = s;
    const total = questions.length;
    const pc = (c/total)*100;
    const pw = (w/total)*100;
    const ps = (s/total)*100;
    const pr = Math.max(0, 100 - pc - pw - ps);
    barCorrect.style.width = pc + '%';
  barCorrect.style.left = '0%';
  barWrong.style.width = pw + '%';
  barWrong.style.left = pc + '%';
    if(barSkipped){
      barSkipped.style.width = ps + '%';
      barSkipped.style.left = (pc + pw) + '%';
    }
    barRest.style.width = pr + '%';
    barRest.style.left = (pc + pw + ps) + '%';
    const bar = $('.progress-bar');
    bar.setAttribute('aria-valuenow', String(c));
  }

  function render(){
    const state = loadState();
    clearTimeout(advanceTimer);
    quizEl.innerHTML = '';

    const allAnswered = state.answers.every(a => a !== null && a !== undefined);
    if(allAnswered && state.index >= questions.length){
      renderSummary(state);
      updateProgress(state);
      return;
    }

    // Clamp index to first unanswered after current if current is answered
    let idx = state.index;
    if(idx >= questions.length) idx = questions.length - 1;

    const q = questions[idx];
    const locked = state.answers[idx] !== null && state.answers[idx] !== undefined; // prevent changes if already answered/skipped
    const card = document.createElement('article');
    card.className = 'question-card';
    card.innerHTML = `
      <div class="q-header">
        <div class="q-index">${idx+1} / ${questions.length}</div>
        <h2 class="q-title">${q.q}</h2>
      </div>
      <div class="options" role="radiogroup" aria-label="Options for question ${idx+1}"></div>
      <div class="feedback" id="fb-${idx}" aria-live="polite"></div>
      <div class="actions">
        <button id="skipBtn" class="btn btn-secondary" type="button" ${locked ? 'disabled' : ''}>Skip</button>
      </div>
    `;
    const optionsEl = $('.options', card);
    q.options.forEach((opt, i) => {
      const selected = state.answers[idx] === i;
      const isAnswered = state.answers[idx] !== null && state.answers[idx] !== undefined;
      const isCorrect = isAnswered && i === q.answer && selected;
      const isWrong = isAnswered && selected && i !== q.answer;
      const option = document.createElement('label');
      option.className = 'option';
      option.dataset.state = isCorrect ? 'correct' : isWrong ? 'wrong' : '';
      option.innerHTML = `
        <input type="radio" name="q-${idx}" ${selected ? 'checked' : ''} ${locked ? 'disabled' : ''} aria-checked="${selected ? 'true':'false'}" aria-label="${letters[i]}" />
        <span class="letter">${letters[i]}.</span>
        <span class="text">${opt}</span>
      `;
      option.addEventListener('click', () => {
        if(locked) return; // ignore further clicks if locked
        const input = option.querySelector('input');
        if(input) input.checked = true;
        onSelect(idx, i);
      });
      optionsEl.appendChild(option);
    });

    quizEl.appendChild(card);

    // Wire skip
    const skipBtn = $('#skipBtn', card);
    if(skipBtn){
      skipBtn.addEventListener('click', () => onSkip(idx));
    }

    // Apply feedback for this question only
    applyFeedback(state);
    updateProgress(state);
  }

  function applyFeedback(state){
    const i = state.index >= questions.length ? questions.length - 1 : state.index;
    const ans = state.answers[i];
    const fb = $('#fb-'+i);
    if(!fb) return;
    if(ans === null || ans === undefined){
      fb.textContent = '';
      fb.className = 'feedback';
      return;
    }
    if(ans === SKIPPED){
      fb.textContent = 'Skipped (unanswered)';
      fb.className = 'feedback skipped';
      return;
    }
    if(ans === questions[i].answer){
      fb.textContent = 'Correct answer';
      fb.className = 'feedback correct';
    } else {
      const correctLetter = letters[questions[i].answer];
      fb.textContent = `Wrong. Correct answer: ${correctLetter}`;
      fb.className = 'feedback wrong';
    }
  }

  function onSelect(qIndex, choiceIndex){
    const state = loadState();
    // Guard: if already answered or skipped, ignore further selections
    if(state.answers[qIndex] !== null && state.answers[qIndex] !== undefined){
      return;
    }
    state.answers[qIndex] = choiceIndex;
    saveState(state);

    // Update UI for this single question
    const card = quizEl.firstElementChild;
    if(card){
      $$('.option', card).forEach((optEl, i) => {
        const isSelected = i === choiceIndex;
        const isCorrect = i === questions[qIndex].answer && isSelected;
        const isWrong = isSelected && i !== questions[qIndex].answer;
        if(isCorrect) optEl.dataset.state = 'correct';
        else if(isWrong) optEl.dataset.state = 'wrong';
        else optEl.dataset.state = '';
        const input = $('input', optEl);
        if(input){ input.checked = isSelected; input.disabled = true; }
      });
      // disable further interaction
      const skipBtn = $('#skipBtn', card);
      if(skipBtn) skipBtn.disabled = true;
      card.classList.add('locked');
    }
    applyFeedback(state);
    updateProgress(state);

    // If wrong, also visibly mark the correct choice
    if(choiceIndex !== questions[qIndex].answer){
      const card = quizEl.firstElementChild;
      if(card){
        const correctIdx = questions[qIndex].answer;
        const optEls = $$('.option', card);
        if(optEls[correctIdx]){
          optEls[correctIdx].dataset.correct = 'true';
        }
      }
    }

    // Auto-advance to next question shortly (slower for visibility)
    clearTimeout(advanceTimer);
    advanceTimer = setTimeout(() => {
      const nextIndex = qIndex + 1;
      const newState = loadState();
      if(nextIndex < questions.length){
        newState.index = nextIndex;
        saveState(newState);
        render();
      } else {
        // At end: mark index past end so summary renders
        newState.index = questions.length;
        saveState(newState);
        renderSummary(newState);
        updateProgress(newState);
      }
    }, AUTO_ADVANCE_DELAY);
  }

  function onSkip(qIndex){
    const state = loadState();
    if(state.answers[qIndex] !== null && state.answers[qIndex] !== undefined){ return; }
    // mark as skipped (unanswered)
    state.answers[qIndex] = SKIPPED;
    const nextIndex = qIndex + 1;
    if(nextIndex < questions.length){
      state.index = nextIndex;
      saveState(state);
      // lock current card UI
      const card = quizEl.firstElementChild;
      if(card){
        $$('.option input', card).forEach(inp => inp.disabled = true);
        const skipBtn = $('#skipBtn', card); if(skipBtn) skipBtn.disabled = true;
        card.classList.add('locked');
      }
      render();
    } else {
      state.index = questions.length;
      saveState(state);
      renderSummary(state);
      updateProgress(state);
    }
  }

  function renderSummary(state){
    quizEl.innerHTML = '';
    const {c,w,u} = tally(state);
    const total = questions.length;
    const passed = c >= 6; // pass threshold
    const wrap = document.createElement('section');
    wrap.className = 'quiz';
    const header = document.createElement('article');
    header.className = 'question-card';
    const passIcon = `
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9.5 12.8l-2.3-2.3L5.8 12l3.7 3.7L18.2 7l-1.4-1.4-7.3 7.2z" fill="#16a34a"/>
      </svg>`;
    const failIcon = `
      <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="bhg" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stop-color="#ef4444"/>
            <stop offset="100%" stop-color="#991b1b"/>
          </linearGradient>
        </defs>
        <path fill="url(#bhg)" d="M45.5 8c-4.7 0-8.9 2.4-11.5 6.1C31.4 10.4 27.2 8 22.5 8 14.5 8 8 14.5 8 22.5c0 13.1 15.6 20.8 24.9 31.4.6.7 1.6.7 2.2 0C40.4 43.3 56 35.6 56 22.5 56 14.5 49.5 8 41.5 8h4z"/>
        <path d="M40 14c-.6 0-1 .4-1 1l-.3 6.5-4.7-3.1a1 1 0 0 0-1.4 1.4l4.6 4.6-5.1 2.5a1 1 0 1 0 .9 1.8l5.8-2.3-.3 6.6a1 1 0 1 0 2 0l.3-7 5.4 3.6a1 1 0 1 0 1.1-1.7l-5.8-3.2 4.8-2.3a1 1 0 0 0-.9-1.8l-5.3 2.1.2-5.9c0-.6-.4-1-1-1z" fill="#1f2937" fill-opacity="0.35"/>
      </svg>`;
    header.innerHTML = `
      <div class="summary-hero ${passed ? 'pass' : 'fail'}">
        ${passed ? passIcon : failIcon}
        <p class="msg">${passed ? 'Congratulations!' : 'Sorry, you can try again later'}</p>
      </div>
      ${passed ? '<div class="success-illustration"><img src="./assets/success-illustration.svg" alt="Success" loading="lazy"/></div>' : '<div class="fail-illustration"><img src="./assets/fail-illustration.svg" alt="Failure" loading="lazy"/></div>'}
      <h2 class="q-title" style="margin-top:6px;">Final Result</h2>
      <div class="progress-stats" style="margin-top:8px;">
        <div class="stat correct">Correct: ${c} / ${total}</div>
        <div class="stat wrong">Wrong: ${w}</div>
        <div class="stat neutral">Unanswered: ${u}</div>
      </div>
    `;
    wrap.appendChild(header);

    questions.forEach((q, i) => {
      const chosen = state.answers[i];
      const review = document.createElement('article');
      review.className = 'question-card';
      const status = (chosen == null || chosen === SKIPPED) ? 'Unanswered' : (chosen === q.answer ? 'Correct' : 'Wrong');
      review.innerHTML = `
        <div class="q-header">
          <div class="q-index">${i+1}</div>
          <h3 class="q-title">${q.q}</h3>
        </div>
        <div class="feedback ${chosen === q.answer ? 'correct' : ((chosen == null || chosen === SKIPPED) ? 'skipped' : 'wrong')}">Status: ${status}</div>
        <ul style="list-style:none; padding:0; margin:10px 0 0; display:grid; gap:8px;">
          ${q.options.map((opt, k) => {
            const isCorrect = k === q.answer;
            const isChosen = (chosen != null && chosen !== SKIPPED) && (k === chosen);
            let badge = isCorrect ? 'Correct' : (isChosen ? 'Your choice' : '');
            const color = isCorrect ? '#2dd36f' : (isChosen ? '#ff5d6c' : '#a5b6d6');
            return `<li style="padding:8px 10px; border-radius:10px; background: rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; gap:8px;">
                      <span class="letter" style="min-width:24px; color:#a8c3ff; font-weight:700;">${letters[k]}.</span>
                      <span class="text" style="flex:1;">${opt}</span>
                      ${badge ? `<span style="font-size:.85rem; color:${color};">${badge}</span>` : ''}
                    </li>`;
          }).join('')}
        </ul>
      `;
      wrap.appendChild(review);
    });

    quizEl.appendChild(wrap);

  // Play result sound (no visible replay button)
  playResultSound(passed);
  }

  // No custom dialog anymore; we'll use native confirm()

  // reset logic
  function doReset(){
  const state = { answers: Array(questions.length).fill(null), index: 0 };
    saveState(state);
    render();
  }

  // Wire events
  resetBtn.addEventListener('click', () => {
    const ok = window.confirm('Reset the quiz and clear your answers?');
    if (ok) doReset();
  });

  // Light theme only - no theme toggle needed

  // first render
  render();
})();
