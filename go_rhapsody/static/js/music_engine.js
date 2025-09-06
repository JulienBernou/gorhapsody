// music_engine.js

// --- Audio Context Initialization ---
let audioContextStarted = false;
function startAudioContext() {
    if (audioContextStarted) return;
    Tone.start().then(() => {
        console.log("AudioContext started!");
        audioContextStarted = true;
        Tone.Transport.start();
    }).catch(e => console.error("Error starting AudioContext:", e));
}
document.documentElement.addEventListener('mousedown', startAudioContext);
document.documentElement.addEventListener('keydown', startAudioContext);
document.documentElement.addEventListener('touchstart', startAudioContext);

// --- Instruments (UPDATED) ---
const instruments = {
    marimbaSynth: new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sine" },
        envelope: { attack: 0.005, decay: 0.3, sustain: 0.01, release: 0.8 },
        volume: -10
    }).toDestination(),
    gentleSynth: new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.002, decay: 0.2, sustain: 0.005, release: 0.6 },
        volume: -12
    }).toDestination(),
    membraneSynth: new Tone.MembraneSynth({
        pitchDecay: 0.06, octaves: 1.0,
        envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.0 },
        volume: -7
    }).toDestination(),
    // --- NEW INSTRUMENTS ---
    piano: new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "square" },
        envelope: { attack: 0.01, decay: 0.6, sustain: 0.1, release: 1.2 },
        volume: -10
    }).toDestination(),
    kalimba: new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.5, sustain: 0.01, release: 1.0 },
        volume: -8
    }).toDestination(),
    pluckSynth: new Tone.PluckSynth({
        attackNoise: 1,
        dampening: 4000,
        resonance: 0.7,
        release: 1,
        volume: -6
    }).toDestination(),
    // --- NEW INSTRUMENTS ---
    fmSynth: new Tone.FMSynth({
        harmonicity: 3,
        modulationIndex: 10,
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 1 },
        modulation: { type: 'square' },
        volume: -8
    }).toDestination(),
    duoSynth: new Tone.DuoSynth({
        harmonicity: 1.5,
        voice0: { oscillator: { type: 'sawtooth' }, envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 1 } },
        voice1: { oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 1 } },
        volume: -10
    }).toDestination(),
    amSynth: new Tone.AMSynth({
        harmonicity: 2.5,
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 1 },
        modulation: { type: 'triangle' },
        volume: -8
    }).toDestination(),
    monoSynth: new Tone.MonoSynth({
        oscillator: { type: 'square' },
        envelope: { attack: 0.01, decay: 0.3, sustain: 0.2, release: 1 },
        filterEnvelope: { attack: 0.001, decay: 0.2, sustain: 0.5, release: 2, baseFrequency: 200, octaves: 2.6 },
        volume: -7
    }).toDestination(),
    metalSynth: new Tone.MetalSynth({
        frequency: 200,
        envelope: { attack: 0.001, decay: 1.4, release: 0.2 },
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 4000,
        volume: -12
    }).toDestination(),
};


// --- Effects ---
const masterReverb = new Tone.Reverb({ decay: 4.5, preDelay: 0.08, wet: 0.5 }).toDestination();
Object.values(instruments).forEach(instr => instr.connect(masterReverb));

// --- Musical Scales and State ---
const scaleLibrary = {
    zen: ["C3", "D3", "E3", "G3", "A3", "C4", "D4", "E4", "G4", "A4", "C5", "D5", "E5"],
    major: ["C3", "D3", "E3", "F3", "G3", "A3", "B3", "C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"],
    minor_pentatonic: ["C3", "Eb3", "F3", "G3", "Bb3", "C4", "Eb4", "F4", "G4", "Bb4", "C5"],
    natural_minor: ["C3", "D3", "Eb3", "F3", "G3", "Ab3", "Bb3", "C4", "D4", "Eb4", "F4", "G4", "Ab4", "Bb4", "C5"],
    dorian: ["C3", "D3", "Eb3", "F3", "G3", "A3", "Bb3", "C4", "D4", "Eb4", "F4", "G4", "A4", "Bb4", "C5"],
    mixolydian: ["C3", "D3", "E3", "F3", "G3", "A3", "Bb3", "C4", "D4", "E4", "F4", "G4", "A4", "Bb4", "C5"],
    harmonic_minor: ["C3", "D3", "Eb3", "F3", "G3", "Ab3", "B3", "C4", "D4", "Eb4", "F4", "G4", "Ab4", "B4", "C5"],
    whole_tone: ["C3", "D3", "E3", "F#3", "G#3", "A#3", "C4", "D4", "E4", "F#4", "G#4", "A#4", "C5"]
};
let currentScaleName = 'zen';
function getCurrentScaleNotes() {
    return scaleLibrary[currentScaleName] || scaleLibrary.zen;
}
function setCurrentScale(name) {
    if (!scaleLibrary[name]) return;
    currentScaleName = name;
    // Reset melodic indices to safe positions within the new scale
    pitchState['B'].currentZenNoteIndex = 0;
    const len = getCurrentScaleNotes().length;
    pitchState['W'].currentZenNoteIndex = Math.min(6, Math.max(0, len - 1));
}
// Expose to UI
window.setMusicScale = setCurrentScale;
window.getMusicScale = () => currentScaleName;
const tensionNotes = ["C#4", "Eb4", "F#4", "A#4", "B4"];
const pitchState = {
    'B': { currentZenNoteIndex: 0 },
    'W': { currentZenNoteIndex: 6 }
};

