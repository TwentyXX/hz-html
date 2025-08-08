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
        this.startKey = 'C4'; // 開始キー
        this.endKey = 'B4'; // 終了キー
        this.totalNotes = 12; // 再生する音の総数
        this.loopCount = 0; // ループ回数
        this.isReverse = false; // 逆順フラグ
        
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
        this.startNoteSelect = document.getElementById('startNoteSelect');
        this.startOctaveSelect = document.getElementById('startOctaveSelect');
        this.startKeyValue = document.getElementById('startKeyValue');
        this.endNoteSelect = document.getElementById('endNoteSelect');
        this.endOctaveSelect = document.getElementById('endOctaveSelect');
        this.endKeyValue = document.getElementById('endKeyValue');
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
        
        this.startNoteSelect.addEventListener('change', () => {
            this.updateStartKey();
        });
        
        this.startOctaveSelect.addEventListener('change', () => {
            this.updateStartKey();
        });
        
        this.endNoteSelect.addEventListener('change', () => {
            this.updateEndKey();
        });
        
        this.endOctaveSelect.addEventListener('change', () => {
            this.updateEndKey();
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
    
    // キー文字列を絶対音程インデックスに変換
    keyToAbsoluteIndex(key) {
        const noteMatch = key.match(/^([A-G]#?)(\d+)$/);
        if (!noteMatch) return 0;
        
        const noteName = noteMatch[1];
        const octave = parseInt(noteMatch[2]);
        
        const noteIndex = this.noteNames.indexOf(noteName);
        return (octave - 1) * 12 + noteIndex;
    }
    
    // 絶対音程インデックスからキー文字列に変換
    absoluteIndexToKey(absoluteIndex) {
        const noteIndex = absoluteIndex % 12;
        const octave = Math.floor(absoluteIndex / 12) + 1;
        return this.noteNames[noteIndex] + octave;
    }
    
    // 開始キーを更新
    updateStartKey() {
        const note = this.startNoteSelect.value;
        const octave = this.startOctaveSelect.value;
        this.startKey = note + octave;
        this.startKeyValue.textContent = this.startKey;
        this.updateNoteRange();
    }
    
    // 終了キーを更新
    updateEndKey() {
        const note = this.endNoteSelect.value;
        const octave = this.endOctaveSelect.value;
        this.endKey = note + octave;
        this.endKeyValue.textContent = this.endKey;
        this.updateNoteRange();
    }
    
    // キー範囲を更新
    updateNoteRange() {
        const startIndex = this.keyToAbsoluteIndex(this.startKey);
        const endIndex = this.keyToAbsoluteIndex(this.endKey);
        
        // 開始キーが終了キーより大きい場合は調整
        if (startIndex > endIndex) {
            this.endKey = this.startKey;
            const noteMatch = this.endKey.match(/^([A-G]#?)(\d+)$/);
            if (noteMatch) {
                this.endNoteSelect.value = noteMatch[1];
                this.endOctaveSelect.value = noteMatch[2];
                this.endKeyValue.textContent = this.endKey;
            }
        }
        
        // 総音数を計算
        const adjustedEndIndex = this.keyToAbsoluteIndex(this.endKey);
        this.totalNotes = adjustedEndIndex - startIndex + 1;
        
        // 再生中の場合は再開
        if (this.isPlaying) {
            this.restart();
        }
    }
    
    // 12平均律で音程を計算（A4 = 440Hzを基準）
    calculateFrequency(relativeIndex) {
        const startIndex = this.keyToAbsoluteIndex(this.startKey);
        const absoluteIndex = startIndex + relativeIndex;
        
        // A4を基準とした半音の差を計算（A4は絶対インデックス57）
        const semitonesFromA4 = absoluteIndex - 57;
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
    
    playNote(relativeIndex) {
        if (this.oscillator) {
            this.oscillator.stop();
        }
        
        const frequency = this.calculateFrequency(relativeIndex);
        this.oscillator = this.createOscillator(frequency);
        this.oscillator.start();
        
        // 音名を表示
        const startIndex = this.keyToAbsoluteIndex(this.startKey);
        const absoluteIndex = startIndex + relativeIndex;
        const noteName = this.absoluteIndexToKey(absoluteIndex);
        const direction = this.isReverse ? '(逆順)' : '(順方向)';
        this.currentNoteDisplay.textContent = `${noteName} ${direction} (${frequency.toFixed(1)} Hz)`;
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
                if (this.isReverse) {
                    this.currentNoteIndex--;
                    if (this.currentNoteIndex < 0) {
                        this.loopCount++;
                        this.isReverse = this.loopCount % 2 === 1;
                        this.currentNoteIndex = this.isReverse ? this.totalNotes - 1 : 0;
                    }
                } else {
                    this.currentNoteIndex++;
                    if (this.currentNoteIndex >= this.totalNotes) {
                        this.loopCount++;
                        this.isReverse = this.loopCount % 2 === 1;
                        this.currentNoteIndex = this.isReverse ? this.totalNotes - 1 : 0;
                    }
                }
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
        this.loopCount = 0;
        this.isReverse = false;
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
