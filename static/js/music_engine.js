// music_engine.js
// Ensure AudioContext starts on user interaction
document.documentElement.addEventListener('mousedown', () => {
    if (Tone.context.state !== 'running') {
        Tone.context.resume();
        console.log("AudioContext resumed!");
    }
});

// Define your Tone.js instruments and effects here
// Let's start with a few basic synths
const synthLead = new Tone.Synth({
    oscillator: { type: "sawtooth" },
    envelope: {
        attack: 0.05,
        decay: 0.3,
        sustain: 0.4,
        release: 0.8,
    }
}).toDestination();

const synthPad = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sine" },
    envelope: {
        attack: 1,
        decay: 0.5,
        sustain: 0.5,
        release: 1,
    }
}).toDestination();

const drumKick = new Tone.MembraneSynth({
    pitchDecay: 0.05,
    octaves: 10,
    envelope: {
        attack: 0.001,
        decay: 0.4,
        sustain: 0.01,
        release: 0.5,
    },
    oscillator: { type: "sine" }
}).toDestination();

const drumSnare = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: {
        attack: 0.005,
        decay: 0.1,
        sustain: 0,
        release: 0.1,
    }
}).chain(new Tone.Filter(8000, "lowpass"), Tone.Destination);


// Main function to interpret Go analysis and play music
function playMusicalCue(analysisReport) {
    console.log("Musical Cue for:", analysisReport);

    const player = analysisReport.player; // 'B' or 'W'
    const coords = analysisReport.coords; // [r, c] or null
    const type = analysisReport.type; // 'Normal Move', 'Capture', 'Pass', 'Illegal Move'
    const musicalIntensity = analysisReport.musical_intensity || 'background_pulse'; // Default if not set

    let basePitch = player === 'B' ? Tone.Midi('C4').toFrequency() : Tone.Midi('G4').toFrequency();
    if (coords) {
        // Adjust pitch based on move location (simple heuristic)
        basePitch = Tone.Midi(basePitch + (coords[0] % 7) + (coords[1] % 5)).toFrequency();
    }

    // --- Musical Mappings ---

    switch (musicalIntensity) {
        case 'percussive_hit':
            console.log("  - Musical: Percussive hit (Capture)");
            drumKick.triggerAttackRelease("C2", "8n");
            drumSnare.triggerAttackRelease("8n", "+0.05");
            synthLead.triggerAttackRelease(Tone.Midi(basePitch + 7).toFrequency(), '8n', Tone.now(), 0.9); // Triumphant note
            break;
        case 'high_tension':
            console.log("  - Musical: High tension (Atari/Self-Atari)");
            synthLead.triggerAttackRelease(Tone.Midi(basePitch + 5).toFrequency(), '16n', Tone.now(), 0.8);
            synthLead.triggerAttackRelease(Tone.Midi(basePitch + 8).toFrequency(), '16n', Tone.now() + 0.15, 0.8);
            synthPad.triggerAttackRelease([Tone.Midi(basePitch - 12).toFrequency(), Tone.Midi(basePitch).toFrequency()], '4n', Tone.now(), 0.6); // Dissonant low pad
            break;
        case 'background_pulse':
            console.log("  - Musical: Background pulse (Normal Move)");
            synthPad.triggerAttackRelease(Tone.Midi(basePitch - 12).toFrequency(), '8n', Tone.now(), 0.4); // Subtle low pulse
            break;
        default:
            // Fallback for types not explicitly mapped or unknown intensity
            if (type === 'Pass') {
                console.log("  - Musical: Ambient fade (Pass)");
                synthPad.triggerAttackRelease(['C3', 'E3', 'G3'], '2n', Tone.now(), 0.3); // Ambient chord
            } else if (type === 'Illegal Move') {
                console.log("  - Musical: Harsh noise (Illegal Move)");
                new Tone.NoiseSynth().toDestination().triggerAttackRelease('8n', Tone.now(), 1.0);
            } else {
                console.log("  - Musical: Default subtle sound.");
                synthLead.triggerAttackRelease(Tone.Midi(basePitch).toFrequency(), '16n', Tone.now(), 0.6);
            }
            break;
    }
}