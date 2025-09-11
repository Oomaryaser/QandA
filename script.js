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
  const AUTO_ADVANCE_DELAY = 1500; // ms (slightly slower so المستخدم يلحق يشوف الصحيحة)
  const SKIPPED = -1; // sentinel for skipped question
  let advanceTimer = null;

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
    const card = document.createElement('article');
    card.className = 'question-card';
    card.innerHTML = `
      <div class="q-header">
        <div class="q-index">${idx+1} / ${questions.length}</div>
        <h2 class="q-title">${q.q}</h2>
      </div>
      <div class="options" role="radiogroup" aria-label="خيارات السؤال ${idx+1}"></div>
      <div class="feedback" id="fb-${idx}" aria-live="polite"></div>
      <div class="actions">
        <button id="skipBtn" class="btn btn-secondary" type="button">تخطي</button>
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
        <input type="radio" name="q-${idx}" ${selected ? 'checked' : ''} aria-checked="${selected ? 'true':'false'}" aria-label="${letters[i]}" />
        <span class="letter">${letters[i]}.</span>
        <span class="text">${opt}</span>
      `;
      option.addEventListener('click', () => {
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
      fb.textContent = 'تم التخطي (غير مجاب)';
      fb.className = 'feedback skipped';
      return;
    }
    if(ans === questions[i].answer){
      fb.textContent = 'إجابة صحيحة';
      fb.className = 'feedback correct';
    } else {
      const correctLetter = letters[questions[i].answer];
      fb.textContent = `إجابة خاطئة. الإجابة الصحيحة: ${correctLetter}`;
      fb.className = 'feedback wrong';
    }
  }

  function onSelect(qIndex, choiceIndex){
    const state = loadState();
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
        if(input) input.checked = isSelected;
      });
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
    // mark as skipped (unanswered)
    state.answers[qIndex] = SKIPPED;
    const nextIndex = qIndex + 1;
    if(nextIndex < questions.length){
      state.index = nextIndex;
      saveState(state);
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
    const wrap = document.createElement('section');
    wrap.className = 'quiz';
    const header = document.createElement('article');
    header.className = 'question-card';
    header.innerHTML = `
      <h2 class="q-title">النتيجة النهائية</h2>
      <div class="progress-stats" style="margin-top:8px;">
        <div class="stat correct">صحيحة: ${c}</div>
        <div class="stat wrong">خاطئة: ${w}</div>
        <div class="stat neutral">غير مجابة: ${u}</div>
      </div>
    `;
    wrap.appendChild(header);

    questions.forEach((q, i) => {
      const chosen = state.answers[i];
      const review = document.createElement('article');
      review.className = 'question-card';
      const status = (chosen == null || chosen === SKIPPED) ? 'غير مجاب' : (chosen === q.answer ? 'صحيح' : 'خاطئ');
      review.innerHTML = `
        <div class="q-header">
          <div class="q-index">${i+1}</div>
          <h3 class="q-title">${q.q}</h3>
        </div>
        <div class="feedback ${chosen === q.answer ? 'correct' : ((chosen == null || chosen === SKIPPED) ? 'skipped' : 'wrong')}">الحالة: ${status}</div>
        <ul style="list-style:none; padding:0; margin:10px 0 0; display:grid; gap:8px;">
          ${q.options.map((opt, k) => {
            const isCorrect = k === q.answer;
            const isChosen = (chosen != null && chosen !== SKIPPED) && (k === chosen);
            let badge = isCorrect ? 'الصحيحة' : (isChosen ? 'اختيارك' : '');
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
    const ok = window.confirm('هل تريد بالتأكيد إعادة الاختبار من البداية؟ سيتم مسح اختياراتك الحالية.');
    if (ok) doReset();
  });

  // first render
  render();
})();
