class TwelveToneLoop {
    constructor() {
        this.audioContext = null;
        this.oscillator = null;
        this.gainNode = null;
        this.isPlaying = false;
        this.currentNoteIndex = 0;
        this.intervalId = null;
        
        // 12音の音名（半音階）
        this.noteNames = [
            'C', 'C#', 'D', 'D#', 'E', 'F',
            'F#', 'G', 'G#', 'A', 'A#', 'B'
        ];
        
        // デフォルト設定
        this.tempo = 120; // BPM
        this.volume = 0.5; // 0-1
        this.baseFrequency = 440; // A4の周波数
        this.startOctave = 4; // 開始オクターブ
        this.endOctave = 4; // 終了オクターブ
        this.totalNotes = 12; // 再生する音の総数
        
        this.initializeElements();
        this.setupEventListeners();
    }
    
    initializeElements() {
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.currentNoteDisplay = document.getElementById('currentNote');
        this.tempoSlider = document.getElementById('tempoSlider');
        this.tempoValue = document.getElementById('tempoValue');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.volumeValue = document.getElementById('volumeValue');
        this.baseFreqSlider = document.getElementById('baseFreqSlider');
        this.baseFreqValue = document.getElementById('baseFreqValue');
        this.startOctaveSlider = document.getElementById('startOctaveSlider');
        this.startOctaveValue = document.getElementById('startOctaveValue');
        this.endOctaveSlider = document.getElementById('endOctaveSlider');
        this.endOctaveValue = document.getElementById('endOctaveValue');
    }
    
    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.start());
        this.stopBtn.addEventListener('click', () => this.stop());
        
        this.tempoSlider.addEventListener('input', (e) => {
            this.tempo = parseInt(e.target.value);
            this.tempoValue.textContent = this.tempo;
            if (this.isPlaying) {
                this.restart();
            }
        });
        
        this.volumeSlider.addEventListener('input', (e) => {
            this.volume = parseInt(e.target.value) / 100;
            this.volumeValue.textContent = e.target.value;
            if (this.gainNode) {
                this.gainNode.gain.value = this.volume;
            }
        });
        
        this.baseFreqSlider.addEventListener('input', (e) => {
            this.baseFrequency = parseInt(e.target.value);
            this.baseFreqValue.textContent = this.baseFrequency;
        });
        
        this.startOctaveSlider.addEventListener('input', (e) => {
            this.startOctave = parseInt(e.target.value);
            this.startOctaveValue.textContent = this.startOctave;
            this.updateNoteRange();
        });
        
        this.endOctaveSlider.addEventListener('input', (e) => {
            this.endOctave = parseInt(e.target.value);
            this.endOctaveValue.textContent = this.endOctave;
            this.updateNoteRange();
        });
    }
    
    async initializeAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }
    
    // オクターブ範囲を更新
    updateNoteRange() {
        // 開始オクターブが終了オクターブより大きい場合は調整
        if (this.startOctave > this.endOctave) {
            this.endOctave = this.startOctave;
            this.endOctaveSlider.value = this.endOctave;
            this.endOctaveValue.textContent = this.endOctave;
        }
        
        // 総音数を計算
        const octaveRange = this.endOctave - this.startOctave + 1;
        this.totalNotes = octaveRange * 12;
        
        // 再生中の場合は再開
        if (this.isPlaying) {
            this.restart();
        }
    }
    
    // 絶対音程インデックスから音名とオクターブを取得
    getNoteInfo(absoluteNoteIndex) {
        const noteIndex = absoluteNoteIndex % 12;
        const octave = this.startOctave + Math.floor(absoluteNoteIndex / 12);
        return {
            noteName: this.noteNames[noteIndex],
            octave: octave,
            noteIndex: noteIndex
        };
    }
    
    // 12平均律で音程を計算（A4 = 440Hzを基準）
    calculateFrequency(absoluteNoteIndex) {
        const noteInfo = this.getNoteInfo(absoluteNoteIndex);
        
        // A4を基準とした半音の差を計算
        // C4からA4までは9半音（C, C#, D, D#, E, F, F#, G, G#, A）
        const semitonesFromA4 = (noteInfo.octave - 4) * 12 + (noteInfo.noteIndex - 9);
        return this.baseFrequency * Math.pow(2, semitonesFromA4 / 12);
    }
    
    createOscillator(frequency) {
        const oscillator = this.audioContext.createOscillator();
        this.gainNode = this.audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        this.gainNode.gain.setValueAtTime(this.volume, this.audioContext.currentTime);
        
        oscillator.connect(this.gainNode);
        this.gainNode.connect(this.audioContext.destination);
        
        return oscillator;
    }
    
    playNote(absoluteNoteIndex) {
        if (this.oscillator) {
            this.oscillator.stop();
        }
        
        const frequency = this.calculateFrequency(absoluteNoteIndex);
        this.oscillator = this.createOscillator(frequency);
        this.oscillator.start();
        
        // 音名を表示
        const noteInfo = this.getNoteInfo(absoluteNoteIndex);
        const noteName = noteInfo.noteName + noteInfo.octave;
        this.currentNoteDisplay.textContent = `${noteName} (${frequency.toFixed(1)} Hz)`;
    }
    
    async start() {
        try {
            await this.initializeAudioContext();
            
            if (this.isPlaying) return;
            
            this.isPlaying = true;
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            
            // 最初の音を再生
            this.playNote(this.currentNoteIndex);
            
            // テンポに基づいて次の音に進む間隔を計算（ミリ秒）
            const interval = (60 / this.tempo) * 1000;
            
            this.intervalId = setInterval(() => {
                this.currentNoteIndex = (this.currentNoteIndex + 1) % this.totalNotes;
                this.playNote(this.currentNoteIndex);
            }, interval);
            
        } catch (error) {
            console.error('オーディオの初期化に失敗しました:', error);
            alert('オーディオの初期化に失敗しました。ブラウザがWeb Audio APIをサポートしているか確認してください。');
        }
    }
    
    stop() {
        if (!this.isPlaying) return;
        
        this.isPlaying = false;
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        if (this.oscillator) {
            this.oscillator.stop();
            this.oscillator = null;
        }
        
        this.currentNoteDisplay.textContent = '停止中';
        this.currentNoteIndex = 0;
    }
    
    restart() {
        if (this.isPlaying) {
            this.stop();
            setTimeout(() => this.start(), 100);
        }
    }
}

// ページ読み込み完了後にアプリケーションを初期化
document.addEventListener('DOMContentLoaded', () => {
    new TwelveToneLoop();
});
