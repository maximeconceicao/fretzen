/**
 * Audio par synthèse Web Audio (SPEC §8) : sons d'action (validation, erreur,
 * victoire), désactivables.
 *
 * Respecte l'autoplay : le contexte n'est créé/repris qu'après une interaction
 * utilisateur, via `resume()`. Sans contexte, toutes les méthodes sont inertes
 * (le jeu reste jouable sans son).
 *
 * Direction sonore « pad ambient » :
 *  - Bus de réverbération partagé (ConvolverNode + IR synthétique) : chaleur et
 *    espace « cosy » sur tous les sons d'action.
 *  - Timbre rond de synthétiseur (plusieurs triangles légèrement désaccordés +
 *    une sous-octave sinus, passe-bas à éclosion douce) pour la validation et la
 *    victoire : chaleureux et enveloppant plutôt que claquant. La **vraie
 *    hauteur** de la note trouvée est jouée (valeur pédagogique conservée).
 *  - Panoramique stéréo indexé sur la frette (gauche→droite) : le geste sur le
 *    manche se retrouve dans le son.
 *  - Escalade de combo : le filtre s'ouvre légèrement et un shimmer d'octave
 *    apparaît avec l'enchaînement (brillance, pas de mélodie — réf. SPEC §6).
 *  - Humanisation : léger désaccord, timing et gain aléatoires à chaque
 *    déclenchement pour éviter la fatigue de répétition.
 */

import { MAX_FRET } from '../../domain/fretboard';

type AudioCtor = typeof AudioContext;

