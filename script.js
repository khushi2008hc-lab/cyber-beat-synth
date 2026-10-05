(function () {
  'use strict';

  let audioCtx = null;
  let analyser = null;
  let isPlaying = false;
  let currentStep = 0;
  let timerId = null;
  let bpm = 128;

  const instruments = ['kick', 'snare', 'hihat', 'lead', 'bass'];
  const grid = {
    kick: new Array(16).fill(false),
    snare: new Array(16).fill(false),
    hihat: new Array(16).fill(false),
    lead: new Array(16).fill(false),
    bass: new Array(16).fill(false)
  };

  const presets = {
    cyberpunk: {
      kick:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hihat: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
      lead:  [1,0,0,1, 0,0,1,0, 0,1,0,0, 1,0,1,0],
      bass:  [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,1,0,0]
    },
    synthwave: {
      kick:  [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hihat: [0,1,0,1, 0,1,0,1, 0,1,0,1, 0,1,0,1],
      lead:  [1,0,1,0, 0,0,1,0, 1,0,0,1, 0,1,0,0],
      bass:  [1,1,0,1, 1,0,1,1, 1,1,0,1, 1,0,1,1]
    },
    deephouse: {
      kick:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hihat: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
      lead:  [0,0,0,1, 0,0,0,0, 0,1,0,0, 0,0,1,0],
      bass:  [1,0,0,1, 0,0,1,0, 0,0,1,0, 0,1,0,0]
    }
  };

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyser.connect(audioCtx.destination);
      startOscilloscope();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  // Procedural Sound Synthesizers
  function playSound(type) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;

    if (type === 'kick') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(0.01, now + 0.4);
      gain.gain.setValueAtTime(1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.connect(gain);
      gain.connect(analyser);
      osc.start(now);
      osc.stop(now + 0.4);
    } else if (type === 'snare') {
      // Noise buffer for snare
      const bufferSize = audioCtx.sampleRate * 0.15;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 1000;
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.7, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(analyser);
      noise.start(now);
    } else if (type === 'hihat') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(8000, now);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc.connect(gain);
      gain.connect(analyser);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'lead') {
      const notes = [440, 523.25, 587.33, 659.25, 783.99]; // Pentatonic
      const note = notes[currentStep % notes.length];
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(note, now);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.connect(gain);
      gain.connect(analyser);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'bass') {
      const bassNotes = [110, 123.47, 98, 87.31];
      const note = bassNotes[(currentStep / 4 | 0) % bassNotes.length];
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note, now);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.connect(gain);
      gain.connect(analyser);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  }

  // Step Sequencer Step Loop
  function tick() {
    // Play active sounds at currentStep
    instruments.forEach(inst => {
      if (grid[inst][currentStep]) {
        playSound(inst);
      }
    });

    // Update UI Indicators
    updateStepVisuals();

    currentStep = (currentStep + 1) % 16;
  }

  function updateStepVisuals() {
    instruments.forEach(inst => {
      const container = document.getElementById(`steps-${inst}`);
      const buttons = container.querySelectorAll('.step-btn');
      buttons.forEach((btn, idx) => {
        btn.classList.toggle('current', idx === currentStep);
      });
    });

    const indContainer = document.getElementById('step-indicators');
    const dots = indContainer.querySelectorAll('.indicator-dot');
    dots.forEach((dot, idx) => {
      dot.classList.toggle('active', idx === currentStep);
    });
  }

  // Oscilloscope Canvas Visualizer
  function startOscilloscope() {
    const scopeCanvas = document.getElementById('scope-canvas');
    const scopeCtx = scopeCanvas.getContext('2d');
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
      requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      scopeCtx.fillStyle = '#05070a';
      scopeCtx.fillRect(0, 0, scopeCanvas.width, scopeCanvas.height);

      scopeCtx.lineWidth = 2;
      scopeCtx.strokeStyle = '#00f5d4';
      scopeCtx.beginPath();

      const sliceWidth = scopeCanvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * (scopeCanvas.height / 2);
        if (i === 0) scopeCtx.moveTo(x, y);
        else scopeCtx.lineTo(x, y);
        x += sliceWidth;
      }

      scopeCtx.lineTo(scopeCanvas.width, scopeCanvas.height / 2);
      scopeCtx.stroke();
    }
    draw();
  }

  // Render Sequencer Grid Buttons
  function renderGrid() {
    instruments.forEach(inst => {
      const container = document.getElementById(`steps-${inst}`);
      container.innerHTML = '';
      for (let i = 0; i < 16; i++) {
        const btn = document.createElement('button');
        btn.className = `step-btn ${grid[inst][i] ? 'active' : ''}`;
        btn.setAttribute('data-step', i);
        btn.addEventListener('click', () => {
          grid[inst][i] = !grid[inst][i];
          btn.classList.toggle('active', grid[inst][i]);
          initAudio();
          if (grid[inst][i]) playSound(inst);
        });
        container.appendChild(btn);
      }
    });

    const indContainer = document.getElementById('step-indicators');
    indContainer.innerHTML = '';
    for (let i = 0; i < 16; i++) {
      const dot = document.createElement('div');
      dot.className = 'indicator-dot';
      indContainer.appendChild(dot);
    }
  }

  // Load Preset
  function loadPreset(name) {
    const p = presets[name];
    if (!p) return;
    instruments.forEach(inst => {
      grid[inst] = [...p[inst]];
    });
    renderGrid();
  }

  // Controls
  const playBtn = document.getElementById('play-btn');
  playBtn.addEventListener('click', () => {
    initAudio();
    isPlaying = !isPlaying;
    if (isPlaying) {
      playBtn.innerHTML = '<i class="fa-solid fa-pause"></i> STOP';
      playBtn.style.background = '#ff007f';
      const interval = (60 / bpm / 4) * 1000;
      timerId = setInterval(tick, interval);
    } else {
      playBtn.innerHTML = '<i class="fa-solid fa-play"></i> START';
      playBtn.style.background = '';
      clearInterval(timerId);
    }
  });

  const bpmSlider = document.getElementById('bpm-slider');
  bpmSlider.addEventListener('input', (e) => {
    bpm = parseInt(e.target.value, 10);
    document.getElementById('bpm-val').textContent = bpm;
    if (isPlaying) {
      clearInterval(timerId);
      const interval = (60 / bpm / 4) * 1000;
      timerId = setInterval(tick, interval);
    }
  });

  document.getElementById('clear-btn').addEventListener('click', () => {
    instruments.forEach(inst => grid[inst].fill(false));
    renderGrid();
  });

  // Preset Buttons
  document.querySelectorAll('.preset-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.preset-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      loadPreset(pill.getAttribute('data-preset'));
    });
  });

  loadPreset('cyberpunk');
})();
