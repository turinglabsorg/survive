// Get actual viewport dimensions (accounting for mobile browser UI)
const getViewportSize = () => {
  return {
    width: Math.min(window.innerWidth, document.documentElement.clientWidth),
    height: Math.min(window.innerHeight, document.documentElement.clientHeight)
  };
};

// Dark MIDI Music Generator
const DarkMusicGenerator = () => {
  const audioContextRef = React.useRef(null);
  const oscillatorsRef = React.useRef([]);
  const gainNodeRef = React.useRef(null);
  const reverbConvolverRef = React.useRef(null);
  const distortionRef = React.useRef(null);
  const isPlayingRef = React.useRef(false);
  const intervalRef = React.useRef(null);

  // Minor pentatonic scale notes (in MIDI note numbers, lower octaves for darkness)
  // C minor pentatonic: C, Eb, F, G, Bb (repeated across octaves)
  const pentatonicScale = [36, 39, 41, 43, 46, 48, 51, 53, 55, 58, 60, 63, 65, 67, 70]; // Multiple octaves of pentatonic
  const darkScale = pentatonicScale; // Keep for backward compatibility
  const darkChords = [
    [36, 39, 43], // Cm
    [39, 43, 46], // Ebm
    [41, 44, 48], // Fm
    [43, 46, 51], // Gm
    [36, 43, 48]  // Cm (inversion)
  ];

  // Upper harmonized notes (2 octaves higher for bright contrast)
  const getUpperHarmony = (baseNote) => {
    return baseNote + 24; // 2 octaves up
  };

  const createReverbImpulse = (audioContext, duration = 2, decay = 2) => {
    const sampleRate = audioContext.sampleRate;
    const length = sampleRate * duration;
    const impulse = audioContext.createBuffer(2, length, sampleRate);
    const impulseL = impulse.getChannelData(0);
    const impulseR = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = length - i;
      impulseL[i] = (Math.random() * 2 - 1) * Math.pow(n / length, decay);
      impulseR[i] = (Math.random() * 2 - 1) * Math.pow(n / length, decay);
    }
    return impulse;
  };

  const createDistortion = (audioContext, amount = 50) => {
    const distortion = audioContext.createWaveShaper();
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }

    distortion.curve = curve;
    distortion.oversample = '4x';
    return distortion;
  };

  const initAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      
      // Main gain for overall volume
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.gain.value = 0.15;
      gainNodeRef.current.connect(audioContextRef.current.destination);

      // Create reverb
      reverbConvolverRef.current = audioContextRef.current.createConvolver();
      reverbConvolverRef.current.buffer = createReverbImpulse(audioContextRef.current, 3, 2);
      
      // Create distortion for upper notes
      distortionRef.current = createDistortion(audioContextRef.current, 40);
      
      // Connect reverb to main gain
      reverbConvolverRef.current.connect(gainNodeRef.current);
    }
  };

  // Helper function to safely resume audio context with error handling
  const resumeAudioContext = () => {
    if (!audioContextRef.current) {
      initAudio();
    }
    
    if (audioContextRef.current.state === 'suspended') {
      // resume() returns a Promise - handle it properly
      audioContextRef.current.resume().catch(err => {
        console.warn('Failed to resume audio context:', err);
        // Audio might be blocked by browser policy - this is expected in some cases
      });
    }
  };

  const midiToFrequency = (midiNote) => {
    return 440 * Math.pow(2, (midiNote - 69) / 12);
  };

  const playNote = (midiNote, duration, delay = 0, volume = 0.3, useEffects = false) => {
    if (!audioContextRef.current) return;
    
    // Don't play if context is closed or in an error state
    if (audioContextRef.current.state === 'closed') return;

    const oscillator = audioContextRef.current.createOscillator();
    const gainNode = audioContextRef.current.createGain();
    
    oscillator.type = 'sine'; // Darker, smoother sound
    oscillator.frequency.value = midiToFrequency(midiNote);
    
    gainNode.gain.setValueAtTime(0, audioContextRef.current.currentTime + delay);
    gainNode.gain.linearRampToValueAtTime(volume, audioContextRef.current.currentTime + delay + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + delay + duration);
    
    oscillator.connect(gainNode);
    
    // Route through distortion and reverb for upper notes
    if (useEffects) {
      gainNode.connect(distortionRef.current);
      distortionRef.current.connect(reverbConvolverRef.current);
    } else {
      gainNode.connect(gainNodeRef.current);
    }
    
    oscillator.start(audioContextRef.current.currentTime + delay);
    oscillator.stop(audioContextRef.current.currentTime + delay + duration);
  };

  const playDarkChord = () => {
    if (!isPlayingRef.current || !audioContextRef.current) return;

    // Random chord from dark scale
    const chord = darkChords[Math.floor(Math.random() * darkChords.length)];
    const baseDelay = Math.random() * 0.5;
    
    // Play chord notes with slight delays for atmosphere
    chord.forEach((note, index) => {
      const delay = baseDelay + (index * 0.1);
      const duration = 2 + Math.random() * 3; // Long, sustained notes
      const volume = 0.2 + Math.random() * 0.15;
      playNote(note, duration, delay, volume, false);
      
      // Add harmonized upper notes with distortion and reverb
      const upperNote = getUpperHarmony(note);
      const upperDelay = delay + 0.2 + Math.random() * 0.3; // Slight delay for harmony effect
      const upperDuration = duration * 0.8; // Slightly shorter
      const upperVolume = (volume * 0.6) + Math.random() * 0.1; // Softer but present
      playNote(upperNote, upperDuration, upperDelay, upperVolume, true);
    });

    // Add a random bass note (very low, very dark)
    const bassNote = darkScale[0] - 12; // Octave lower
    playNote(bassNote, 3 + Math.random() * 2, baseDelay, 0.15, false);
  };

  const playDarkMelody = () => {
    if (!isPlayingRef.current || !audioContextRef.current) return;

    // Random melody from dark scale
    const noteCount = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < noteCount; i++) {
      const note = darkScale[Math.floor(Math.random() * darkScale.length)];
      const delay = i * (0.8 + Math.random() * 0.4);
      const duration = 1.5 + Math.random() * 1.5;
      const volume = 0.15 + Math.random() * 0.1;
      playNote(note, duration, delay, volume, false);
      
      // Add harmonized upper note with effects (random chance for variety)
      if (Math.random() > 0.3) {
        const upperNote = getUpperHarmony(note);
        const upperDelay = delay + 0.15 + Math.random() * 0.2;
        const upperDuration = duration * 0.7;
        const upperVolume = volume * 0.5;
        playNote(upperNote, upperDuration, upperDelay, upperVolume, true);
      }
    }
  };

  const startMusic = () => {
    if (isPlayingRef.current) return;
    
    initAudio();
    resumeAudioContext();
    isPlayingRef.current = true;

    // Play initial chord
    playDarkChord();

    // Play chords periodically (every 3-5 seconds)
    const chordInterval = setInterval(() => {
      if (isPlayingRef.current) {
        playDarkChord();
      }
    }, 3000 + Math.random() * 2000);

    // Play melodies periodically (every 2-4 seconds)
    const melodyInterval = setInterval(() => {
      if (isPlayingRef.current) {
        playDarkMelody();
      }
    }, 2000 + Math.random() * 2000);

    intervalRef.current = { chordInterval, melodyInterval };
  };

  // Play a step sound based on tile position using the tile-to-note mapping
  const playStepSound = (tileX, tileY, noteMap = []) => {
    resumeAudioContext();
    
    // Get the note assigned to this tile from the mapping
    // Each tile has a unique note that changes with each new game
    let stepNote;
    if (noteMap.length > 0 && 
        tileY >= 0 && tileY < noteMap.length &&
        tileX >= 0 && tileX < noteMap[tileY].length) {
      stepNote = noteMap[tileY][tileX];
    } else {
      // Fallback to a default note if mapping not ready
      stepNote = 48; // Middle C
    }
    
    // Create a deterministic pseudo-random for this tile for consistent timing/volume
    const seed = (tileX * 1000 + tileY) % 1000;
    const pseudoRandom = () => {
      let value = Math.sin(seed) * 10000;
      return value - Math.floor(value);
    };
    
    // Play a short, percussive note for the step
    const duration = 0.2 + pseudoRandom() * 0.15; // Short, snappy
    const volume = 0.25 + pseudoRandom() * 0.15; // Noticeable but not overwhelming
    
    // Random delay between 500ms and 1s (0.5 to 1.0 seconds)
    const delay = 0.5 + Math.random() * 0.5;
    
    // Sometimes add the harmonized upper note with effects
    if (pseudoRandom() > 0.5) {
      const upperNote = stepNote + 24; // 2 octaves up
      playNote(upperNote, duration * 0.6, delay + 0.05, volume * 0.4, true);
    }
    
    playNote(stepNote, duration, delay, volume, false);
  };

  const stopMusic = () => {
    isPlayingRef.current = false;
    if (intervalRef.current) {
      clearInterval(intervalRef.current.chordInterval);
      clearInterval(intervalRef.current.melodyInterval);
      intervalRef.current = null;
    }
    // Stop all oscillators
    if (oscillatorsRef.current) {
      oscillatorsRef.current.forEach(osc => {
        try { osc.stop(); } catch (e) {}
      });
      oscillatorsRef.current = [];
    }
  };

  React.useEffect(() => {
    return () => {
      stopMusic();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Play lose sound - very dark and long note
  const playLoseSound = () => {
    resumeAudioContext();
    
    // Very low, dark note (2 octaves below the lowest scale note)
    const darkNote = darkScale[0] - 24; // Very deep bass
    const duration = 4; // Long note
    const volume = 0.4; // Noticeable but not overwhelming
    
    playNote(darkNote, duration, 0, volume, false);
  };

  // Play win sound - high note with reverb
  const playWinSound = () => {
    resumeAudioContext();
    
    // High note (2 octaves above the highest scale note)
    const highNote = darkScale[darkScale.length - 1] + 24; // Very high
    const duration = 2; // Medium length
    const volume = 0.35; // Bright and clear
    
    // Play with reverb (useEffects = true)
    playNote(highNote, duration, 0, volume, true);
  };

  // Play drum kick sound for bullet shots
  const playDrumKick = () => {
    resumeAudioContext();
    
    const now = audioContextRef.current.currentTime;
    
    // Pure bass drum kick - only low frequencies, no high frequencies
    const kickOsc = audioContextRef.current.createOscillator();
    const kickGain = audioContextRef.current.createGain();
    
    kickOsc.type = 'sine'; // Pure sine wave for clean bass
    // Very low frequencies for deep bass kick drum
    kickOsc.frequency.setValueAtTime(50, now);
    kickOsc.frequency.exponentialRampToValueAtTime(30, now + 0.05);
    kickOsc.frequency.exponentialRampToValueAtTime(25, now + 0.15);
    
    // Sharp attack, quick decay for punchy kick
    kickGain.gain.setValueAtTime(0, now);
    kickGain.gain.linearRampToValueAtTime(0.9, now + 0.001); // Very quick attack
    kickGain.gain.exponentialRampToValueAtTime(0.4, now + 0.02);
    kickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25); // Quick decay
    
    kickOsc.connect(kickGain);
    kickGain.connect(gainNodeRef.current);
    
    // Start the kick
    kickOsc.start(now);
    kickOsc.stop(now + 0.25);
  };

  // Play drum splash sound when player gets shot
  const playDrumSplash = () => {
    resumeAudioContext();
    
    const now = audioContextRef.current.currentTime;
    
    // Create a splash/cymbal-like sound with noise and high frequencies
    // Use multiple oscillators for a rich splash sound
    const frequencies = [800, 1200, 1600, 2000];
    
    frequencies.forEach((freq, index) => {
      const splashOsc = audioContextRef.current.createOscillator();
      const splashGain = audioContextRef.current.createGain();
      
      splashOsc.type = 'sine';
      splashOsc.frequency.setValueAtTime(freq, now);
      splashOsc.frequency.exponentialRampToValueAtTime(freq * 0.3, now + 0.3);
      
      // Quick attack, longer decay with reverb-like tail
      const delay = index * 0.01; // Slight stagger for richness
      splashGain.gain.setValueAtTime(0, now + delay);
      splashGain.gain.linearRampToValueAtTime(0.3, now + delay + 0.01);
      splashGain.gain.exponentialRampToValueAtTime(0.1, now + delay + 0.1);
      splashGain.gain.exponentialRampToValueAtTime(0.01, now + delay + 0.5);
      
      splashOsc.connect(splashGain);
      // Route through reverb for splash effect
      splashGain.connect(reverbConvolverRef.current);
      
      splashOsc.start(now + delay);
      splashOsc.stop(now + delay + 0.5);
    });
  };

  // Play gong sound when player gets trapped
  const playGong = () => {
    resumeAudioContext();
    
    const now = audioContextRef.current.currentTime;
    
    // Create a gong sound with multiple harmonics for metallic character
    // Gong frequencies: fundamental and harmonics
    const gongFrequencies = [
      { freq: 200, volume: 0.6 },   // Fundamental
      { freq: 400, volume: 0.4 },   // 2nd harmonic
      { freq: 600, volume: 0.3 },   // 3rd harmonic
      { freq: 800, volume: 0.2 }   // 4th harmonic
    ];
    
    gongFrequencies.forEach(({ freq, volume }, index) => {
      const gongOsc = audioContextRef.current.createOscillator();
      const gongGain = audioContextRef.current.createGain();
      
      gongOsc.type = 'sine';
      gongOsc.frequency.setValueAtTime(freq, now);
      // Slight frequency modulation for metallic character
      gongOsc.frequency.exponentialRampToValueAtTime(freq * 0.95, now + 2);
      
      // Slow attack, very long decay (gong characteristic)
      const delay = index * 0.05; // Slight stagger
      gongGain.gain.setValueAtTime(0, now + delay);
      gongGain.gain.linearRampToValueAtTime(volume, now + delay + 0.1); // Slow attack
      gongGain.gain.exponentialRampToValueAtTime(volume * 0.5, now + delay + 0.5);
      gongGain.gain.exponentialRampToValueAtTime(0.01, now + delay + 3); // Long decay
      
      gongOsc.connect(gongGain);
      // Route through reverb for gong's characteristic resonance
      gongGain.connect(reverbConvolverRef.current);
      
      gongOsc.start(now + delay);
      gongOsc.stop(now + delay + 3);
    });
  };

  // Mute/unmute audio by setting gain to 0 or restoring volume
  const setMuted = (muted) => {
    if (!gainNodeRef.current) {
      initAudio();
    }
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = muted ? 0 : 0.15;
    }
  };

  return { startMusic, stopMusic, playStepSound, playLoseSound, playWinSound, playDrumKick, playDrumSplash, playGong, setMuted };
};