function getAudioContextCtor(): AudioCtor | null {
    if (typeof window === 'undefined') {
        return null;
    }
    const w = window as unknown as {
        AudioContext?: AudioCtor;
        webkitAudioContext?: AudioCtor;
    };
    return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function midiToFreq(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Valeur aléatoire centrée dans [-amount, +amount]. */
function jitter(amount: number): number {
    return (Math.random() * 2 - 1) * amount;
}

const MASTER_LEVEL = 0.6;

export class AudioManager {
    private ctx: AudioContext | null = null;
    private master: GainNode | null = null;
    /** Bus « sec » commun aux sons d'action. */
    private sfxBus: GainNode | null = null;
    /** Entrée du bus de réverb (les voix y envoient leur part « wet »). */
    private reverbInput: GainNode | null = null;
    private _muted = false;

    /** À appeler sur une interaction utilisateur (ex. clic « Démarrer »). */
    resume(): void {
        if (!this.ctx) {
            const Ctor = getAudioContextCtor();
            if (!Ctor) {
                return;
            }
            try {
                this.ctx = new Ctor();
            } catch {
                this.ctx = null;
                return;
            }
            this.master = this.ctx.createGain();
            this.master.gain.value = this._muted ? 0 : MASTER_LEVEL;
            this.master.connect(this.ctx.destination);

            // Bus sec des sons d'action : va directement au master, sans filtre
            // passe-bas, pour préserver les transitoires qui rendent une corde
            // pincée « présente ».
            this.sfxBus = this.ctx.createGain();
            this.sfxBus.gain.value = 1;
            this.sfxBus.connect(this.master);

            // Bus de réverb partagé : IR synthétique → chaleur et espace cosy.
            const convolver = this.ctx.createConvolver();
            convolver.buffer = this.makeReverbIR(2.4, 2.8);
            const reverbOut = this.ctx.createGain();
            reverbOut.gain.value = 0.85;
            this.reverbInput = this.ctx.createGain();
            this.reverbInput.gain.value = 1;
            this.reverbInput.connect(convolver);
            convolver.connect(reverbOut);
            reverbOut.connect(this.master);
        }
        if (this.ctx.state === 'suspended') {
            void this.ctx.resume();
        }
    }

    /**
     * Réponse impulsionnelle synthétique : bruit stéréo à décroissance
     * exponentielle. Donne une réverb douce et enveloppante, sans asset.
     */
    private makeReverbIR(seconds: number, decay: number): AudioBuffer {
        const ctx = this.ctx!;
        const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
        const ir = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
            const data = ir.getChannelData(ch);
            for (let i = 0; i < len; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
            }
        }
        return ir;
    }

    get muted(): boolean {
        return this._muted;
    }

    setMuted(muted: boolean): void {
        this._muted = muted;
        if (this.master && this.ctx) {
            this.master.gain.setTargetAtTime(
                muted ? 0 : MASTER_LEVEL,
                this.ctx.currentTime,
                0.02,
            );
        }
    }

    toggleMuted(): boolean {
        this.setMuted(!this._muted);
        return this._muted;
    }

    /**
     * Bonne réponse : pad rond à la vraie hauteur. Le geste se retrouve dans le
     * son à plusieurs niveaux : la **hauteur** (frette + corde via le MIDI), le
     * **panoramique** (frette, gauche → droite), le **timbre** (corde : graves
     * plus sombres et tenues, aiguës plus claires) et le **combo** (le son
     * s'éclaircit à mesure de l'enchaînement, sans changer de note).
     */
    playCorrect(midi: number, fret = 0, string = 0, combo = 0): void {
        const base = midiToFreq(midi);
        const pan = this.panFor(fret, string);
        // Brillance qui monte doucement avec le combo (plafonnée, ton zen).
        const bright = combo > 1 ? Math.min(1, (combo - 1) / 8) : 0;
        this.pad(base, { peak: 0.42, dur: 1.7, pan, wet: 0.5, string, bright });
    }

    /** Mauvaise réponse : grave feutré et enveloppant, non punitif. */
    playWrong(): void {
        this.blip(130, { type: 'sine', peak: 0.12, dur: 0.7, attack: 0.05, wet: 0.28 });
        this.blip(98, { type: 'sine', peak: 0.09, dur: 0.9, attack: 0.07, when: 0.05, wet: 0.28 });
    }

    /** Victoire : arpège majeur lent en pads chaleureux, baignés de réverb. */
    playVictory(): void {
        const chord = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
        chord.forEach((f, i) => {
            // Balaie le champ stéréo de gauche à droite au fil de l'arpège.
            const pan = (i / (chord.length - 1)) * 1.0 - 0.5;
            this.pad(f, { peak: 0.3, dur: 2.8, when: i * 0.26, pan, wet: 0.6, bright: 0.5 });
        });
    }

    /**
     * Panoramique stéréo d'après la position sur le manche : la frette donne
     * l'essentiel (gauche → droite), la corde apporte un léger décalage.
     */
    private panFor(fret: number, string: number): number {
        const fr = Math.max(0, Math.min(MAX_FRET, fret));
        let p = (fr / MAX_FRET) * 1.2 - 0.6; // -0.6 (à vide) → +0.6 (12e frette)
        if (string) {
            p += ((3.5 - string) / 5) * 0.12; // aiguës légèrement d'un côté
        }
        return Math.max(-0.9, Math.min(0.9, p));
    }

    /**
     * Voix « pad ambient » à la vraie hauteur : deux triangles légèrement
     * désaccordés (ensemble chaud, façon chorus) + une sous-octave sinus pour le
     * corps, passés dans un passe-bas à éclosion douce. Attaque ronde et longue
     * extinction baignée de réverb → cosy plutôt que percussif. Panoramique,
     * envoi réverb et humanisation ; `bright` (0→1) ouvre le timbre et ajoute un
     * shimmer d'octave avec le combo, sans toucher à la note.
     */
    private pad(
        freq: number,
        opts: {
            peak?: number;
            dur?: number;
            when?: number;
            pan?: number;
            wet?: number;
            /** Numéro de corde (1 = aiguë … 6 = grave) ; 0 = timbre neutre. */
            string?: number;
            /** Brillance 0→1 (combo) : filtre plus ouvert + shimmer d'octave. */
            bright?: number;
        },
    ): void {
        if (!this.ctx || !this.sfxBus) {
            return;
        }
        const peak = opts.peak ?? 0.4;
        // Caractère de corde : 0 (aiguë, corde 1) → 1 (grave, corde 6).
        const stringT = opts.string ? (opts.string - 1) / 5 : 0.5;
        // Les graves tiennent un peu plus longtemps que les aiguës.
        const dur = (opts.dur ?? 1.6) * (0.85 + stringT * 0.5);
        const bright = Math.max(0, Math.min(1, opts.bright ?? 0));
        // Humanisation : micro-décalage temporel.
        const t = this.ctx.currentTime + (opts.when ?? 0) + Math.max(0, jitter(0.006));

        // Mélange des oscillateurs avant l'enveloppe.
        const mix = this.ctx.createGain();
        mix.gain.value = 1;

        const voices: OscillatorNode[] = [];
        // Deux triangles désaccordés : épaisseur et chaleur « ensemble ».
        for (const d of [-6, 7]) {
            const o = this.ctx.createOscillator();
            o.type = 'triangle';
            o.frequency.value = freq;
            o.detune.value = d + jitter(4); // humanisation du désaccord
            o.connect(mix);
            voices.push(o);
        }
        // Sous-octave sinus : corps et rondeur sans brouiller la hauteur.
        const sub = this.ctx.createOscillator();
        sub.type = 'sine';
        sub.frequency.value = freq / 2;
        const subGain = this.ctx.createGain();
        subGain.gain.value = 0.5;
        sub.connect(subGain);
        subGain.connect(mix);
        voices.push(sub);
        // Shimmer d'octave, discret, qui n'apparaît qu'en combo (brillance).
        if (bright > 0.01) {
            const shimmer = this.ctx.createOscillator();
            shimmer.type = 'sine';
            shimmer.frequency.value = freq * 2;
            shimmer.detune.value = jitter(5);
            const shGain = this.ctx.createGain();
            shGain.gain.value = 0.12 * bright;
            shimmer.connect(shGain);
            shGain.connect(mix);
            voices.push(shimmer);
        }

        // Enveloppe d'amplitude : attaque douce (rondeur), longue extinction.
        const env = this.ctx.createGain();
        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(peak * (1 + jitter(0.08)), t + 0.03);
        env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        // Passe-bas à éclosion : le timbre s'ouvre puis se referme doucement
        // (respiration). Plus feutré sur les graves, plus clair sur les aiguës et
        // avec le combo.
        const tone = this.ctx.createBiquadFilter();
        tone.type = 'lowpass';
        tone.Q.value = 0.4;
        const cut = Math.min(
            5200,
            Math.max(700, freq * (2.5 + (1 - stringT) * 3 + bright * 3)),
        );
        tone.frequency.setValueAtTime(cut * 0.6, t);
        tone.frequency.linearRampToValueAtTime(cut, t + 0.18);
        tone.frequency.exponentialRampToValueAtTime(Math.max(400, cut * 0.5), t + dur);

        const panner = this.ctx.createStereoPanner();
        panner.pan.value = opts.pan ?? 0;

        mix.connect(env);
        env.connect(tone);
        tone.connect(panner);
        this.sendOut(panner, opts.wet ?? 0);

        for (const v of voices) {
            v.start(t);
            v.stop(t + dur + 0.1);
        }
    }

    private blip(
        freq: number,
        opts: {
            type?: OscillatorType;
            peak?: number;
            dur?: number;
            when?: number;
            attack?: number;
            pan?: number;
            wet?: number;
        },
    ): void {
        if (!this.ctx || !this.sfxBus) {
            return;
        }
        const t = this.ctx.currentTime + (opts.when ?? 0);
        const peak = opts.peak ?? 0.3;
        const dur = opts.dur ?? 0.25;
        // Attaque douce (fondu entrant) + release longue : rendu « nappe »
        // plutôt qu'attaque percussive de jeu vidéo.
        const attack = opts.attack ?? 0.04;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = opts.type ?? 'sine';
        osc.frequency.value = freq;
        osc.detune.value = jitter(6); // humanisation discrète
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(peak, t + attack);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        const panner = this.ctx.createStereoPanner();
        panner.pan.value = opts.pan ?? 0;

        osc.connect(gain);
        gain.connect(panner);
        this.sendOut(panner, opts.wet ?? 0);

        osc.start(t);
        osc.stop(t + dur + 0.05);
    }

    /**
     * Route une voix vers le bus sec et, selon `wet`, vers le bus de réverb.
     */
    private sendOut(node: AudioNode, wet: number): void {
        node.connect(this.sfxBus!);
        if (wet > 0 && this.reverbInput) {
            const send = this.ctx!.createGain();
            send.gain.value = wet;
            node.connect(send);
            send.connect(this.reverbInput);
        }
    }
}
