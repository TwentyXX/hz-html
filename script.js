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
    }
    
    async initializeAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }
    
    // 12平均律で音程を計算（A4 = 440Hzを基準）
    calculateFrequency(noteIndex) {
        // A4を基準とした半音の差を計算
        // C4からA4までは9半音（C, C#, D, D#, E, F, F#, G, G#, A）
        const semitonesFromA4 = noteIndex - 9;
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
    
    playNote(noteIndex) {
        if (this.oscillator) {
            this.oscillator.stop();
        }
        
        const frequency = this.calculateFrequency(noteIndex);
        this.oscillator = this.createOscillator(frequency);
        this.oscillator.start();
        
        // 音名を表示（オクターブ4で表示）
        const noteName = this.noteNames[noteIndex] + '4';
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
                this.currentNoteIndex = (this.currentNoteIndex + 1) % 12;
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