// --- Utilities: stop all audio ---
function stopAllNotesAndSchedules() {
    try {
        // Release any sustained notes across all instruments
        Object.values(instruments).forEach(instr => {
            if (typeof instr.releaseAll === 'function') {
                instr.releaseAll();
            }
            // Fallback for mono synths
            if (typeof instr.triggerRelease === 'function') {
                try { instr.triggerRelease(); } catch (_) {}
            }
        });
        // Cancel any scheduled events to avoid late triggers
        if (Tone.Transport) {
            Tone.Transport.cancel();
        }
    } catch (e) {
        console.warn('Failed to fully stop audio:', e);
    }
}

function getNoteFromZenScale(playerColor) {
    const playerState = pitchState[playerColor];
    const notes = getCurrentScaleNotes();
    return notes[playerState.currentZenNoteIndex % notes.length];
}


/**
 * Plays a musical cue based on a dynamic configuration object.
 * @param {object} report - The analysis report for the current move.
 * @param {object} controls - The master configuration object from the UI.
 */
function playMusicalCue(report, controls) {
    if (!audioContextStarted || !report || !controls) return;

    // Handle game state changes first
    if (report.type === 'ResetGame' || report.type === 'FinishedGame') {
        // Ensure no lingering sustain or scheduled notes
        stopAllNotesAndSchedules();
        pitchState['B'].currentZenNoteIndex = 0;
        pitchState['W'].currentZenNoteIndex = 6;
        const chord = report.type === 'ResetGame' ? ["C3", "E3", "G3"] : ["C4", "A3", "F3"];
        instruments.marimbaSynth.triggerAttackRelease(chord, "2s", Tone.now(), 0.8);
        return;
    }
    if (report.type === 'Pass') return;

    // Find the correct configuration key for the move
    let moveKey = report.type;
    if (moveKey.includes('Enclosure') && moveKey !== 'Corner Enclosure') {
        moveKey = 'Large Enclosure';
    }

    const config = controls[moveKey];
    if (!config) {
        console.warn(`No music config found for move type: ${report.type}`);
        return;
    }

    // Determine the instrument
    let instrument = instruments[config.instrument];
    if (config.instrument === 'dynamic') { // Special case for Normal Move
        instrument = report.player === 'B' ? instruments.gentleSynth : instruments.marimbaSynth;
    }
    if (!instrument) {
        console.warn(`Invalid instrument specified: ${config.instrument}`);
        return;
    }

    // Determine the note(s) to play
    let noteToPlay;
    const player = report.player;
    const baseMelodicNote = getNoteFromZenScale(player);

    switch (config.note) {
        case 'melodic':
            noteToPlay = baseMelodicNote;
            break;
        case 'melodic_accent': // For Contact Move
            noteToPlay = baseMelodicNote;
            break;
        case 'tension_chord':
            noteToPlay = [tensionNotes[Math.floor(Math.random() * tensionNotes.length)], Tone.Frequency(tensionNotes[0]).transpose(7).toNote()];
            break;
        case 'tension_dyad':
            noteToPlay = [baseMelodicNote, Tone.Frequency(baseMelodicNote).transpose(3).toNote()];
            break;
        case 'stable_chord': // For Small Enclosure
            noteToPlay = [baseMelodicNote, Tone.Frequency(baseMelodicNote).transpose(4).toNote()];
            break;
        case 'resolving_dyad': // For Large Enclosure
            const resolvingNote = Tone.Frequency(baseMelodicNote).transpose(7).toNote();
            instrument.volume.rampTo(config.volume, 0.01);
            instrument.triggerAttackRelease(baseMelodicNote, config.duration, Tone.now());
            Tone.Transport.scheduleOnce(() => {
                instrument.triggerAttackRelease(resolvingNote, "4n", Tone.now());
            }, Tone.now() + Tone.Time(config.duration).toSeconds() * 0.8);
            const len1 = getCurrentScaleNotes().length;
            pitchState[player].currentZenNoteIndex = (pitchState[player].currentZenNoteIndex + 1) % len1;
            return; // Manual scheduling, so we exit here
        default: // Fixed note (e.g., 'C3', 'E4')
            noteToPlay = config.note;
            break;
    }

    // Play the sound
    if (noteToPlay) {
        instrument.volume.rampTo(config.volume, 0.01);
        instrument.triggerAttackRelease(noteToPlay, config.duration);

        // Advance the melodic index for the next move
        const len2 = getCurrentScaleNotes().length;
        pitchState[player].currentZenNoteIndex = (pitchState[player].currentZenNoteIndex + 1) % len2;
    }
}