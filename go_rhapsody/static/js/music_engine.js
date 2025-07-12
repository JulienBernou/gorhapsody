// music_engine.js

// --- Audio Context Initialization ---
let audioContextStarted = false;

function startAudioContext() {
    if (!audioContextStarted) {
        Tone.start().then(() => {
            console.log("AudioContext started!");
            audioContextStarted = true;
            Tone.Transport.start();
        }).catch(e => console.error("Error starting AudioContext:", e));
    }
}

document.documentElement.addEventListener('mousedown', startAudioContext);
document.documentElement.addEventListener('keydown', startAudioContext);
document.documentElement.addEventListener('touchstart', startAudioContext);

// --- Instruments ---
const marimbaSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sine" },
    envelope: { attack: 0.005, decay: 0.3, sustain: 0.01, release: 0.8 },
    filter: { type: "lowpass", frequency: 3200, rolloff: -24 },
    volume: -10
}).toDestination();

const membraneSynth = new Tone.MembraneSynth({
    pitchDecay: 0.06,
    octaves: 1.0,
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.0, attackCurve: 'exponential' },
    volume: -7
}).toDestination();

const gentleSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "triangle" },
    envelope: { attack: 0.002, decay: 0.2, sustain: 0.005, release: 0.6 },
    filter: { type: "lowpass", frequency: 2800, rolloff: -12 },
    volume: -12
}).toDestination();

// --- Effects ---
const masterReverb = new Tone.Reverb({ decay: 4.5, preDelay: 0.08, wet: 0.5 }).toDestination();
marimbaSynth.connect(masterReverb);
membraneSynth.connect(masterReverb);
gentleSynth.connect(masterReverb);

// --- Musical Scales and Notes ---
const zenNotes = ["C3", "D3", "E3", "G3", "A3", "C4", "D4", "E4", "G4", "A4", "C5", "D5", "E5"];
const tensionNotes = ["C#4", "Eb4", "F#4", "A#4", "B4"];

// --- State for Pitch Tracking ---
const PITCH_INCREMENT_SEMITONES = 2;
const MAX_PITCH_OFFSET = 12;
const BLACK_BASE_ZEN_INDEX = 0;
const WHITE_BASE_ZEN_INDEX = 6;
const pitchState = {
    'B': { consecutiveDist1: 0, currentPitchOffset: 0, currentZenNoteIndex: BLACK_BASE_ZEN_INDEX, lastPlayedNote: null },
    'W': { consecutiveDist1: 0, currentPitchOffset: 0, currentZenNoteIndex: WHITE_BASE_ZEN_INDEX, lastPlayedNote: null }
};

function getNoteFromZenScale(playerColor, pitchOffsetSemitones) {
    const playerState = pitchState[playerColor];
    const baseMidiNote = Tone.Frequency(zenNotes[playerState.currentZenNoteIndex]).toMidi();
    const finalMidiNote = baseMidiNote + pitchOffsetSemitones;
    return Tone.Frequency(finalMidiNote, "midi").toNote();
}

