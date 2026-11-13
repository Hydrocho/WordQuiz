(() => {
  'use strict';
  const { shuffle, makeBoard, pick, cleanRecords, dayKey, cleanTiming, beginTiming, finishTiming, elapsedTiming, formatDuration, completionGrade, gradeLimits, cleanItems, awardItem } = QuizCore;
  const $ = id => document.getElementById(id);
  let unit = window.UNITS[0];
  let questions = unit.questions;
  let ids = questions.map(q => q.id);

  let today = dayKey(), completed = [], memory = {}, queue = [], current, cards = [], selected = [], locked = false, timer, round = 0;
  let score = 0, combo = 0, highScore = 0;
  let previewTimers = [];
  let wrongTimers = [];
  let timing = cleanTiming(null, ids);
  const timingMemory = {};
  let attemptId = '';
  const unitSuffix = () => unit.id === '7' ? '' : `:unit-${unit.id}`;
  const attemptKey = () => `star-memory-attempt-v1:${today}${unitSuffix()}`;
  const historyKey = () => `star-memory-history-v1:${today}${unitSuffix()}`;
  const attemptSuffix = () => attemptId ? `:${attemptId}` : '';
  const memoryKey = () => today + unitSuffix() + attemptSuffix();
  const timingKey = () => `star-memory-timing-v1:${today}${unitSuffix()}${attemptSuffix()}`;

  const itemKey = () => `star-memory-items-v1:${today}${unitSuffix()}${attemptSuffix()}`;
  let itemState = cleanItems(null, ids), itemTimer = null;
  const itemMemory = {};
  const itemDefinitions = {
    reveal: { name: '전체 보기', description: '모든 카드를 2초간 공개합니다.', path: 'M2 10h2V8h3V6h10v2h3v2h2v4h-2v2h-3v2H7v-2H4v-2H2z M9 8h6v8H9z', detail: '<path d="M10 9h4v6h-4z" fill="#071020"/><rect x="10" y="9" width="2" height="2" fill="white"/>' },
    hint: { name: '한 글자', description: '다음 정답 카드 한 장을 2초간 공개합니다.', path: 'M8 2h8v2h3v9h-3v4H8v-4H5V4h3z M8 19h8v2H8z M10 22h4v1h-4z', detail: '<path d="M11 6h2v3h3v2h-3v3h-2v-3H8V9h3z" fill="#071020"/>' },
    erase: { name: '오답 지우기', description: '정답과 무관한 카드 최대 3장을 이번 문제에서 제외합니다.', path: 'M17 2h4v4h-2v2h-2v2h-2v2h-4v-2h2V8h2V6h2z M7 11h4v2h3v4h-2v2h-2v2H2v-4h2v-3h3z', detail: '<path d="M5 17h2v3H5z M9 15h2v3H9z" fill="#071020"/><path d="M17 17h3v3h-3z M21 13h2v2h-2z" fill="currentColor"/>' }
  };
  function readItems() {
    try { return cleanItems(JSON.parse(localStorage.getItem(itemKey()) || 'null'), ids); }
    catch { return cleanItems(itemMemory[memoryKey()], ids); }
  }
  function saveItems() {
    itemMemory[memoryKey()] = itemState;
    try { localStorage.setItem(itemKey(), JSON.stringify(itemState)); }
    catch { $('storageStatus').textContent = '아이템을 저장하지 못했어요 · 이번 화면에서만 유지됩니다.'; }
    renderItems();
  }
  function renderItems() {
    $('itemCount').textContent = `${itemState.inventory.length} / 3`;
    $('itemSlots').replaceChildren(...Array.from({ length: 3 }, (_, index) => {
      const type = itemState.inventory[index], definition = itemDefinitions[type];
      const button = document.createElement('button');
      button.className = `item-button ${type || 'empty'}`;
      button.disabled = !definition || locked || !current || selected.length === [...current.answer].length || completed.length === ids.length;
      if (definition) {
        button.title = definition.description;
        button.setAttribute('aria-label', `${definition.name}: ${definition.description}`);
        button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" shape-rendering="crispEdges"><path fill="currentColor" fill-rule="evenodd" d="${definition.path}"/>${definition.detail}</svg><span>${definition.name}</span>`;
        button.onclick = () => useItem(index);
      } else { button.innerHTML = '<span class="empty-plus" aria-hidden="true">+</span><span>빈 슬롯</span>'; button.setAttribute('aria-label', '빈 아이템 슬롯'); }
      return button;
    }));
  }
  function useItem(index) {
    syncDay();
    if (locked || !current || selected.length === [...current.answer].length || completed.length === ids.length) return;
    const type = itemState.inventory[index];
    if (!itemDefinitions[type]) return;
    const buttons = Array.from($('board').children);
    let targets = type === 'hint' ? buttons.filter((b, i) => !selected.includes(i) && cards[i] === [...current.answer][selected.length]).slice(0, 1) :
      type === 'erase' ? shuffle(buttons.filter((b, i) => !current.answer.includes(cards[i]) && !b.classList.contains('is-erased'))).slice(0, 3) :
        buttons.filter((b, i) => !selected.includes(i) && !b.classList.contains('is-erased'));
    if (!targets.length) { $('itemStatus').textContent = '지울 오답 카드가 더 없어요. 아이템은 보관됩니다.'; return; }
    clearWrongTimers();
    buttons.forEach((b, i) => { if (b.classList.contains('is-wrong')) { b.classList.remove('is-wrong', 'is-flipped'); b.setAttribute('aria-label', `${i + 1}번 숨겨진 카드`); } });
    itemState.inventory.splice(index, 1); itemState.used++;
    locked = true; saveItems(); SoundFX.play('btn');
    $('itemStatus').textContent = `${itemDefinitions[type].name} 사용! ${type === 'erase' ? targets.length + '장의 오답 카드 제외' : '2초 동안 위치를 기억하세요.'}`;
    if (type === 'erase') {
      targets.forEach(b => { b.classList.add('is-erased'); b.disabled = true; b.setAttribute('aria-label', '제외된 오답 카드'); });
      locked = false; renderItems(); return;
    }
    targets.forEach(b => { b.classList.add('is-flipped', 'item-revealed'); b.setAttribute('aria-label', `힌트 카드 ${cards[buttons.indexOf(b)]}`); });
    itemTimer = setTimeout(() => {
      targets.forEach(b => { b.classList.remove('is-flipped', 'item-revealed'); b.setAttribute('aria-label', `${buttons.indexOf(b) + 1}번 숨겨진 카드`); });
      itemTimer = setTimeout(() => { itemTimer = null; locked = false; renderItems(); $('itemStatus').textContent = '힌트 종료! 기억한 글자를 찾아보세요.'; }, 480);
    }, 2000);
  }
  function rewardItem() {
    const reward = awardItem(itemState, current.id, Math.random(), Math.random());
    itemState = reward.state; saveItems();
    $('itemStatus').textContent = reward.item ? `${itemDefinitions[reward.item].name} 획득! 다음 문제에서 사용하세요.` :
      itemState.inventory.length === 3 ? '보관함이 가득 찼어요! 최대 3개까지 보관합니다.' : '이번에는 아이템이 없어요. 다음 문제에 도전하세요!';
    if (reward.item) { $('itemSlots').classList.remove('item-awarded'); void $('itemSlots').offsetWidth; $('itemSlots').classList.add('item-awarded'); }
  }

  const key = () => `star-memory-v1:${today}${unitSuffix()}${attemptSuffix()}`;
  function readAttemptId() {
    try {
      const value = localStorage.getItem(attemptKey());
      return value && /^[a-zA-Z0-9-]+$/.test(value) ? value : '';
    } catch { return attemptId; }
  }

  function readHistory() {
    try {
      const value = JSON.parse(localStorage.getItem(historyKey()) || '[]');
      return Array.isArray(value) ? value.filter(item => item && typeof item === 'object').map(item => ({
        itemsUsed: Number.isSafeInteger(item.itemsUsed) && item.itemsUsed >= 0 ? item.itemsUsed : null,
        id: typeof item.id === 'string' ? item.id : '',
        completed: cleanRecords(item.completed, ids),
        timing: cleanTiming(item.timing, ids)
      })) : [];
    } catch { return []; }
  }

  function restartGame(confirmRestart = true) {
    if (confirmRestart !== false && !window.confirm('풀이 시간과 진행 상황을 초기화하고 첫 문제부터 다시 도전할까요?\n기존 기록은 오늘의 기록에 보관됩니다.')) return;
    syncDay();
    const previous = readHistory();
    const snapshot = {
      itemsUsed: itemState.used,
      id: attemptId,
      completed: cleanRecords([...read(), ...completed], ids),
      timing: cleanTiming({ ...timing, finishedAt: timing.startedAt === null ? null : timing.finishedAt ?? Date.now() }, ids)
    };
    const history = timing.startedAt !== null || snapshot.completed.length ? [...previous.filter(entry => entry.id !== attemptId), snapshot] : previous;
    const newId = window.crypto.randomUUID();
    try {
      // Switch to new storage keys only after the old result is safely archived.
      localStorage.setItem(historyKey(), JSON.stringify(history));
      localStorage.setItem(attemptKey(), newId);
    } catch {
      $('storageStatus').textContent = '기록을 보관하지 못해 다시 도전을 시작하지 않았어요. 저장 공간을 확인해 주세요.';
      return;
    }
    attemptId = newId;
    itemState = cleanItems(null, ids);
    completed = [];
    timing = cleanTiming(null, ids);
    queue = [];
    score = 0;
    combo = 0;
    $('board').classList.remove('is-previewing');
    document.querySelector('.feedback-screen')?.classList.remove('is-memorize');
    updateCount();
    updateHUD();
    next();
    $('question').focus();
    return true;
  }
  const highScoreKey = () => `star-memory-highscore${unitSuffix()}`;
  const soundKey = () => `star-memory-sound`;

  // ==========================================================================
  // RETRO 8-BIT WEB AUDIO SYNTHESIZER
  // ==========================================================================
  const SoundFX = {
    ctx: null,
    muted: false,
    init() {
      if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();
      }
    },
    resume() {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    },
    play(type) {
      if (this.muted) return;
      try {
        this.init();
        this.resume();
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        if (type === 'flip') {
          // 3D card flip whoosh/blip
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(260, t);
          osc.frequency.exponentialRampToValueAtTime(750, t + 0.08);
          gain.gain.setValueAtTime(0.12, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
          osc.start(t);
          osc.stop(t + 0.1);
        } else if (type === 'correct') {
          // Retro arcade coin chime (D5 -> A5)
          osc.type = 'sine';
          osc.frequency.setValueAtTime(587.33, t);
          osc.frequency.setValueAtTime(880.00, t + 0.07);
          gain.gain.setValueAtTime(0.18, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
          osc.start(t);
          osc.stop(t + 0.28);
        } else if (type === 'wrong') {
          // Retro error buzzer
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(170, t);
          osc.frequency.exponentialRampToValueAtTime(90, t + 0.25);
          gain.gain.setValueAtTime(0.2, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
          osc.start(t);
          osc.stop(t + 0.35);
        } else if (type === 'flipback') {
          // Smooth card reset sweep
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440, t);
          osc.frequency.exponentialRampToValueAtTime(200, t + 0.09);
          gain.gain.setValueAtTime(0.08, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
          osc.start(t);
          osc.stop(t + 0.1);
        } else if (type === 'win') {
          // 8-bit Victory Fanfare Arpeggio
          const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
          notes.forEach((freq, idx) => {
            const o = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            o.type = 'square';
            o.frequency.setValueAtTime(freq, t + idx * 0.08);
            g.gain.setValueAtTime(0.1, t + idx * 0.08);
            g.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.08 + 0.22);
            o.connect(g);
            g.connect(this.ctx.destination);
            o.start(t + idx * 0.08);
            o.stop(t + idx * 0.08 + 0.24);
          });
        } else if (type === 'btn') {
          // Arcade microswitch click
          osc.type = 'sine';
          osc.frequency.setValueAtTime(600, t);
          osc.frequency.exponentialRampToValueAtTime(320, t + 0.04);
          gain.gain.setValueAtTime(0.09, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
          osc.start(t);
          osc.stop(t + 0.05);
        }
      } catch (e) { }
    },
    playCascade(index, total) {
      if (this.muted) return;
      try {
        this.init();
        this.resume();
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        // Rising cascade frequency: 320Hz to 760Hz
        const freq = 320 + (index / Math.max(1, total - 1)) * 440;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
        osc.start(t);
        osc.stop(t + 0.09);
      } catch (e) { }
    },
    playReadyGo() {
      if (this.muted) return;
      try {
        this.init();
        this.resume();
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, t); // D5
        osc.frequency.setValueAtTime(880.00, t + 0.08); // A5
        gain.gain.setValueAtTime(0.14, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.start(t);
        osc.stop(t + 0.22);
      } catch (e) { }
    },
    playMission() {
      if (this.muted) return;
      try {
        this.init();
        this.resume();
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        // Sci-fi mission cue: C5 (523Hz) -> E5 (659Hz) -> G5 (784Hz)
        [523.25, 659.25, 783.99].forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, t + idx * 0.07);
          gain.gain.setValueAtTime(0.12, t + idx * 0.07);
          gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.07 + 0.16);
          osc.start(t + idx * 0.07);
          osc.stop(t + idx * 0.07 + 0.18);
        });
      } catch (e) { }
    }
  };

  // ==========================================================================
  // CONFETTI & STARBURST PARTICLE FX
  // ==========================================================================
  const FX = {
    canvas: null,
    ctx: null,
    particles: [],
    animId: null,
    init() {
      this.canvas = $('fxCanvas');
      if (this.canvas) {
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
      }
    },
    resize() {
      if (this.canvas) {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
      }
    },
    burst() {
      if (!this.canvas || !this.ctx) return;
      this.resize();
      const colors = ['#00f0ff', '#ff2a85', '#ffd000', '#00ff88', '#ffffff', '#ff9900'];
      const cx = this.canvas.width / 2;
      const cy = this.canvas.height * 0.42;
      for (let i = 0; i < 75; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 11 + 4;
        this.particles.push({
          x: cx + (Math.random() - 0.5) * 120,
          y: cy + (Math.random() - 0.5) * 60,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 3.5,
          size: Math.random() * 7 + 4,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * 360,
          vRot: (Math.random() - 0.5) * 14,
          alpha: 1,
          shape: Math.random() > 0.4 ? 'square' : 'star'
        });
      }
      if (!this.animId) this.loop();
    },
    loop() {
      if (!this.ctx) return;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.32; // gravity
        p.rotation += p.vRot;
        p.alpha -= 0.016;

        if (p.alpha <= 0 || p.y > this.canvas.height + 20) {
          this.particles.splice(i, 1);
          continue;
        }

        this.ctx.save();
        this.ctx.globalAlpha = Math.max(0, p.alpha);
        this.ctx.translate(p.x, p.y);
        this.ctx.rotate((p.rotation * Math.PI) / 180);
        this.ctx.fillStyle = p.color;
        this.ctx.shadowColor = p.color;
        this.ctx.shadowBlur = 8;
        if (p.shape === 'square') {
          this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        } else {
          this.ctx.beginPath();
          this.ctx.moveTo(0, -p.size);
          this.ctx.lineTo(p.size * 0.7, 0);
          this.ctx.lineTo(0, p.size);
          this.ctx.lineTo(-p.size * 0.7, 0);
          this.ctx.closePath();
          this.ctx.fill();
        }
        this.ctx.restore();
      }

      if (this.particles.length > 0) {
        this.animId = requestAnimationFrame(() => this.loop());
      } else {
        this.animId = null;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }
  };

  function showFloatingScore(targetEl, text) {
    if (!targetEl) return;
    const rect = targetEl.getBoundingClientRect();
    const floatEl = document.createElement('div');
    floatEl.className = 'arcade-float-score';
    floatEl.textContent = text;
    floatEl.style.left = `${rect.left + rect.width / 2}px`;
    floatEl.style.top = `${rect.top}px`;
    document.body.appendChild(floatEl);
    setTimeout(() => floatEl.remove(), 850);
  }

  // ==========================================================================
  // STORAGE & STATS
  // ==========================================================================
  function read() {
    try {
      return cleanRecords(JSON.parse(localStorage.getItem(key()) || '[]'), ids);
    } catch {
      $('storageStatus').textContent = '저장소를 사용할 수 없어요 · 이번 화면에서만 기록돼요';
      return memory[memoryKey()] || [];
    }
  }

  function readHighScore() {
    try {
      return parseInt(localStorage.getItem(highScoreKey()) || '0', 10) || 0;
    } catch {
      return 0;
    }
  }

  function saveHighScore() {
    if (score > highScore) {
      highScore = score;
      try {
        localStorage.setItem(highScoreKey(), String(highScore));
      } catch { }
    }
    updateHUD();
  }

  function addScore(pts) {
    score += pts;
    if (score > highScore) {
      highScore = score;
      saveHighScore();
    }
    updateHUD();
  }

  function updateHUD() {
    const targetMinutes = gradeLimits(ids.length)[0][1];
    $('sRankTarget').textContent = `${String(targetMinutes).padStart(2, '0')}:00`;
    $('sRankTarget').setAttribute('aria-label', `S등급 목표 시간 ${targetMinutes}분 이내`);
    updateTimer();
  }

  function readTiming() {
    try {
      return cleanTiming(JSON.parse(localStorage.getItem(timingKey()) || 'null'), ids);
    } catch {
      return cleanTiming(timingMemory[memoryKey()], ids);
    }
  }

  function saveTiming() {
    const stored = readTiming();
    // Keep the first completion from another open tab, too.
    timing.durations = { ...timing.durations, ...stored.durations };
    if (stored.startedAt !== null) timing.startedAt = Math.min(timing.startedAt ?? stored.startedAt, stored.startedAt);
    if (stored.finishedAt !== null) {
      timing.finishedAt = stored.finishedAt;
      timing.active = null;
    }
    timingMemory[memoryKey()] = timing;
    try {
      localStorage.setItem(timingKey(), JSON.stringify(timing));
    } catch {
      $('storageStatus').textContent = '시간을 저장하지 못했어요 · 페이지를 닫으면 시간 기록이 사라질 수 있어요';
    }
    updateTimer();
  }

  function updateTimer() {
    const elapsed = formatDuration(elapsedTiming(timing, Date.now()));
    $('elapsedDisplay').textContent = elapsed;
    $('recordElapsed').textContent = elapsed;
    const allDone = completed.length === ids.length;
    const allTimed = ids.every(id => timing.durations[id] !== undefined);
    $('recordGrade').textContent = completionGrade(completed, timing, ids) ?? (allDone ? '시간 기록 없음' : '도전 중');
    $('recordTotal').textContent = !allDone ? '진행 중' :
      timing.finishedAt !== null && allTimed ? elapsed : '시간 기록 없음';
  }

  function syncDay() {
    const date = dayKey();
    if (date !== today) {
      today = date;
      attemptId = readAttemptId();
      itemState = readItems();
      completed = read();
      timing = readTiming();
      queue = [];
      if (current && selected.length < [...current.answer].length && completed.length < ids.length) {
        timing = beginTiming(timing, current.id, Date.now());
        saveTiming();
      }
      updateCount();
    }
    return today;
  }

  function updateCount() {
    $('count').textContent = `${completed.length} / ${ids.length}`;
  }

  function save() {
    syncDay();
    completed = cleanRecords([...read(), ...completed, current.id], ids);
    memory[memoryKey()] = completed;
    timing = finishTiming(timing, current.id, Date.now(), completed.length === ids.length);
    saveTiming();
    try {
      localStorage.setItem(key(), JSON.stringify(completed));
    } catch {
      $('storageStatus').textContent = '저장하지 못했어요 · 페이지를 닫으면 새 기록이 사라질 수 있어요';
    }
    updateCount();
  }

  // ==========================================================================
  // 3D CARD RENDERING & BOARD LOGIC
  // ==========================================================================
  function renderBoard() {
    const board = $('board');
    board.replaceChildren(...cards.map((letter, i) => {
      const button = document.createElement('button');
      button.className = 'card';
      button.dataset.index = i;
      button.dataset.number = String(i + 1).padStart(2, '0');
      button.setAttribute('aria-label', `${i + 1}번 숨겨진 카드`);
      button.style.animationDelay = `${i * 20}ms`;

      const inner = document.createElement('div');
      inner.className = 'card-inner';

      // Card Back Face
      const back = document.createElement('div');
      back.className = 'card-face card-back';
      back.innerHTML = `
        <div class="card-head">
          <span class="card-number">${String(i + 1).padStart(2, '0')}</span>
          <span class="card-corner-star">✦</span>
        </div>
        <div class="card-center">
          <div class="card-radar"></div>
          <span class="card-symbol">★</span>
        </div>
        <div class="card-foot">
          <span class="card-cyber-label">ARCADE</span>
        </div>
      `;

      // Card Front Face
      const front = document.createElement('div');
      front.className = 'card-face card-front';
      front.innerHTML = `
        <div class="card-head">
          <span class="card-number">${String(i + 1).padStart(2, '0')}</span>
        </div>
        <div class="card-center">
          <span class="card-letter">${letter}</span>
        </div>
        <div class="card-shimmer"></div>
      `;

      inner.appendChild(back);
      inner.appendChild(front);
      button.appendChild(inner);

      button.onclick = () => choose(i);
      return button;
    }));
  }

  function renderSlots() {
    const slotsContainer = $('slots');
    const answerChars = [...current.answer];
    slotsContainer.replaceChildren(...answerChars.map((char, i) => {
      const slot = document.createElement('div');
      const isFilled = i < selected.length;
      const isCurrent = i === selected.length;

      slot.className = `slot ${isFilled ? 'filled' : 'empty'} ${isCurrent ? 'current' : ''}`;

      if (isFilled) {
        slot.textContent = cards[selected[i]];
      } else if (isCurrent) {
        slot.innerHTML = '<span class="slot-cursor">_</span>';
      } else {
        slot.textContent = '·';
      }
      return slot;
    }));
  }

  // ==========================================================================
  // CARD PREVIEW CASCADE & FLIP-BACK ANIMATION
  // ==========================================================================
  function clearPreviewTimers() {
    previewTimers.forEach(t => clearTimeout(t));
    previewTimers = [];
  }

  function startCardPreview() {
    clearPreviewTimers();
    locked = true;

    const board = $('board');
    const cardButtons = Array.from(board.children);
    const total = cardButtons.length;
    if (!total) return;

    board.classList.add('is-previewing');
    const feedbackScreen = document.querySelector('.feedback-screen');
    if (feedbackScreen) feedbackScreen.classList.add('is-memorize');

    $('feedback').textContent = '👀 [ MEMORIZE! ] 20개 카드의 위치를 잘 기억하세요!';

    const staggerMs = 110; // 도미노 간격 110ms
    const memorizeDuration = 2200; // 암기 대기 시간: 기존 1100ms의 2배

    // 1. Sequentially flip open each card with a rolling cascade sound
    cardButtons.forEach((btn, i) => {
      const t = setTimeout(() => {
        btn.classList.add('is-flipped');
        SoundFX.playCascade(i, total);
      }, i * staggerMs);
      previewTimers.push(t);
    });

    // 2. Simultaneously flip ALL cards back to closed
    const totalOpenTime = total * staggerMs + memorizeDuration;
    const tFlipBack = setTimeout(() => {
      SoundFX.play('flipback');
      cardButtons.forEach(btn => {
        btn.classList.remove('is-flipped');
      });

      if (feedbackScreen) feedbackScreen.classList.remove('is-memorize');
      $('feedback').textContent = '⚡ READY... GO! 첫 번째 글자를 찾아보세요!';

      // 3. Unlock after flip transition finishes
      const tUnlock = setTimeout(() => {
        board.classList.remove('is-previewing');
        locked = false;
        renderItems();
        $('itemStatus').textContent = itemState.inventory.length ? '아이템 버튼을 눌러 사용할 수 있어요. 시간은 계속 흐릅니다.' : '정답을 맞히면 50% 확률로 아이템 획득!';
        SoundFX.playReadyGo();
        $('feedback').textContent = `★ START! [ ${current.answer.length}글자 ] 정답의 첫 글자를 터치하세요.`;
      }, 480);
      previewTimers.push(tUnlock);
    }, totalOpenTime);

    previewTimers.push(tFlipBack);
  }

  function clearWrongTimers() {
    wrongTimers.forEach(t => clearTimeout(t));
    wrongTimers = [];
  }

  function choose(i) {
    const cardButtons = $('board').children;
    const currentCard = cardButtons[i];

    if (locked || selected.includes(i) || currentCard?.classList.contains('is-erased') || (currentCard && currentCard.classList.contains('is-wrong'))) return;
    syncDay();

    const result = pick(current.answer, cards, selected, i);
    if (result.status === 'ignored') return;

    if (result.status === 'wrong') {
      combo = 0;
      updateHUD();

      // Unfix/unlock any previously matched cards (처음부터 다시 풀기)
      const prevSelected = [...selected];
      selected = [];
      renderSlots();

      if (prevSelected.length > 0) {
        prevSelected.forEach(idx => {
          const btn = cardButtons[idx];
          if (btn) {
            btn.classList.remove('is-flipped', 'is-matched', 'is-wrong');
            btn.disabled = false;
            btn.setAttribute('aria-label', `${idx + 1}번 숨겨진 카드`);
          }
        });
        SoundFX.play('flipback');
      }

      // 3D Flip wrong card open with error alert (without locking the board!)
      SoundFX.play('flip');
      if (currentCard) {
        currentCard.classList.add('is-flipped', 'is-wrong');
        currentCard.setAttribute('aria-label', `${i + 1}번 카드 ${cards[i]} (틀림)`);
      }

      setTimeout(() => SoundFX.play('wrong'), 70);

      const firstChar = current.answer[0];
      $('feedback').textContent = `✖ [ ${cards[i]} ] 틀림! 첫 글자 '${firstChar}'부터 다시 도전하세요!`;

      // The wrong card flips back automatically after 600ms without blocking continuous clicks
      const t = setTimeout(() => {
        if (currentCard && !selected.includes(i)) {
          currentCard.classList.remove('is-flipped', 'is-wrong');
          currentCard.disabled = false;
          currentCard.setAttribute('aria-label', `${i + 1}번 숨겨진 카드`);
          SoundFX.play('flipback');
        }
      }, 600);
      wrongTimers.push(t);
      return;
    }

    // Correct Pick!
    selected = result.selected;
    SoundFX.play('flip');
    setTimeout(() => SoundFX.play('correct'), 80);

    if (currentCard) {
      currentCard.classList.add('is-flipped', 'is-matched');
      currentCard.classList.remove('is-wrong');
      currentCard.disabled = true;
      currentCard.setAttribute('aria-label', `${i + 1}번 카드 ${cards[i]}`);
    }

    combo++;
    const earned = 100 * combo;
    addScore(earned);
    showFloatingScore(currentCard, `+${earned} PTS!`);

    renderSlots();

    if (result.status === 'complete') {
      locked = true;
      const bonus = 500 * Math.max(1, combo);
      addScore(bonus);
      showFloatingScore($('slots'), `STAGE CLEAR! +${bonus} PTS!`);

      const firstAllClear = completed.length < ids.length;
      if (firstAllClear && completed.length < ids.length - 1) rewardItem();
      renderItems();
      save();
      saveHighScore();

      SoundFX.play('win');
      FX.burst();

      $('feedback').textContent = `★ STAGE CLEAR! 정답: [ ${current.answer} ] ★`;
      $('next').disabled = false;
      $('rule').hidden = true;
      if (firstAllClear && completed.length === ids.length) showCompletion();
    } else {
      const nextChar = current.answer[selected.length];
      $('feedback').textContent = `★ HIT! 다음 글자 '${nextChar}'를 찾아보세요.`;
    }
  }

  // ==========================================================================
  // QUESTION APPEARANCE EFFECT (MISSION REVEAL)
  // ==========================================================================
  let typeTimer = null;

  function animateQuestion(text, onComplete) {
    if (typeTimer) {
      clearInterval(typeTimer);
      typeTimer = null;
    }

    const qEl = $('question');
    const directiveBar = document.querySelector('.directive-bar');
    if (directiveBar) directiveBar.classList.add('is-incoming');

    SoundFX.playMission();

    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      qEl.textContent = text;
      if (directiveBar) directiveBar.classList.remove('is-incoming');
      if (onComplete) onComplete();
      return;
    }

    qEl.textContent = '';
    qEl.classList.remove('question-entrance');
    void qEl.offsetWidth; // trigger reflow
    qEl.classList.add('question-entrance');

    const chars = [...text];
    let index = 0;
    const speedMs = 16;

    typeTimer = setInterval(() => {
      index++;
      const currentText = chars.slice(0, index).join('');
      qEl.textContent = currentText;

      const cursor = document.createElement('span');
      cursor.className = 'typing-cursor';
      cursor.textContent = '█';
      qEl.appendChild(cursor);

      if (index >= chars.length) {
        clearInterval(typeTimer);
        typeTimer = null;
        if (directiveBar) directiveBar.classList.remove('is-incoming');

        if (cursor.parentNode) cursor.remove();
        if (onComplete) onComplete();
      }
    }, speedMs);
  }

  function next() {
    clearTimeout(itemTimer);
    itemTimer = null;
    if (typeTimer) {
      clearInterval(typeTimer);
      typeTimer = null;
    }
    clearTimeout(timer);
    clearPreviewTimers();
    clearWrongTimers();
    syncDay();

    if (!queue.length) {
      const remaining = questions.filter(q => !completed.includes(q.id));
      const pool = remaining.length ? remaining : questions;
      // pop() consumes the end: reverse numeric order gives unit 8 & 9 ascending IDs.
      queue = (unit.id === '8' || unit.id === '9') ? [...pool].sort((a, b) => b.id - a.id) : shuffle(pool);
      round = 0;
    }

    // Resume an unfinished question after reload without resetting its clock.
    const resumeIndex = queue.findIndex(q => q.id === timing.active?.id && !completed.includes(q.id));
    current = resumeIndex >= 0 ? queue.splice(resumeIndex, 1)[0] : queue.pop();
    if (completed.length < ids.length) {
      timing = beginTiming(timing, current.id, Date.now());
      saveTiming();
    }
    round++;
    cards = makeBoard(current.answer);
    selected = [];
    locked = true;

    $('category').textContent = current.category;
    $('progress').textContent = `${completed.length === ids.length ? 'ALL CLEAR 복습' : 'STAGE'} · ${round} / ${ids.length}`;
    if ($('stageTag')) $('stageTag').textContent = `STAGE ${String(round).padStart(2, '0')}`;

    $('next').disabled = true;
    $('next').hidden = true;
    $('ready').hidden = false;
    $('ready').disabled = true;
    $('rule').hidden = false;

    // 1. First render cards (face-down) & target slots
    renderBoard();
    renderSlots();
    renderItems();
    $('itemStatus').textContent = 'Ready! 힌트가 끝나면 아이템을 사용할 수 있어요.';

    // 2. Question appears first with cyber typewriter & mission chime!
    $('feedback').textContent = `📡 [ NEW MISSION ] 문제를 확인하세요! (${current.answer.length}글자)`;

    animateQuestion(current.question, () => {
      $('ready').disabled = false;
      $('feedback').textContent = '문제를 다 읽었다면 Ready! 버튼을 눌러 카드 위치를 확인하세요.';
    });
  }

  // ==========================================================================
  // HALL OF FAME / RECORDS DIALOG
  // ==========================================================================
  function showCompletion() {
    const grade = completionGrade(completed, timing, ids);
    const messages = {
      S: ['우주의 마스터', '눈부신 기억력! 선택한 단원의 미션을 빠르게 정복했어요.'],
      A: ['은하 탐험의 에이스', '정확한 기억과 꾸준한 집중으로 멋지게 완주했어요.'],
      B: ['별빛 탐험가', `${ids.length}개의 미션 성공! 다음 도전에서 기록을 줄여 보세요.`],
      C: ['우주 개척자', '끝까지 도전해 모든 문제를 해결했어요. 멋진 완주예요!'],
      D: ['불굴의 탐험가', `포기하지 않고 ${ids.length}문제를 완주했어요. 이제 한 번 더 도전해 볼까요?`]
    };
    $('completionKicker').textContent = unit.title;
    $('completionGrade').textContent = grade ?? '★';
    $('completion').dataset.grade = grade ?? 'unknown';
    $('completionRank').textContent = grade ? messages[grade][0] : `${ids.length}개 미션 완주`;
    $('completionMessage').textContent = grade ? messages[grade][1] : '모든 문제를 해결했어요! 이전 문제의 시간 정보가 없어 등급은 계산하지 않았어요.';
    $('completionTime').textContent = grade ? formatDuration(elapsedTiming(timing, timing.finishedAt)) : '시간 기록 없음';
    $('completionItems').textContent = `아이템 사용 ${itemState.used}회`;
    $('completionScore').textContent = `${score.toLocaleString()} PTS`;
    const limits = gradeLimits(ids.length);
    $('gradeCriteria').textContent = limits.map(([label, minutes], i) => `${label} ${i ? limits[i - 1][1] + '분 초과 ~ ' : ''}${minutes}분 이내`).join(' · ') + ` · D ${limits[limits.length - 1][1]}분 초과`;
    if (!$('completion').open) $('completion').showModal();
  }

  function showRecords() {
    syncDay();
    $('recordItems').textContent = `이번 도전 아이템 사용 ${itemState.used}회`;
    completed = cleanRecords([...read(), ...completed], ids);
    updateCount();
    $('recordDate').textContent = today.replaceAll('-', ' . ') + ' · ' + unit.title;
    $('recordCount').textContent = `${completed.length} / ${ids.length}`;
    updateTimer();
    if ($('dialogHighScore')) $('dialogHighScore').textContent = `${highScore.toLocaleString()} PTS`;

    $('recordList').replaceChildren(...completed.map(id => {
      const q = questions.find(q => q.id === id);
      const li = document.createElement('li');
      li.className = 'record-item';

      const numSpan = document.createElement('span');
      numSpan.className = 'rec-num';
      numSpan.textContent = `#${String(q.id).padStart(2, '0')}`;

      const infoDiv = document.createElement('div');
      infoDiv.className = 'rec-info';

      const qText = document.createElement('p');
      qText.className = 'rec-q';
      qText.textContent = q.question;

      const ansTag = document.createElement('strong');
      ansTag.className = 'rec-ans';
      ansTag.textContent = `정답: ${q.answer}`;

      const duration = document.createElement('p');
      duration.className = 'rec-time';
      duration.textContent = timing.durations[id] === undefined ? '풀이 시간: 시간 기록 없음' :
        `풀이 시간: ${formatDuration(timing.durations[id])}`;
      infoDiv.append(qText, ansTag, duration);
      li.append(numSpan, infoDiv);
      return li;
    }));

    $('attemptHistory').replaceChildren(...readHistory().map((entry, index) => {
      const detail = document.createElement('details');
      detail.className = 'past-attempt';
      const summary = document.createElement('summary');
      const complete = entry.completed.length === ids.length;
      const grade = completionGrade(entry.completed, entry.timing, ids);
      const known = entry.timing.startedAt !== null && entry.timing.finishedAt !== null;
      const duration = known ? formatDuration(elapsedTiming(entry.timing, entry.timing.finishedAt)) : '시간 기록 없음';
      summary.textContent = `${index + 1}번째 도전 · ${entry.completed.length} / ${ids.length} · ${complete ? '전체 완료' : '중단'} · ${duration}${grade ? ` · ${grade} 등급` : ''}${entry.itemsUsed === null ? '' : ` · 아이템 ${entry.itemsUsed}회`}`;
      const list = document.createElement('ol');
      entry.completed.forEach(id => {
        const item = document.createElement('li');
        const question = questions.find(q => q.id === id);
        item.textContent = `${question.question} — 정답: ${question.answer} · ${entry.timing.durations[id] === undefined ? '시간 기록 없음' : formatDuration(entry.timing.durations[id])}`;
        list.append(item);
      });
      detail.append(summary, list);
      return detail;
    }));
    $('attemptHistorySection').hidden = !$('attemptHistory').children.length;
    $('emptyRecords').hidden = completed.length > 0;
    if (!$('records').open) $('records').showModal();
  }

  // ==========================================================================
  // SOUND TOGGLE & CONTROLS
  // ==========================================================================
  function setupSound() {
    try {
      const saved = localStorage.getItem(soundKey());
      if (saved === 'muted') {
        SoundFX.muted = true;
      }
    } catch { }
    updateSoundUI();

    $('soundToggle').onclick = () => {
      SoundFX.muted = !SoundFX.muted;
      try {
        localStorage.setItem(soundKey(), SoundFX.muted ? 'muted' : 'enabled');
      } catch { }
      if (!SoundFX.muted) {
        SoundFX.play('btn');
      }
      updateSoundUI();
    };
  }

  function updateSoundUI() {
    const btn = $('soundToggle');
    if (!btn) return;
    if (SoundFX.muted) {
      btn.classList.add('muted');
      btn.querySelector('.sound-icon').textContent = '🔇';
      btn.querySelector('.sound-text').textContent = 'SFX OFF';
    } else {
      btn.classList.remove('muted');
      btn.querySelector('.sound-icon').textContent = '🔊';
      btn.querySelector('.sound-text').textContent = 'SFX ON';
    }
  }

  // Event Listeners
  $('completionReview').onclick = () => $('completion').close();
  $('completionRecords').onclick = () => {
    $('completion').close();
    showRecords();
  };
  $('completionRestart').onclick = () => {
    if (restartGame()) $('completion').close();
  };
  let gameStarted = false;
  $('restartButton').onclick = restartGame;
  function startFromIntro() {
    if (gameStarted) return;
    unit = window.UNITS.find(entry => entry.id === $('unitSelect').value) || window.UNITS[0];
    questions = unit.questions;
    ids = questions.map(q => q.id);
    today = dayKey();
    attemptId = '';
    attemptId = readAttemptId();
    completed = read();
    timing = readTiming();
    itemState = readItems();
    highScore = readHighScore();
    updateCount();
    updateHUD();
    $('gameTitle').textContent = unit.title;
    // Every Game Start begins a fresh attempt.
    const hasPrevious = timing.startedAt !== null || completed.length > 0;
    if (hasPrevious) {
      if (!restartGame(false)) {
        $('introStatus').textContent = '이전 기록을 저장하지 못해 시작하지 않았어요. 저장 공간을 확인한 뒤 다시 시작해 주세요.';
        return;
      }
    } else {
      next();
    }
    gameStarted = true;
    $('gameStart').disabled = true;
    $('intro').hidden = true;
    $('gameScreen').hidden = false;
    SoundFX.play('btn');
    $('question').setAttribute('tabindex', '-1');
    $('question').focus();
  }
  $('unitSelect').replaceChildren(...window.UNITS.map(entry => {
    const option = document.createElement('option');
    option.value = entry.id;
    option.textContent = `${entry.title} · ${entry.questions.length}문제`;
    return option;
  }));
  $('unitSelect').onchange = () => {
    const entry = window.UNITS.find(entry => entry.id === $('unitSelect').value);
    $('introDescription').textContent = `${entry.title} · ${entry.questions.length}개의 미션에 도전하세요!`;
  };
  $('unitSelect').onchange();
  $('changeUnit').onclick = () => {
    if (window.confirm('단원 선택 화면으로 돌아갈까요? 현재 기록은 저장되며, 다음 시작은 새로운 도전으로 진행됩니다.')) window.location.reload();
  };
  $('gameStart').onclick = () => startFromIntro();
  $('ready').onclick = () => {
    if ($('ready').disabled) return;
    $('ready').disabled = true;
    $('ready').hidden = true;
    $('next').hidden = false;
    SoundFX.play('btn');
    startCardPreview();
  };
  $('next').onclick = () => {
    if ($('next').disabled || selected.length !== [...current.answer].length) return;
    SoundFX.play('btn');
    next();
  };
  $('recordsButton').onclick = () => {
    SoundFX.play('btn');
    showRecords();
  };
  $('closeRecords').onclick = () => {
    SoundFX.play('btn');
    $('records').close();
  };

  $('records').addEventListener('click', e => {
    if (e.target === $('records')) $('records').close();
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      syncDay();
      completed = cleanRecords([...read(), ...completed], ids);
      updateCount();
    }
  });

  window.addEventListener('storage', event => {
    if (event.key === attemptKey() && readAttemptId() !== attemptId) {
      attemptId = readAttemptId();
      itemState = readItems();
      completed = read();
      timing = readTiming();
      queue = [];
      score = 0;
      combo = 0;
      updateCount();
      updateHUD();
      if (gameStarted) {
        $('board').classList.remove('is-previewing');
        document.querySelector('.feedback-screen')?.classList.remove('is-memorize');
        next();
      }
      if ($('records').open) showRecords();
      return;
    }
    if (event.key === key() || event.key === timingKey()) {
      const localActive = timing.active;
      timing = readTiming();
      if (timing.finishedAt === null && localActive?.id === current?.id) {
        timing.active = localActive;
      }
      completed = cleanRecords([...read(), ...completed], ids);
      updateTimer();
      updateCount();
      if ($('records').open) showRecords();
    }
  });

  // Init
  FX.init();
  setupSound();
  highScore = readHighScore();
  attemptId = readAttemptId();
  itemState = readItems();
  completed = read();
  timing = readTiming();
  updateCount();
  updateHUD();
  renderItems();
  setInterval(() => {
    syncDay();
    updateTimer();
  }, 250);
})();
