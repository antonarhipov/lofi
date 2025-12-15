import { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';

const CHORD_LIBRARY = {
  'Cmaj7': ['C4', 'E4', 'G4', 'B4'],
  'Dm7': ['D4', 'F4', 'A4', 'C5'],
  'Em7': ['E4', 'G4', 'B4', 'D5'],
  'Fmaj7': ['F4', 'A4', 'C5', 'E5'],
  'G7': ['G3', 'B3', 'D4', 'F4'],
  'Am7': ['A3', 'C4', 'E4', 'G4'],
  'Bm7b5': ['B3', 'D4', 'F4', 'A4'],
  'Dm9': ['D4', 'F4', 'A4', 'C5', 'E5'],
  'Gm7': ['G3', 'Bb3', 'D4', 'F4'],
  'Cm7': ['C4', 'Eb4', 'G4', 'Bb4'],
  'Fm7': ['F3', 'Ab3', 'C4', 'Eb4'],
  'Bb7': ['Bb3', 'D4', 'F4', 'Ab4'],
  'Ebmaj7': ['Eb4', 'G4', 'Bb4', 'D5'],
  'Abmaj7': ['Ab3', 'C4', 'Eb4', 'G4'],
};

const PRESETS = {
  'Classic Lo-Fi': ['Dm7', 'G7', 'Cmaj7', 'Am7'],
  'Jazzy Nights': ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7'],
  'Rainy Day': ['Am7', 'Fmaj7', 'Cmaj7', 'G7'],
  'Sunset Vibes': ['Dm9', 'G7', 'Cmaj7', 'Fmaj7'],
  'Melancholy': ['Cm7', 'Fm7', 'Bb7', 'Ebmaj7'],
  'Late Night': ['Am7', 'Dm7', 'G7', 'Cmaj7'],
};

function Slider({ label, value, onChange, min, max, step = 1, unit = '' }) {
  return (
    <div className="mb-3">
      <label className="block text-amber-200 text-xs mb-1">
        {label}: {value}{unit}
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-amber-900 rounded-lg appearance-none cursor-pointer accent-amber-500"
      />
    </div>
  );
}

export default function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [bpm, setBpm] = useState(75);
  const [filterFreq, setFilterFreq] = useState(800);
  const [vinylVol, setVinylVol] = useState(-20);
  const [swing, setSwing] = useState(0.5);
  const [drumsVol, setDrumsVol] = useState(-6);
  const [chordsVol, setChordsVol] = useState(-12);
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [currentChordIdx, setCurrentChordIdx] = useState(-1);
  const [progression, setProgression] = useState(['Dm7', 'G7', 'Cmaj7', 'Am7']);
  const [selectedPreset, setSelectedPreset] = useState('Classic Lo-Fi');
  const [editingSlot, setEditingSlot] = useState(null);

  const synthsRef = useRef(null);
  const sequencesRef = useRef(null);
  const progressionRef = useRef(progression);

  useEffect(() => {
    progressionRef.current = progression;
  }, [progression]);

  useEffect(() => {
    const masterFilter = new Tone.Filter(filterFreq, 'lowpass').toDestination();
    const masterReverb = new Tone.Reverb({ decay: 2, wet: 0.3 }).connect(masterFilter);

    const vinylNoise = new Tone.Noise('brown').toDestination();
    vinylNoise.volume.value = vinylVol;
    const vinylFilter = new Tone.Filter(2000, 'bandpass');
    vinylNoise.disconnect();
    vinylNoise.connect(vinylFilter);
    vinylFilter.toDestination();

    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 4,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 0.4 }
    }).connect(masterReverb);

    const snare = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 }
    }).connect(masterReverb);
    snare.volume.value = -10;

    const hihat = new Tone.MetalSynth({
      frequency: 250,
      envelope: { attack: 0.001, decay: 0.05, release: 0.01 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5
    }).connect(masterReverb);
    hihat.volume.value = -20;

    const chordSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.1, decay: 0.3, sustain: 0.4, release: 1.5 }
    }).connect(masterReverb);
    chordSynth.volume.value = chordsVol;

    synthsRef.current = {
      masterFilter,
      masterReverb,
      vinylNoise,
      vinylFilter,
      kick,
      snare,
      hihat,
      chordSynth
    };

    const kickPattern = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
    const snarePattern = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0];
    const hihatPattern = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0];

    const drumSeq = new Tone.Sequence(
      (time, beat) => {
        setCurrentBeat(beat);
        if (kickPattern[beat]) kick.triggerAttackRelease('C1', '8n', time);
        if (snarePattern[beat]) snare.triggerAttackRelease('8n', time);
        if (hihatPattern[beat]) hihat.triggerAttackRelease('C6', '16n', time);
      },
      [...Array(16).keys()],
      '16n'
    );

    const chordSeq = new Tone.Sequence(
      (time, idx) => {
        setCurrentChordIdx(idx);
        const chordName = progressionRef.current[idx];
        const notes = CHORD_LIBRARY[chordName];
        if (notes) chordSynth.triggerAttackRelease(notes, '2n', time);
      },
      [0, 1, 2, 3],
      '1n'
    );

    sequencesRef.current = { drumSeq, chordSeq };
    setIsLoaded(true);

    return () => {
      drumSeq.dispose();
      chordSeq.dispose();
      Object.values(synthsRef.current).forEach(s => s.dispose());
    };
  }, []);

  useEffect(() => {
    Tone.Transport.bpm.value = bpm;
  }, [bpm]);

  useEffect(() => {
    Tone.Transport.swing = swing;
  }, [swing]);

  useEffect(() => {
    if (synthsRef.current?.masterFilter) {
      synthsRef.current.masterFilter.frequency.value = filterFreq;
    }
  }, [filterFreq]);

  useEffect(() => {
    if (synthsRef.current?.vinylNoise) {
      synthsRef.current.vinylNoise.volume.value = vinylVol;
    }
  }, [vinylVol]);

  useEffect(() => {
    if (synthsRef.current?.kick) {
      synthsRef.current.kick.volume.value = drumsVol;
      synthsRef.current.snare.volume.value = drumsVol - 4;
      synthsRef.current.hihat.volume.value = drumsVol - 14;
    }
  }, [drumsVol]);

  useEffect(() => {
    if (synthsRef.current?.chordSynth) {
      synthsRef.current.chordSynth.volume.value = chordsVol;
    }
  }, [chordsVol]);

  const togglePlay = async () => {
    await Tone.start();
    if (isPlaying) {
      Tone.Transport.stop();
      sequencesRef.current.drumSeq.stop();
      sequencesRef.current.chordSeq.stop();
      synthsRef.current.vinylNoise.stop();
      setCurrentBeat(-1);
      setCurrentChordIdx(-1);
    } else {
      synthsRef.current.vinylNoise.start();
      sequencesRef.current.drumSeq.start(0);
      sequencesRef.current.chordSeq.start(0);
      Tone.Transport.start();
    }
    setIsPlaying(!isPlaying);
  };

  const loadPreset = (name) => {
    setSelectedPreset(name);
    setProgression([...PRESETS[name]]);
    setEditingSlot(null);
  };

  const updateChord = (slotIdx, chordName) => {
    const newProg = [...progression];
    newProg[slotIdx] = chordName;
    setProgression(newProg);
    setSelectedPreset('Custom');
    setEditingSlot(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-900 via-amber-950 to-stone-900 p-4 font-mono">
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-amber-200 mb-1 text-center">
          Lo-Fi Beat Maker
        </h1>
        <p className="text-amber-600 text-xs text-center mb-4">
          chill beats to relax/study to
        </p>

        {/* Beat indicator */}
        <div className="flex justify-center gap-1 mb-4">
          {[...Array(16)].map((_, i) => (
            <div
              key={i}
              className={`w-2.5 h-2.5 rounded-full transition-all duration-75 ${
                currentBeat === i
                  ? 'bg-amber-400 shadow-lg shadow-amber-400/50'
                  : i % 4 === 0
                    ? 'bg-amber-700'
                    : 'bg-amber-900'
              }`}
            />
          ))}
        </div>

        {/* Play button */}
        <button
          onClick={togglePlay}
          disabled={!isLoaded}
          className={`w-full py-3 rounded-xl text-lg font-bold transition-all mb-4 ${
            isPlaying
              ? 'bg-amber-600 text-stone-900 hover:bg-amber-500'
              : 'bg-amber-800 text-amber-100 hover:bg-amber-700'
          } disabled:opacity-50`}
        >
          {!isLoaded ? 'Loading...' : isPlaying ? '■ Stop' : '▶ Play'}
        </button>

        {/* Chord Progression Section */}
        <div className="bg-stone-800/50 rounded-xl p-4 backdrop-blur mb-4">
          <h2 className="text-amber-400 font-bold mb-3">Chord Progression</h2>

          {/* Current progression display */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {progression.map((chord, idx) => (
              <div key={idx} className="relative">
                <button
                  onClick={() => setEditingSlot(editingSlot === idx ? null : idx)}
                  className={`w-full py-3 px-2 rounded-lg text-sm font-bold transition-all ${
                    currentChordIdx === idx
                      ? 'bg-amber-500 text-stone-900 scale-105 shadow-lg shadow-amber-500/30'
                      : editingSlot === idx
                        ? 'bg-amber-700 text-amber-100 ring-2 ring-amber-400'
                        : 'bg-stone-700 text-amber-200 hover:bg-stone-600'
                  }`}
                >
                  {chord}
                </button>
                <span className="absolute -top-2 -left-1 text-xs text-amber-600">
                  {idx + 1}
                </span>
              </div>
            ))}
          </div>

          {/* Chord selector dropdown */}
          {editingSlot !== null && (
            <div className="mb-4 p-3 bg-stone-900/50 rounded-lg">
              <p className="text-amber-300 text-xs mb-2">
                Select chord for slot {editingSlot + 1}:
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {Object.keys(CHORD_LIBRARY).map((chordName) => (
                  <button
                    key={chordName}
                    onClick={() => updateChord(editingSlot, chordName)}
                    className={`py-1.5 px-1 rounded text-xs transition-all ${
                      progression[editingSlot] === chordName
                        ? 'bg-amber-500 text-stone-900 font-bold'
                        : 'bg-stone-700 text-amber-200 hover:bg-stone-600'
                    }`}
                  >
                    {chordName}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Presets */}
          <div>
            <p className="text-amber-300 text-xs mb-2">Presets:</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(PRESETS).map((name) => (
                <button
                  key={name}
                  onClick={() => loadPreset(name)}
                  className={`py-1.5 px-3 rounded-full text-xs transition-all ${
                    selectedPreset === name
                      ? 'bg-amber-500 text-stone-900 font-bold'
                      : 'bg-stone-700 text-amber-200 hover:bg-stone-600'
                  }`}
                >
                  {name}
                </button>
              ))}
              {selectedPreset === 'Custom' && (
                <span className="py-1.5 px-3 rounded-full text-xs bg-amber-700 text-amber-100">
                  Custom
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-stone-800/50 rounded-xl p-4 backdrop-blur">
          <h2 className="text-amber-400 font-bold mb-3">Sound Controls</h2>
          <div className="grid grid-cols-2 gap-x-4">
            <Slider label="Tempo" value={bpm} onChange={setBpm} min={60} max={100} unit=" BPM" />
            <Slider label="Filter" value={filterFreq} onChange={setFilterFreq} min={200} max={2000} step={50} unit=" Hz" />
            <Slider label="Swing" value={swing} onChange={setSwing} min={0} max={1} step={0.1} />
            <Slider label="Vinyl" value={vinylVol} onChange={setVinylVol} min={-40} max={-5} unit=" dB" />
            <Slider label="Drums" value={drumsVol} onChange={setDrumsVol} min={-20} max={0} unit=" dB" />
            <Slider label="Chords" value={chordsVol} onChange={setChordsVol} min={-24} max={-3} unit=" dB" />
          </div>
        </div>

        <p className="text-amber-800 text-xs text-center mt-3">
          Built with Tone.js • Click chords to edit
        </p>
      </div>
    </div>
  );
}