function playMusicalCue(report) {
    if (!audioContextStarted || !report) return;

    let instrument = gentleSynth;
    let baseVolume = -15;
    let duration = "8n";
    let noteToPlay = null;

    const player = report.player;
    const isPlayerMove = (player === 'B' || player === 'W');

    if (report.type === 'Pass' || report.type === 'ResetGame' || report.type === 'FinishedGame') {
        Object.assign(pitchState['B'], { consecutiveDist1: 0, currentPitchOffset: 0, currentZenNoteIndex: BLACK_BASE_ZEN_INDEX, lastPlayedNote: null });
        Object.assign(pitchState['W'], { consecutiveDist1: 0, currentPitchOffset: 0, currentZenNoteIndex: WHITE_BASE_ZEN_INDEX, lastPlayedNote: null });
    } else if (isPlayerMove) {
        const opponent = player === 'B' ? 'W' : 'B';
        if (pitchState[opponent].lastPlayedNote !== null) {
            Object.assign(pitchState[opponent], { consecutiveDist1: 0, currentPitchOffset: 0, currentZenNoteIndex: opponent === 'B' ? BLACK_BASE_ZEN_INDEX : WHITE_BASE_ZEN_INDEX, lastPlayedNote: null });
        }
    }

    let currentPitchOffsetFromDist1 = 0;
    if (isPlayerMove) {
        let playerState = pitchState[player];
        const distance = report.distance_from_previous_friendly_stone;
        if (distance === 1.0) {
            playerState.consecutiveDist1++;
            playerState.currentPitchOffset = Math.min(playerState.currentPitchOffset + PITCH_INCREMENT_SEMITONES, MAX_PITCH_OFFSET);
        } else {
            playerState.consecutiveDist1 = 0;
            playerState.currentPitchOffset = 0;
        }
        currentPitchOffsetFromDist1 = playerState.currentPitchOffset;
    }

    switch (report.musical_intensity) {
        case 'percussive_hit':
            instrument = membraneSynth;
            noteToPlay = "C3";
            baseVolume = -3;
            duration = "0.4s";
            break;
        case 'high_tension':
            instrument = gentleSynth;
            const atariNote1 = tensionNotes[Math.floor(Math.random() * tensionNotes.length)];
            const atariNote2 = Tone.Frequency(atariNote1).transpose(7).toNote();
            baseVolume = -6;
            instrument.triggerAttackRelease(atariNote1, "8n", Tone.now());
            Tone.Transport.scheduleOnce(() => instrument.triggerAttackRelease(atariNote2, "16n"), Tone.now() + Tone.Time("16n").toSeconds());
            return;
        case 'rising_tension':
            instrument = gentleSynth;
            const threatNote1 = zenNotes[Math.floor(Math.random() * zenNotes.length)];
            const threatNote2 = Tone.Frequency(threatNote1).transpose(3).toNote();
            baseVolume = -8;
            instrument.triggerAttackRelease(threatNote1, "16n", Tone.now());
            Tone.Transport.scheduleOnce(() => instrument.triggerAttackRelease(threatNote2, "16n"), Tone.now() + Tone.Time("32n").toSeconds());
            return;
        case 'star_point_chime':
            instrument = marimbaSynth;
            const starPointBase = player === 'B' ? "C4" : "G4";
            noteToPlay = [starPointBase, Tone.Frequency(starPointBase).transpose(7).toNote(), Tone.Frequency(starPointBase).transpose(12).toNote()];
            baseVolume = -9;
            duration = "2n";
            break;
        case 'three_three_drone':
            instrument = gentleSynth;
            noteToPlay = player === 'B' ? "C2" : "G2";
            baseVolume = -10;
            duration = "1n";
            break;
        case 'three_four_motif':
            instrument = marimbaSynth;
            const threeFourBase = player === 'B' ? "E4" : "A4";
            instrument.triggerAttackRelease(threeFourBase, "8n", Tone.now());
            Tone.Transport.scheduleOnce(() => instrument.triggerAttackRelease(Tone.Frequency(threeFourBase).transpose(-3).toNote(), "8n"), Tone.now() + Tone.Time("16n").toSeconds());
            return;
        case 'opening_theme':
            instrument = gentleSynth;
            noteToPlay = getNoteFromZenScale(player, 0);
            baseVolume = -12;
            duration = "4n";
            break;
        case 'corner_secure':
            instrument = marimbaSynth;
            const enclosureBase = getNoteFromZenScale(player, 0);
            noteToPlay = [enclosureBase, Tone.Frequency(enclosureBase).transpose(4).toNote()];
            baseVolume = -11;
            duration = "4n";
            break;
        // --- NEW: Sound for large enclosures ---
        case 'large_enclosure_chime':
            instrument = marimbaSynth;
            const largeEnclosureBase = getNoteFromZenScale(player, 0);
            const resolvingNote = Tone.Frequency(largeEnclosureBase).transpose(7).toNote(); // Perfect 5th for resolution
            baseVolume = -10;
            // Play the two notes in sequence for a "satisfying" feel
            instrument.triggerAttackRelease(largeEnclosureBase, "8n", Tone.now());
            Tone.Transport.scheduleOnce(() => {
                instrument.triggerAttackRelease(resolvingNote, "4n", Tone.now());
            }, Tone.now() + Tone.Time("8n").toSeconds() * 0.8); // Schedule the second note just after the first
            return; // Return because we manually scheduled the sound
        case 'close_engagement':
            instrument = gentleSynth;
            noteToPlay = getNoteFromZenScale(player, 0);
            baseVolume = -5;
            duration = "8n";
            break;
        case 'background_pulse':
            baseVolume = -16;
            duration = "8n";
            instrument = player === 'B' ? gentleSynth : marimbaSynth;
            noteToPlay = getNoteFromZenScale(player, currentPitchOffsetFromDist1);
            break;
        case 'rest':
             if (report.type === 'ResetGame') marimbaSynth.triggerAttackRelease(["C3", "E3", "G3", "C4"], "2s", Tone.now(), 0.8);
             if (report.type === 'FinishedGame') marimbaSynth.triggerAttackRelease(["C4", "A3", "F3", "D3"], "2s", Tone.now(), 0.8);
             return;
        default:
            console.warn(`Unhandled musical intensity: ${report.musical_intensity}. Playing default sound.`);
            instrument = gentleSynth;
            noteToPlay = "C4";
            baseVolume = -18;
            duration = "8n";
            break;
    }

    if (noteToPlay && typeof baseVolume === 'number') {
        instrument.volume.rampTo(baseVolume, 0.01);
        instrument.triggerAttackRelease(noteToPlay, duration);
        if (isPlayerMove) {
            pitchState[player].lastPlayedNote = Array.isArray(noteToPlay) ? noteToPlay[0] : noteToPlay;
            pitchState[player].currentZenNoteIndex = (pitchState[player].currentZenNoteIndex + 1) % zenNotes.length;
        }
    }
}