const IsometricGame = () => {
  const canvasRef = React.useRef(null);
  const canvasContainerRef = React.useRef(null);
  const tileDimensionsRef = React.useRef({ width: 20, height: 10 });
  const joystickRef = React.useRef(null);
  const joystickHandleRef = React.useRef(null);
  const [ballPos, setBallPos] = React.useState({ x: 0, y: 0 });
  const [endPoint, setEndPoint] = React.useState({ x: 0, y: 0 });
  const [gameState, setGameState] = React.useState('playing');
  const [gameMap, setGameMap] = React.useState([]);
  const [score, setScore] = React.useState(() => {
    // Load steps done from localStorage
    const saved = localStorage.getItem('survive_steps_done');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [enemies, setEnemies] = React.useState([]);
  const [bullets, setBullets] = React.useState([]);
  const [joystickPos, setJoystickPos] = React.useState({ x: 0, y: 0 });
  const [isJoystickActive, setIsJoystickActive] = React.useState(false);
  const joystickDirectionRef = React.useRef({ x: 0, y: 0 });
  const [soundEnabled, setSoundEnabled] = React.useState(() => {
    // Load sound preference from localStorage, default to true
    const saved = localStorage.getItem('survive_sound_enabled');
    return saved !== null ? saved === 'true' : true;
  });
  // Tile-to-note mapping: each tile gets a unique note from pentatonic scale (per game)
  const [tileNoteMap, setTileNoteMap] = React.useState([]);
  
  // Music generator
  const musicGenerator = DarkMusicGenerator();
  const musicGeneratorRef = React.useRef(musicGenerator);
  
  // Update ref when musicGenerator changes
  React.useEffect(() => {
    musicGeneratorRef.current = musicGenerator;
  }, [musicGenerator]);

  // Toggle sound on/off
  const toggleSound = () => {
    const newState = !soundEnabled;
    setSoundEnabled(newState);
  };

  // Save sound preference to localStorage whenever it changes
  React.useEffect(() => {
    localStorage.setItem('survive_sound_enabled', soundEnabled.toString());
  }, [soundEnabled]);

  // Apply sound state when it changes or when music generator is ready
  React.useEffect(() => {
    if (musicGenerator.setMuted) {
      musicGenerator.setMuted(!soundEnabled);
    }
  }, [soundEnabled, musicGenerator]);

  // Random grid size between 24 and 50 - tile dimensions will scale to fit
  const [GRID_SIZE] = React.useState(() => Math.floor(Math.random() * (20 - 10 + 1)) + 10);
  const MOVE_INTERVAL_MS = 250; // Movement cadence (0.5s per step)

  // Calculate tile dimensions dynamically to fit viewport
  const calculateTileDimensions = (canvasWidth, canvasHeight) => {
    const padding = 40; // 20px on each side
    const topSpace = 100; // Space for title
    const bottomSpace = 220; // Space for controls and score

    const availableWidth = canvasWidth - padding;
    const availableHeight = canvasHeight - topSpace - bottomSpace;

    // For isometric grid: total width = (GRID_SIZE - 1) * TILE_WIDTH
    // total height = (GRID_SIZE - 1) * TILE_HEIGHT
    // We want TILE_WIDTH = 2 * TILE_HEIGHT for proper isometric look

    const maxTileHeight = availableHeight / (GRID_SIZE - 1);
    const maxTileWidthFromWidth = availableWidth / (GRID_SIZE - 1);

    // Since TILE_WIDTH = 2 * TILE_HEIGHT, calculate based on both constraints
    const tileHeightFromWidth = maxTileWidthFromWidth / 2;
    const tileHeight = Math.min(maxTileHeight, tileHeightFromWidth);
    const tileWidth = tileHeight * 2;

    return { width: tileWidth, height: tileHeight };
  };

  // Generate random map with start and end points
  const generateRandomMap = () => {
    const map = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      const row = [];
      for (let x = 0; x < GRID_SIZE; x++) {
        const rand = Math.random();
        if (rand < 0.05) {
          row.push(1); // Wall (5%)
        } else if (rand < 0.10) {
          row.push(2); // Hole (5%)
        } else {
          row.push(0); // Empty (85%)
        }
      }
      map.push(row);
    }

    // Generate random start and end points
    const startX = Math.floor(Math.random() * GRID_SIZE);
    const startY = Math.floor(Math.random() * GRID_SIZE);
    let endX, endY;

    // Ensure end point is far from start
    do {
      endX = Math.floor(Math.random() * GRID_SIZE);
      endY = Math.floor(Math.random() * GRID_SIZE);
    } while (Math.abs(endX - startX) < Math.floor(GRID_SIZE / 3) ||
      Math.abs(endY - startY) < Math.floor(GRID_SIZE / 3));

    // Clear start and end areas
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        // Clear start area
        const sx = startX + dx;
        const sy = startY + dy;
        if (sx >= 0 && sx < GRID_SIZE && sy >= 0 && sy < GRID_SIZE) {
          map[sy][sx] = 0;
        }

        // Clear end area
        const ex = endX + dx;
        const ey = endY + dy;
        if (ex >= 0 && ex < GRID_SIZE && ey >= 0 && ey < GRID_SIZE) {
          map[ey][ex] = 0;
        }
      }
    }

    // Generate enemies - random number between 2 to 5
    const enemyCount = Math.floor(Math.random() * 4) + 2; // Random between 2-5
    const newEnemies = [];
    for (let i = 0; i < enemyCount; i++) {
      let ex, ey;
      do {
        ex = Math.floor(Math.random() * GRID_SIZE);
        ey = Math.floor(Math.random() * GRID_SIZE);
      } while (map[ey][ex] !== 0 || (Math.abs(ex - startX) < 3 && Math.abs(ey - startY) < 3));

      newEnemies.push({
        x: ex,
        y: ey,
        moveTimer: 0,
        shootTimer: Math.floor(Math.random() * 60) + 30
      });
    }

    // Generate unique tile-to-note mapping for this game
    // Each tile gets a unique note from the pentatonic scale
    const noteMap = [];
    const pentatonicNotes = [36, 39, 41, 43, 46, 48, 51, 53, 55, 58, 60, 63, 65, 67, 70, 72, 75, 77, 79, 82];
    
    // Create a shuffled array of notes to ensure variety
    const shuffledNotes = [...pentatonicNotes];
    for (let i = shuffledNotes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledNotes[i], shuffledNotes[j]] = [shuffledNotes[j], shuffledNotes[i]];
    }
    
    // Generate a random starting octave offset for this game
    const gameOctaveOffset = Math.floor(Math.random() * 3) * 12; // 0, 12, or 24 semitones
    
    for (let y = 0; y < GRID_SIZE; y++) {
      const row = [];
      for (let x = 0; x < GRID_SIZE; x++) {
        // Use position-based index with some randomness for variety
        const positionIndex = (x * GRID_SIZE + y) % shuffledNotes.length;
        const baseNote = shuffledNotes[positionIndex];
        
        // Add slight octave variation per tile (0-1 octave up)
        const tileOctaveVariation = Math.floor((Math.sin(x * 7 + y * 11) * 10000) % 2) * 12;
        const finalNote = baseNote + gameOctaveOffset + tileOctaveVariation;
        
        row.push(finalNote);
      }
      noteMap.push(row);
    }

    // Set ball position, end point, score, and enemies
    setBallPos({ x: startX, y: startY });
    setEndPoint({ x: endX, y: endY });
    // Don't reset score - keep accumulating steps done
    setEnemies(newEnemies);
    setBullets([]);
    setTileNoteMap(noteMap); // Set the tile-to-note mapping for this game

    return map;
  };

  // Save steps done to localStorage whenever score changes
  React.useEffect(() => {
    localStorage.setItem('survive_steps_done', score.toString());
  }, [score]);

  React.useEffect(() => {
    setGameMap(generateRandomMap());
  }, []);

  // Start music on first user interaction (handles browser autoplay policy)
  React.useEffect(() => {
    let musicStarted = false;
    const startMusicOnInteraction = () => {
      if (!musicStarted) {
        musicGenerator.startMusic();
        musicStarted = true;
      }
    };

    // Try to start on any user interaction
    window.addEventListener('click', startMusicOnInteraction, { once: true });
    window.addEventListener('keydown', startMusicOnInteraction, { once: true });
    window.addEventListener('touchstart', startMusicOnInteraction, { once: true });

    return () => {
      window.removeEventListener('click', startMusicOnInteraction);
      window.removeEventListener('keydown', startMusicOnInteraction);
      window.removeEventListener('touchstart', startMusicOnInteraction);
      musicGenerator.stopMusic();
    };
  }, []);

  const toIsometric = (x, y, tileWidth = tileDimensionsRef.current.width, tileHeight = tileDimensionsRef.current.height) => {
    const isoX = (x - y) * (tileWidth / 2);
    const isoY = (x + y) * (tileHeight / 2);
    return { x: isoX, y: isoY };
  };

  const drawGrid = (ctx) => {
    // Set up clipping to ensure nothing draws outside canvas bounds
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.clip();

    const TILE_WIDTH = tileDimensionsRef.current.width;
    const TILE_HEIGHT = tileDimensionsRef.current.height;

    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 0.5;

    // Center the grid perfectly in the viewport with padding
    const corners = [
      toIsometric(0, 0),
      toIsometric(GRID_SIZE - 1, 0),
      toIsometric(0, GRID_SIZE - 1),
      toIsometric(GRID_SIZE - 1, GRID_SIZE - 1)
    ];

    const minX = Math.min(...corners.map(c => c.x));
    const maxX = Math.max(...corners.map(c => c.x));
    const minY = Math.min(...corners.map(c => c.y));
    const maxY = Math.max(...corners.map(c => c.y));

    const gridWidth = maxX - minX;
    const gridHeight = maxY - minY;

    // Use actual canvas dimensions
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;
    const padding = 20; // Padding on all sides
    const topSpace = 100; // Space for title

    // Calculate offset to center grid
    const offsetX = (canvasWidth - gridWidth) / 2 - minX;
    const offsetY = topSpace + (canvasHeight - topSpace - 180 - gridHeight) / 2 - minY;

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const iso = toIsometric(x, y);
        const centerX = offsetX + iso.x;
        const centerY = offsetY + iso.y;

        // Skip drawing if outside canvas bounds (with some margin for tile rendering)
        if (centerX < -TILE_WIDTH || centerX > ctx.canvas.width + TILE_WIDTH ||
          centerY < -TILE_HEIGHT || centerY > ctx.canvas.height + TILE_HEIGHT) {
          continue;
        }

        // Draw tile outline
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + TILE_WIDTH / 2, centerY + TILE_HEIGHT / 2);
        ctx.lineTo(centerX, centerY + TILE_HEIGHT);
        ctx.lineTo(centerX - TILE_WIDTH / 2, centerY + TILE_HEIGHT / 2);
        ctx.closePath();
        ctx.stroke();

        // Draw special tiles
        const tileType = gameMap[y]?.[x];
        if (tileType === 1) { // Wall
          ctx.fillStyle = '#ffffff';
          const wallHeight = Math.max(12, TILE_HEIGHT * 1.2);
          ctx.fillRect(centerX - 2, centerY - wallHeight, 4, wallHeight + TILE_HEIGHT * 0.8);
        } else if (tileType === 2) { // Yellow tile (trap)
          // Draw isometric yellow tile with softer color
          ctx.fillStyle = '#ffffcc'; // Lighter, softer yellow
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(centerX + TILE_WIDTH / 2, centerY + TILE_HEIGHT / 2);
          ctx.lineTo(centerX, centerY + TILE_HEIGHT);
          ctx.lineTo(centerX - TILE_WIDTH / 2, centerY + TILE_HEIGHT / 2);
          ctx.closePath();
          ctx.fill();

          // Add subtle orange border
          ctx.strokeStyle = '#ffcc66'; // Lighter orange
          ctx.lineWidth = 0.5;
          ctx.stroke();
          ctx.strokeStyle = '#00ff00';
          ctx.lineWidth = 0.5;
        }

        // Draw enemies
        const enemySize = Math.max(6, TILE_HEIGHT * 0.8);
        enemies.forEach(enemy => {
          if (enemy.x === x && enemy.y === y) {
            const enemyIso = toIsometric(enemy.x, enemy.y);
            const enemyCenterX = offsetX + enemyIso.x;
            const enemyCenterY = offsetY + enemyIso.y;

            // Skip if outside bounds
            if (enemyCenterX < -10 || enemyCenterX > ctx.canvas.width + 10 ||
              enemyCenterY < -10 || enemyCenterY > ctx.canvas.height + 10) {
              return;
            }

            ctx.fillStyle = '#ff0000';
            ctx.fillRect(enemyCenterX - enemySize / 2, enemyCenterY - enemySize / 2, enemySize, enemySize);
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 1;
            ctx.strokeRect(enemyCenterX - enemySize / 2, enemyCenterY - enemySize / 2, enemySize, enemySize);
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 0.5;
          }
        });

        // Draw bullets
        const bulletRadius = Math.max(2, TILE_HEIGHT * 0.3);
        bullets.forEach(bullet => {
          if (Math.floor(bullet.x) === x && Math.floor(bullet.y) === y) {
            const bulletIso = toIsometric(bullet.x, bullet.y);
            const bulletCenterX = offsetX + bulletIso.x;
            const bulletCenterY = offsetY + bulletIso.y;

            // Skip if outside bounds
            if (bulletCenterX < -10 || bulletCenterX > ctx.canvas.width + 10 ||
              bulletCenterY < -10 || bulletCenterY > ctx.canvas.height + 10) {
              return;
            }

            ctx.fillStyle = '#ff8800';
            ctx.beginPath();
            ctx.arc(bulletCenterX, bulletCenterY, bulletRadius, 0, Math.PI * 2);
            ctx.fill();
          }
        });

        // Draw end point
        if (endPoint.x === x && endPoint.y === y) {
          const endIso = toIsometric(endPoint.x, endPoint.y);
          const endCenterX = offsetX + endIso.x;
          const endCenterY = offsetY + endIso.y;

          const starOuterRadius = Math.max(8, TILE_HEIGHT * 1.2);
          const starInnerRadius = starOuterRadius / 2;

          ctx.fillStyle = '#ffff00';
          ctx.strokeStyle = '#ffff00';
          ctx.lineWidth = 2;
          // Draw star shape for end point
          ctx.beginPath();
          for (let i = 0; i < 5; i++) {
            const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
            const outerX = endCenterX + Math.cos(angle) * starOuterRadius;
            const outerY = endCenterY + Math.sin(angle) * starOuterRadius;
            const innerAngle = ((i + 0.5) * 2 * Math.PI) / 5 - Math.PI / 2;
            const innerX = endCenterX + Math.cos(innerAngle) * starInnerRadius;
            const innerY = endCenterY + Math.sin(innerAngle) * starInnerRadius;

            if (i === 0) {
              ctx.moveTo(outerX, outerY);
            } else {
              ctx.lineTo(outerX, outerY);
            }
            ctx.lineTo(innerX, innerY);
          }
          ctx.closePath();
          ctx.stroke();
          ctx.strokeStyle = '#00ff00';
          ctx.lineWidth = 0.5;
        }
      }
    }

    ctx.restore(); // Restore clipping
  };

  const drawBall = (ctx, x, y) => {
    // Set up clipping to ensure nothing draws outside canvas bounds
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.clip();

    const TILE_HEIGHT = tileDimensionsRef.current.height;
    const ballRadius = Math.max(4, TILE_HEIGHT * 0.6);

    const iso = toIsometric(x, y);

    // Use the same offset calculation as drawGrid to ensure alignment
    const corners = [
      toIsometric(0, 0),
      toIsometric(GRID_SIZE - 1, 0),
      toIsometric(0, GRID_SIZE - 1),
      toIsometric(GRID_SIZE - 1, GRID_SIZE - 1)
    ];

    const minX = Math.min(...corners.map(c => c.x));
    const maxX = Math.max(...corners.map(c => c.x));
    const minY = Math.min(...corners.map(c => c.y));
    const maxY = Math.max(...corners.map(c => c.y));

    const gridWidth = maxX - minX;
    const gridHeight = maxY - minY;

    // Use actual canvas dimensions
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;
    const topSpace = 100; // Space for title

    // Calculate offset to center grid (same as drawGrid)
    const offsetX = (canvasWidth - gridWidth) / 2 - minX;
    const offsetY = topSpace + (canvasHeight - topSpace - 180 - gridHeight) / 2 - minY;

    const centerX = offsetX + iso.x;
    const centerY = offsetY + iso.y;

    // Skip drawing if ball is outside canvas bounds
    if (centerX < -ballRadius || centerX > ctx.canvas.width + ballRadius ||
      centerY < -ballRadius || centerY > ctx.canvas.height + ballRadius) {
      ctx.restore();
      return;
    }

    // Ball shadow
    ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY + ballRadius * 1.5, ballRadius * 0.8, ballRadius * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Main ball
    ctx.fillStyle = '#00ff00';
    ctx.beginPath();
    ctx.arc(centerX, centerY, ballRadius, 0, Math.PI * 2);
    ctx.fill();

    // Highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.ellipse(centerX - 1, centerY - 1, ballRadius * 0.3, ballRadius * 0.2, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore(); // Restore clipping
  };

  const canMoveTo = (x, y) => {
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return false;
    return gameMap[y]?.[x] !== 1;
  };

  const moveBall = (dx, dy) => {
    if (gameState !== 'playing') return;

    const newX = ballPos.x + dx;
    const newY = ballPos.y + dy;

    if (canMoveTo(newX, newY)) {
      setBallPos({ x: newX, y: newY });

      // Play step sound based on tile position
      musicGenerator.playStepSound(newX, newY, tileNoteMap);

      // Increment steps taken (score)
      setScore(prev => prev + 1);

      // Check for yellow trap tile
      if (gameMap[newY][newX] === 2) {
        setGameState('trapped');
        // Play gong sound when player gets trapped
        musicGenerator.playGong();
      }

      // Check for end point (win condition)
      if (newX === endPoint.x && newY === endPoint.y) {
        setGameState('won');
        // Play win sound - high note with reverb
        musicGenerator.playWinSound();
      }
    }
  };

  React.useEffect(() => {
    const handleKeyPress = (e) => {
      switch (e.key.toLowerCase()) {
        // Screen up -> isometric up-left
        case 'arrowup':
        case 'w':
          moveBall(-1, -1);
          break;
        // Screen down -> isometric down-right
        case 'arrowdown':
        case 's':
          moveBall(1, 1);
          break;
        // Screen left -> isometric left (horizontal)
        case 'arrowleft':
        case 'a':
          moveBall(-1, 1);
          break;
        // Screen right -> isometric right (horizontal)
        case 'arrowright':
        case 'd':
          moveBall(1, -1);
          break;
        // Diagonals (relative to screen)
        case 'q': // up-left
          moveBall(-1, 0);
          break;
        case 'e': // up-right
          moveBall(0, -1);
          break;
        case 'z': // down-left
          moveBall(0, 1);
          break;
        case 'c': // down-right
          moveBall(1, 0);
          break;
        case ' ':
          resetGame();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [ballPos, gameState]);

  // Game loop for enemies and bullets
  React.useEffect(() => {
    if (gameState !== 'playing') return;

    const gameLoop = setInterval(() => {
      // Move enemies
      setEnemies(prev => {
        const newEnemies = prev.map(enemy => {
          const newEnemy = { ...enemy };
          newEnemy.moveTimer++;

          // Move enemy every 15 frames (faster)
          if (newEnemy.moveTimer >= 15) {
            newEnemy.moveTimer = 0;
            const directions = [
              { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
              { dx: -1, dy: 0 }, { dx: 1, dy: 0 }
            ];
            const validMoves = directions.filter(dir => {
              const newX = newEnemy.x + dir.dx;
              const newY = newEnemy.y + dir.dy;
              return newX >= 0 && newX < GRID_SIZE &&
                newY >= 0 && newY < GRID_SIZE &&
                gameMap[newY][newX] !== 1;
            });

            if (validMoves.length > 0) {
              const move = validMoves[Math.floor(Math.random() * validMoves.length)];
              newEnemy.x += move.dx;
              newEnemy.y += move.dy;

              // Check if enemy stepped on yellow trap
              if (gameMap[newEnemy.y][newEnemy.x] === 2) {
                return null; // Enemy dies
              }
            }
          }

          // Enemy shoots
          newEnemy.shootTimer--;
          if (newEnemy.shootTimer <= 0) {
            newEnemy.shootTimer = Math.floor(Math.random() * 60) + 60; // Slower shooting

            // Calculate direction to ball
            const dx = ballPos.x - newEnemy.x;
            const dy = ballPos.y - newEnemy.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 0 && distance < 8) { // Reduced shooting range
              const bulletDx = (dx / distance) * 0.15; // Slower bullets
              const bulletDy = (dy / distance) * 0.15;

              // Play drum kick for each shot
              if (musicGeneratorRef.current && musicGeneratorRef.current.playDrumKick) {
                musicGeneratorRef.current.playDrumKick();
              }

              setBullets(prev => [...prev, {
                x: newEnemy.x,
                y: newEnemy.y,
                dx: bulletDx,
                dy: bulletDy
              }]);
            }
          }

          return newEnemy;
        }).filter(enemy => enemy !== null); // Remove dead enemies

        // Spawn new enemy if one died
        if (newEnemies.length < prev.length) {
          let ex, ey;
          do {
            ex = Math.floor(Math.random() * GRID_SIZE);
            ey = Math.floor(Math.random() * GRID_SIZE);
          } while (gameMap[ey][ex] !== 0 || (Math.abs(ex - ballPos.x) < 3 && Math.abs(ey - ballPos.y) < 3));

          newEnemies.push({
            x: ex,
            y: ey,
            moveTimer: 0,
            shootTimer: Math.floor(Math.random() * 60) + 30
          });
        }

        return newEnemies;
      });

      // Move bullets
      setBullets(prev => {
        return prev.map(bullet => {
          const newBullet = {
            ...bullet,
            x: bullet.x + bullet.dx,
            y: bullet.y + bullet.dy
          };

          // Block bullets on walls
          const tileX = Math.floor(newBullet.x);
          const tileY = Math.floor(newBullet.y);
          if (
            tileX < 0 || tileX >= GRID_SIZE ||
            tileY < 0 || tileY >= GRID_SIZE ||
            gameMap?.[tileY]?.[tileX] === 1 // wall tile
          ) {
            return null;
          }

          // Check if bullet hit ball
          const distance = Math.sqrt(
            Math.pow(newBullet.x - ballPos.x, 2) +
            Math.pow(newBullet.y - ballPos.y, 2)
          );

          if (distance < 0.5) {
            setGameState('shot');
            // Play drum splash when player gets shot
            if (musicGeneratorRef.current && musicGeneratorRef.current.playDrumSplash) {
              musicGeneratorRef.current.playDrumSplash();
            }
            return null;
          }

          // Remove bullet if out of bounds
          if (newBullet.x < 0 || newBullet.x >= GRID_SIZE ||
            newBullet.y < 0 || newBullet.y >= GRID_SIZE) {
            return null;
          }

          return newBullet;
        }).filter(bullet => bullet !== null);
      });
    }, 25); // Run game loop every 25ms (faster gameplay)

    return () => clearInterval(gameLoop);
  }, [gameState, ballPos, gameMap, GRID_SIZE]);

  React.useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Use the actual displayed size of the canvas element
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;

      // Calculate tile dimensions to fit the grid in the canvas
      tileDimensionsRef.current = calculateTileDimensions(canvas.width, canvas.height);

      const ctx = canvas.getContext('2d');
      // Clear canvas
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Only draw if we have a valid game map
      if (gameMap.length > 0) {
        drawGrid(ctx);
        drawBall(ctx, ballPos.x, ballPos.y);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    // Handle mobile viewport changes
    const handleViewportChange = () => {
      setTimeout(handleResize, 100); // Delay to account for browser UI animations
    };
    window.addEventListener('resize', handleViewportChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      window.removeEventListener('resize', handleViewportChange);
    };
  }, [ballPos, gameMap, GRID_SIZE, endPoint, enemies, bullets]);

  const resetGame = () => {
    setGameState('playing');
    setGameMap(generateRandomMap());
  };

  // Joystick handlers
  const getJoystickCenter = () => {
    if (!joystickRef.current) return { x: 0, y: 0 };
    const rect = joystickRef.current.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  };

  const getJoystickRadius = () => {
    if (!joystickRef.current) return 0;
    return joystickRef.current.offsetWidth / 2;
  };

  const updateJoystickPosition = (clientX, clientY) => {
    const center = getJoystickCenter();
    const radius = getJoystickRadius();
    const handleRadius = radius * 0.3; // Handle is 30% of boundary radius

    const dx = clientX - center.x;
    const dy = clientY - center.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDistance = radius - handleRadius;
    const angle = Math.atan2(dy, dx);

    // Clamp visual position to boundary (handle stays at edge)
    const clampedDistance = Math.min(distance, maxDistance);
    const newX = Math.cos(angle) * clampedDistance;
    const newY = Math.sin(angle) * clampedDistance;

    setJoystickPos({ x: newX, y: newY });

    // Calculate movement direction (8 directions) - use actual distance, not clamped
    // This ensures direction is maintained even when joystick is at/past boundary
    let moveX = 0;
    let moveY = 0;

    // Use actual distance to calculate direction (not clamped)
    // This way, even when at boundary, direction is maintained
    if (distance > maxDistance * 0.2) { // Dead zone threshold
      const normalizedX = Math.cos(angle);
      const normalizedY = Math.sin(angle);

      // Determine 8-direction movement in screen space, then map to isometric grid
      const absX = Math.abs(normalizedX);
      const absY = Math.abs(normalizedY);

      let screenX = 0;
      let screenY = 0;

      if (absX > absY) {
        screenX = normalizedX > 0 ? 1 : -1;
        if (absY > 0.5) {
          screenY = normalizedY > 0 ? 1 : -1;
        }
      } else {
        screenY = normalizedY > 0 ? 1 : -1;
        if (absX > 0.5) {
          screenX = normalizedX > 0 ? 1 : -1;
        }
      }

      // Map screen directions to isometric grid deltas
      const mapScreenToIso = (sx, sy) => {
        // Screen up/down/left/right and diagonals mapped to iso grid (x,y)
        if (sx === 0 && sy === -1) return { x: -1, y: -1 }; // up
        if (sx === 0 && sy === 1) return { x: 1, y: 1 };   // down
        if (sx === -1 && sy === 0) return { x: -1, y: 1 }; // left
        if (sx === 1 && sy === 0) return { x: 1, y: -1 };  // right
        if (sx === 1 && sy === -1) return { x: 0, y: -1 }; // up-right
        if (sx === -1 && sy === -1) return { x: -1, y: 0 }; // up-left
        if (sx === 1 && sy === 1) return { x: 1, y: 0 };   // down-right
        if (sx === -1 && sy === 1) return { x: 0, y: 1 };  // down-left
        return { x: 0, y: 0 };
      };

      const isoDir = mapScreenToIso(screenX, screenY);
      moveX = isoDir.x;
      moveY = isoDir.y;

      // IMPORTANT: Always update direction when outside dead zone
      // This ensures direction persists even when at boundary
      // The interval will pick this up and keep moving
      joystickDirectionRef.current = { x: moveX, y: moveY };
    } else {
      // Only reset direction when in dead zone
      joystickDirectionRef.current = { x: 0, y: 0 };
    }
  };

  // Continuous movement effect while joystick is active
  React.useEffect(() => {
    if (!isJoystickActive || gameState !== 'playing') {
      return;
    }

    // Continue moving continuously - step by step
    // This interval runs as long as joystick is active, checking direction each time
    const intervalId = setInterval(() => {
      // Always check the current direction from ref (works even at boundary)
      // The ref is updated by updateJoystickPosition, so it always has the latest direction
      const currentDir = joystickDirectionRef.current;

      // Keep moving as long as there's a direction - this continues even when at boundary
      // This will keep calling moveBall at the configured cadence as long as direction is not (0,0)
      if (currentDir.x !== 0 || currentDir.y !== 0) {
        moveBall(currentDir.x, currentDir.y);
      }
    }, MOVE_INTERVAL_MS); // Controlled cadence per step

    return () => clearInterval(intervalId);
  }, [isJoystickActive, gameState, ballPos, gameMap]);

  const handleJoystickStart = (e) => {
    setIsJoystickActive(true);
    const clientX = e?.touches ? e.touches[0]?.clientX : e?.clientX;
    const clientY = e?.touches ? e.touches[0]?.clientY : e?.clientY;
    if (clientX !== undefined && clientY !== undefined) {
      updateJoystickPosition(clientX, clientY);
    }
  };

  const handleJoystickMove = (e) => {
    if (!isJoystickActive) return;
    const clientX = e?.touches ? e.touches[0]?.clientX : e?.clientX;
    const clientY = e?.touches ? e.touches[0]?.clientY : e?.clientY;
    if (clientX !== undefined && clientY !== undefined) {
      updateJoystickPosition(clientX, clientY);
    }
  };

  const handleJoystickEnd = () => {
    setIsJoystickActive(false);
    setJoystickPos({ x: 0, y: 0 });
    joystickDirectionRef.current = { x: 0, y: 0 };
  };

  // Add global event listeners for joystick
  React.useEffect(() => {
    if (!isJoystickActive) return;

    const handleMove = (e) => {
      handleJoystickMove(e);
    };

    const handleEnd = (e) => {
      handleJoystickEnd(e);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isJoystickActive]);

  return React.createElement(
    'div',
    {
      ref: canvasContainerRef,
      style: {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        height: '-webkit-fill-available', // iOS Safari
        overflow: 'hidden',
        touchAction: 'none'
      }
    },
    React.createElement(
      'canvas',
      {
        ref: canvasRef,
        style: {
          backgroundColor: '#000000',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          display: 'block',
          touchAction: 'none',
          overflow: 'hidden'
        }
      }
    ),
    // Sound toggle button
    React.createElement(
      'button',
      {
        onClick: toggleSound,
        style: {
          position: 'fixed',
          top: getViewportSize().width < 768 ? '15px' : '20px',
          right: getViewportSize().width < 768 ? '15px' : '20px',
          width: getViewportSize().width < 768 ? '40px' : '48px',
          height: getViewportSize().width < 768 ? '40px' : '48px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          border: '2px solid #00ff00',
          borderRadius: '50%',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 20,
          padding: 0,
          touchAction: 'manipulation',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
          outline: 'none',
          boxShadow: '0 0 10px rgba(0, 255, 0, 0.5)',
          transition: 'all 0.2s ease'
        },
        onMouseEnter: (e) => {
          e.target.style.boxShadow = '0 0 15px rgba(0, 255, 0, 0.8)';
          e.target.style.transform = 'scale(1.1)';
        },
        onMouseLeave: (e) => {
          e.target.style.boxShadow = '0 0 10px rgba(0, 255, 0, 0.5)';
          e.target.style.transform = 'scale(1)';
        }
      },
      soundEnabled
        ? React.createElement(
            'svg',
            {
              width: getViewportSize().width < 768 ? '24' : '28',
              height: getViewportSize().width < 768 ? '24' : '28',
              viewBox: '0 0 24 24',
              fill: 'none',
              stroke: '#00ff00',
              strokeWidth: '2',
              strokeLinecap: 'round',
              strokeLinejoin: 'round'
            },
            React.createElement('path', { d: 'M11 5L6 9H2v6h4l5 4V5z' }),
            React.createElement('path', { d: 'M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07' })
          )
        : React.createElement(
            'svg',
            {
              width: getViewportSize().width < 768 ? '24' : '28',
              height: getViewportSize().width < 768 ? '24' : '28',
              viewBox: '0 0 24 24',
              fill: 'none',
              stroke: '#00ff00',
              strokeWidth: '2',
              strokeLinecap: 'round',
              strokeLinejoin: 'round'
            },
            React.createElement('path', { d: 'M11 5L6 9H2v6h4l5 4V5z' }),
            React.createElement('line', { x1: '23', y1: '9', x2: '17', y2: '15' }),
            React.createElement('line', { x1: '17', y1: '9', x2: '23', y2: '15' })
          )
    ),
    // Joystick control
    (() => {
      const isMobile = getViewportSize().width < 768;
      const joystickStyle = {
        position: 'fixed',
        bottom: isMobile ? '80px' : '30px',
        width: '120px',
        height: '120px',
        borderRadius: '50%',
        border: '2px solid #00ff00',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20,
        cursor: 'pointer',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        outline: 'none'
      };

      if (isMobile) {
        joystickStyle.left = '50%';
        joystickStyle.transform = 'translateX(-50%)';
      } else {
        joystickStyle.right = '30px';
      }

      return React.createElement(
        'div',
        {
          ref: joystickRef,
          onMouseDown: handleJoystickStart,
          onTouchStart: handleJoystickStart,
          style: joystickStyle
        },
        React.createElement(
          'div',
          {
            ref: joystickHandleRef,
            style: {
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: '#00ff00',
              border: '1px solid #00ff00',
              position: 'relative',
              transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`,
              transition: isJoystickActive ? 'none' : 'transform 0.2s ease-out',
              boxShadow: '0 0 10px rgba(0, 255, 0, 0.5)',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              WebkitTapHighlightColor: 'transparent',
              outline: 'none'
            }
          }
        )
      );
    })(),
    // Score display during gameplay - at the very bottom
    gameState === 'playing' && React.createElement(
      'div',
      {
        style: {
          position: 'fixed',
          bottom: '5px', // Very bottom of screen
          left: '50%',
          transform: 'translateX(-50%)',
          color: '#00ff00',
          fontFamily: '"Courier New", monospace',
          fontSize: getViewportSize().width < 768 ? '0.85rem' : '1rem',
          fontWeight: 'bold',
          textShadow: '0 0 10px #00ff00',
          zIndex: 15,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: '6px 12px',
          borderRadius: '5px',
          border: '1px solid #00ff00'
        }
      },
      `Steps Done: ${score}`
    ),

    // Game modal overlay
    (gameState !== 'playing') && React.createElement(
      'div',
      {
        style: {
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 255, 0, 0.9)',
          zIndex: 100,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }
      },
      React.createElement(
        'div',
        {
          style: {
            backgroundColor: getViewportSize().width < 768 ? 'rgba(0, 0, 0, 0.1)' : '#00ff00',
            color: '#000000',
            padding: '0',
            margin: '0',
            textAlign: 'center',
            fontFamily: '"Courier New", monospace',
            fontSize: getViewportSize().width < 768 ? '2rem' : '3rem',
            fontWeight: 'bold',
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'absolute',
            top: '0',
            left: '0',
            right: '0',
            bottom: '0',
            zIndex: 100
          }
        },
        // Game state title (shown on all viewports)
        React.createElement(
          'div',
          {
            style: {
              fontSize: getViewportSize().width < 768 ? '2.4rem' : '3rem',
              marginTop: getViewportSize().width < 768 ? '40px' : '60px',
              color: '#000000',
              textShadow: '0 0 10px rgba(0, 255, 0, 0.5)'
            }
          },
          `${gameState === 'trapped'
            ? 'TRAPPED!'
            : gameState === 'won'
              ? 'YOU WON!'
              : gameState === 'lost'
                ? 'OUT OF STEPS!'
                : gameState === 'shot'
                  ? 'SHOT!'
                  : 'GAME OVER'}`
        ),
        React.createElement(
          'div',
          {
            style: {
              fontSize: getViewportSize().width < 768 ? '1rem' : '1.2rem',
              marginTop: getViewportSize().width < 768 ? '20vh' : '30px',
              cursor: 'pointer',
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              color: '#00ff00',
              padding: '15px 25px',
              borderRadius: '5px',
              border: '2px solid #00ff00'
            },
            onClick: resetGame
          },
          `Steps Done: ${score}`
        ),
        React.createElement(
          'div',
          {
            style: {
              fontSize: getViewportSize().width < 768 ? '0.9rem' : '1rem',
              marginTop: getViewportSize().width < 768 ? '10vh' : '20px',
              cursor: 'pointer',
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              color: '#00ff00',
              padding: '10px 20px',
              borderRadius: '5px',
              border: '1px solid #00ff00'
            },
            onClick: resetGame
          },
          'Press SPACE or Click to Play Again'
        )
      )
    ),


  );
};

const App = () => {
  return React.createElement(
    'div',
    {
      style: {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        height: '-webkit-fill-available', // iOS Safari
        backgroundColor: '#000000',
        overflow: 'hidden',
        touchAction: 'none'
      }
    },
    React.createElement(
      'div',
      {
        style: {
          position: 'absolute',
          top: getViewportSize().width < 768 ? '20px' : '30px',
          left: '50%',
          transform: 'translateX(-50%)',
          color: '#00ff00',
          fontFamily: '"Courier New", monospace',
          fontSize: getViewportSize().width < 768 ? '1.1rem' : '1.5rem', // Smaller on mobile
          fontWeight: 'bold',
          textShadow: '0 0 10px #00ff00',
          zIndex: 10,
          whiteSpace: 'nowrap'
        }
      },
      'survive:'
    ),
    React.createElement(
      'div',
      {
        style: {
          position: 'absolute',
          top: getViewportSize().width < 768 ? '50px' : '70px',
          left: '50%',
          transform: 'translateX(-50%)',
          color: '#00ff00',
          fontFamily: '"Courier New", monospace',
          fontSize: getViewportSize().width < 768 ? '0.7rem' : '0.8rem',
          textAlign: 'center',
          zIndex: 10,
          padding: getViewportSize().width < 768 ? '0 10px' : '0',
          maxWidth: '90%',
          lineHeight: '1.2'
        }
      },
      getViewportSize().width < 768
        ? 'Reach YELLOW star! Avoid RED enemies!'
        : 'Navigate to the YELLOW star! Avoid RED enemies! Use WASD or Arrow Keys'
    ),

    React.createElement(IsometricGame),
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));