/* Classic Slots - 5x3 with 10 paylines */
(() => {
  const SYMBOLS = [
    { char: "🍒", weight: 5,  pays: [0, 0, 10, 30, 80] },
    { char: "🍋", weight: 5,  pays: [0, 0, 10, 30, 80] },
    { char: "🔔", weight: 4,  pays: [0, 0, 20, 60, 150] },
    { char: "⭐", weight: 3,  pays: [0, 0, 30, 90, 250] },
    { char: "7️⃣", weight: 2,  pays: [0, 0, 40, 120, 400] },
    { char: "💎", weight: 2,  pays: [0, 0, 50, 150, 500] },
    { char: "🍀", weight: 3,  pays: [0, 0, 25, 75, 200] },
    { char: "BAR", weight: 2, pays: [0, 0, 60, 200, 800] },
  ];

  const PAYLINES = [
    [1,1,1,1,1], // middle
    [0,0,0,0,0], // top
    [2,2,2,2,2], // bottom
    [0,1,2,1,0],
    [2,1,0,1,2],
    [0,0,1,2,2],
    [2,2,1,0,0],
    [1,0,1,2,1],
    [1,2,1,0,1],
    [0,1,1,1,2],
  ];

  const reelsEl = document.getElementById('reels');
  const msgEl = document.getElementById('message');
  const balanceEl = document.getElementById('balance');
  const totalBetEl = document.getElementById('totalBet');
  const linesValEl = document.getElementById('linesVal');
  const betValEl = document.getElementById('betVal');
  const soundBtn = document.getElementById('sound');
  const spinBtn = document.getElementById('spin');
  const autoBtn = document.getElementById('auto');
  const addBtn = document.getElementById('addCredits');

  // State
  let isSpinning = false;
  let autospin = false;
  let soundOn = true;
  let lines = 10;
  let betPerLine = 5;
  let balance = 1000;

  // Setup audio
  let ctx; let master;
  function ensureAudio(){
    if(!soundOn) return;
    if(!ctx){
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.2; master.connect(ctx.destination);
    } else if(ctx.state === 'suspended'){
      ctx.resume();
    }
  }
  function beep(f, t=0.06, when=0){
    if(!soundOn) return; ensureAudio(); if(!ctx) return; const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, ctx.currentTime+when);
    g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime+when+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+when+t);
    o.connect(g); g.connect(master); o.start(ctx.currentTime+when); o.stop(ctx.currentTime+when+t+0.02);
  }
  function playClick(){ beep(440,0.03); }
  function playStop(){
    if(!soundOn) return; ensureAudio(); if(!ctx) return;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type='sine'; o.frequency.setValueAtTime(130, ctx.currentTime);
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime+0.01);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+0.09);
    o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime+0.12);
  }
  function playWin(){ [660,880,990,1320].forEach((f,i)=>beep(f,0.09,i*0.06)); }

  // Continuous spin whoosh
  let spinLoopSrc=null, spinLoopFilter=null;
  function startSpinLoop(){
    if(!soundOn) return; ensureAudio(); if(!ctx || spinLoopSrc) return;
    const buffer = ctx.createBuffer(1, 2*ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for(let i=0;i<data.length;i++){ data[i] = Math.random()*2-1; }
    const src = ctx.createBufferSource(); src.buffer = buffer; src.loop = true;
    const filter = ctx.createBiquadFilter(); filter.type='lowpass'; filter.frequency.value = 1000;
    const g = ctx.createGain(); g.gain.value = 0.12;
    src.connect(filter); filter.connect(g); g.connect(master);
    src.start(); spinLoopSrc = src; spinLoopFilter = filter;
  }
  function stopSpinLoop(){ if(spinLoopSrc){ try{ spinLoopSrc.stop(); }catch(e){} spinLoopSrc.disconnect(); spinLoopSrc=null; spinLoopFilter=null; } }

  // Helpers
  function rngWeighted(items){
    const total = items.reduce((a,b)=>a+b.weight,0); let r = Math.random()*total;
    for(const it of items){ if((r-=it.weight) <= 0) return it; }
    return items[items.length-1];
  }

  function calcTotalBet(){ return lines * betPerLine; }
  function updateBetUI(){ totalBetEl.textContent = String(calcTotalBet()); linesValEl.textContent = String(lines); betValEl.textContent = String(betPerLine); }
  function setMessage(t, color){ msgEl.textContent = t || ''; msgEl.style.color = color || 'var(--accent)'; }
  function setBalance(v){ balance = Math.max(0, Math.floor(v)); balanceEl.textContent = String(balance); }

  // Build reels columns
  const REEL_COUNT = 5; const ROWS = 3; const VISIBLE = 12; // keep more for spin illusion
  const reelCols = [...reelsEl.querySelectorAll('.reel')];
  // Create inner tracks per reel to animate in pixels
  const tracks = reelCols.map(r => { const t = document.createElement('div'); t.className = 'track'; r.appendChild(t); return t; });
  if(reelCols.length !== REEL_COUNT){ console.warn('Unexpected reel count'); }

  function createSymbolEl(char){
    const d = document.createElement('div'); d.className = 'symbol'; d.textContent = char; return d;
  }

  function fillReel(reelEl){
    const track = reelEl.querySelector('.track');
    track.innerHTML = '';
    const symbols = [];
    for(let i=0;i<VISIBLE;i++){
      const s = rngWeighted(SYMBOLS); symbols.push(s.char);
      track.appendChild(createSymbolEl(s.char));
    }
    return symbols;
  }

  // Initialize reels
  const currentGrid = Array.from({length: REEL_COUNT}, (_,c)=>fillReel(reelCols[c]));

  // Spin animation and logic (infinite scrolling with eased stop)
  async function spinOnce(){
    if(isSpinning) return; const wager = calcTotalBet();
    if(wager <= 0) { setMessage('Increase bet or lines', 'var(--muted)'); return; }
    if(balance < wager) { setMessage('Insufficient balance', 'var(--loss)'); return; }

    ensureAudio();
    isSpinning = true; setBalance(balance - wager); updateBetUI(); setMessage('Spinning...'); spinBtn.disabled = true; autoBtn.disabled = true;
    reelsEl.classList.add('spinning');
    reelsEl.classList.remove('win','loss');
    // clear prior paylines/highlights
    document.querySelectorAll('.payline').forEach(el=>el.remove());
    reelCols.forEach(col => { const tr = col.querySelector('.track'); if(tr) [...tr.children].forEach(e=>e.classList.remove('glow')); });
    startSpinLoop();

    // Build a long track for each reel to enable looping
    const results = [];
    const reelStates = reelCols.map((reelEl, idx) => {
      const track = reelEl.querySelector('.track');
      // seed with many random symbols
      track.innerHTML = '';
      const longCount = 24 + idx * 2;
      for(let i=0;i<longCount;i++) track.appendChild(createSymbolEl(rngWeighted(SYMBOLS).char));
      const cell = track.querySelector('.symbol');
      const cellH = cell ? cell.getBoundingClientRect().height : (reelEl.getBoundingClientRect().height/ROWS);
      const loopH = longCount * cellH;
      // choose final 3 symbols for this reel
      const picked = [rngWeighted(SYMBOLS).char, rngWeighted(SYMBOLS).char, rngWeighted(SYMBOLS).char];
      results[idx] = picked;
      return {
        reelEl, track, cellH, loopH,
        picked,
        offset: 0,
        velocity: 1800 + idx*160,
        phase: 'spin', // 'spin' -> 'slow' -> 'done'
        stopAt: performance.now() + 700 + idx*280
      };
    });

    let running = true; let last = performance.now();
    function tick(now){
      if(!running) return; const dt = Math.min(0.032, (now - last)/1000); last = now;
      let allDone = true;
      reelStates.forEach((st, idx) => {
        if(st.phase === 'done'){ st.track.style.transform = 'translateY(0)'; return; } else { allDone = false; }
        // transition to slow phase after stopAt
        if(st.phase==='spin' && now >= st.stopAt){ st.phase='slow'; }
        // physics update
        const decel = st.phase==='slow' ? 2600 : 0;
        st.offset += st.velocity * dt;
        if(decel>0){
          st.velocity = Math.max(220, st.velocity - decel*dt);
          // when slow enough, settle to exact symbol alignment and replace content with picked
          if(st.velocity <= 260 && st.phase!=='done'){
            st.phase = 'done';
            const rem = st.offset % st.cellH;
            st.offset += (st.cellH - rem);
            // delay rebuild until next frame so last spin motion is visible
            setTimeout(() => {
              st.track.style.transform = 'translateY(0)';
              st.track.innerHTML = '';
              st.picked.forEach(ch => st.track.appendChild(createSymbolEl(ch)));
              playStop();
            }, 60);
          }
          
        }
        // apply transform (looping)
        const y = -Math.round(st.offset % st.loopH);
        st.track.style.transform = `translateY(${y}px)`;
      });
      if(allDone){
        // Evaluate wins when all reels settled
        const { totalWin, hits } = evaluateWins(results);
        if(totalWin > 0){ setBalance(balance + totalWin); setMessage(`WIN ${totalWin}!`, 'var(--win)'); highlightWins(hits); reelsEl.classList.add('win'); playWin(); setTimeout(()=>reelsEl.classList.remove('win'), 1000); }
        else { setMessage('No win'); reelsEl.classList.add('loss'); setTimeout(()=>reelsEl.classList.remove('loss'), 350); }
        isSpinning = false; spinBtn.disabled = false; autoBtn.disabled = false; reelsEl.classList.remove('spinning');
        stopSpinLoop();
        if(autospin) setTimeout(spinOnce, 550);
        running = false; return;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    // Evaluate wins happens on settle
    if(totalWin > 0){
      // (handled in loop)
    } else {
      // (handled in loop)
    }
  }

  function evaluateWins(grid){
    const linesToCheck = Math.min(lines, PAYLINES.length);
    let totalWin = 0; const hits = [];
    for(let li=0; li<linesToCheck; li++){
      const pattern = PAYLINES[li];
      let runSym = grid[0][pattern[0]]; let runLen = 1;
      for(let c=1; c<REEL_COUNT; c++){
        const sym = grid[c][pattern[c]];
        if(sym === runSym){ runLen++; } else { break; }
      }
      if(runLen >= 3){
        // find symbol info and payout
        const info = SYMBOLS.find(s=>s.char===runSym);
        const pays = info?.pays?.[runLen] || 0;
        const lineWin = pays * betPerLine;
        if(lineWin>0){ totalWin += lineWin; hits.push({ line: li, runLen, symbol: runSym, amount: lineWin }); }
      }
    }
    return { totalWin, hits };
  }

  function highlightWins(hits){
    // Clear previous classes
    reelCols.forEach((reelEl)=>{ [...reelEl.children].forEach(e=>e.classList.remove('glow')); });
    document.querySelectorAll('.payline').forEach(el=>el.remove());
    if(hits.length===0) return;
    const indicators = document.querySelector('.payline-indicators');
    hits.forEach(hit => {
      // Add a glowing payline
      const line = document.createElement('div');
      line.className = 'payline show';
      const y = hitLineY(hit.line);
      line.style.top = `calc(${y} - 1px)`;
      indicators.appendChild(line);
      // Glow symbols in the run
      const pattern = PAYLINES[hit.line];
      for(let c=0;c<hit.runLen;c++){
        const row = pattern[c];
        const el = reelCols[c].querySelector('.track')?.children[row]; if(el) el.classList.add('glow');
      }
      // remove line after some seconds
      setTimeout(()=>line.remove(), 2200);
    });
  }

  function hitLineY(lineIndex){
    // Map row 0/1/2 to relative vertical positions inside reels area
    const reelsRect = reelsEl.getBoundingClientRect();
    const cellH = reelsRect.height / 3; // 3 rows visible
    const pattern = PAYLINES[lineIndex];
    // position based on first column row index accounting for inner padding
    return `${(pattern[0]+0.5) * cellH}px`;
  }

  // Controls
  document.getElementById('linesInc').onclick = () => { lines = Math.min(PAYLINES.length, lines + 1); updateBetUI(); };
  document.getElementById('linesDec').onclick = () => { lines = Math.max(1, lines - 1); updateBetUI(); };
  document.getElementById('betInc').onclick = () => { betPerLine = Math.min(50, betPerLine + 1); updateBetUI(); };
  document.getElementById('betDec').onclick = () => { betPerLine = Math.max(1, betPerLine - 1); updateBetUI(); };
  addBtn.onclick = () => { setBalance(balance + 500); setMessage('Credits added', 'var(--win)'); };
  spinBtn.onclick = () => { autospin = false; autoBtn.textContent = 'AUTO'; spinOnce(); };
  autoBtn.onclick = () => { autospin = !autospin; autoBtn.textContent = autospin ? 'AUTO: ON' : 'AUTO'; if(autospin && !isSpinning) spinOnce(); };
  soundBtn.onclick = () => { soundOn = !soundOn; if(soundOn) ensureAudio(); soundBtn.textContent = `SOUND: ${soundOn? 'ON':'OFF'}`; };

  // Keyboard
  window.addEventListener('keydown', (e)=>{
    if(e.code==='Space'){ e.preventDefault(); spinBtn.click(); }
    else if(e.code==='ArrowUp'){ betPerLine = Math.min(50, betPerLine + 1); updateBetUI(); }
    else if(e.code==='ArrowDown'){ betPerLine = Math.max(1, betPerLine - 1); updateBetUI(); }
    else if(e.code==='ArrowRight'){ lines = Math.min(PAYLINES.length, lines + 1); updateBetUI(); }
    else if(e.code==='ArrowLeft'){ lines = Math.max(1, lines - 1); updateBetUI(); }
  });

  // Initial UI sync
  updateBetUI(); setBalance(balance); setMessage('Welcome! Press SPIN to play.');
  // Ensure audio on first user gesture
  ['click','keydown','pointerdown','touchstart'].forEach(ev=>{
    window.addEventListener(ev, ()=>ensureAudio(), { once:true, passive:true });
  });
})();


