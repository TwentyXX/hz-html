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
        this.loudnessCorrection = true; // ラウドネス補正フラグ
        this.wakeLockEnabled = true; // Wake Lock有効フラグ
        this.mediaSessionEnabled = true; // Media Session有効フラグ
        this.wakeLock = null; // Wake Lockオブジェクト
        
        this.initializeElements();
        this.setupEventListeners();
        this.setupBackgroundPlayback();
        this.setupMediaSession();
        this.loadSettings();
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
        this.loudnessCorrectionCheckbox = document.getElementById('loudnessCorrection');
        this.wakeLockEnabledCheckbox = document.getElementById('wakeLockEnabled');
        this.mediaSessionEnabledCheckbox = document.getElementById('mediaSessionEnabled');
    }
    
    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.start());
        this.stopBtn.addEventListener('click', () => this.stop());
        
        this.tempoSlider.addEventListener('input', (e) => {
            this.tempo = parseInt(e.target.value);
            this.tempoValue.textContent = this.tempo;
            this.saveSettings();
            if (this.isPlaying) {
                this.restart();
            }
        });
        
        this.volumeSlider.addEventListener('input', (e) => {
            this.volume = parseInt(e.target.value) / 100;
            this.volumeValue.textContent = e.target.value;
            this.saveSettings();
            if (this.gainNode) {
                this.gainNode.gain.value = this.volume;
            }
        });
        
        this.baseFreqSlider.addEventListener('input', (e) => {
            this.baseFrequency = parseInt(e.target.value);
            this.baseFreqValue.textContent = this.baseFrequency;
            this.saveSettings();
        });
        
        this.startNoteSelect.addEventListener('change', () => {
            this.updateStartKey();
            this.saveSettings();
        });
        
        this.startOctaveSelect.addEventListener('change', () => {
            this.updateStartKey();
            this.saveSettings();
        });
        
        this.endNoteSelect.addEventListener('change', () => {
            this.updateEndKey();
            this.saveSettings();
        });
        
        this.endOctaveSelect.addEventListener('change', () => {
            this.updateEndKey();
            this.saveSettings();
        });
        
        this.loudnessCorrectionCheckbox.addEventListener('change', (e) => {
            this.loudnessCorrection = e.target.checked;
            this.saveSettings();
        });
        
        this.wakeLockEnabledCheckbox.addEventListener('change', (e) => {
            this.wakeLockEnabled = e.target.checked;
            this.saveSettings();
            if (this.wakeLockEnabled && this.isPlaying) {
                this.requestWakeLock();
            } else {
                this.releaseWakeLock();
            }
        });
        
        this.mediaSessionEnabledCheckbox.addEventListener('change', (e) => {
            this.mediaSessionEnabled = e.target.checked;
            this.saveSettings();
            if (this.mediaSessionEnabled) {
                this.setupMediaSession();
            }
        });
    }
    
    async initializeAudioContext() {
        try {
            if (!this.audioContext) {
                // Web Audio APIのサポート確認
                if (!window.AudioContext && !window.webkitAudioContext) {
                    throw new Error('Web Audio APIがサポートされていません');
                }
                
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                
                // AudioContextの状態変更を監視
                this.audioContext.addEventListener('statechange', () => {
                    console.log('AudioContext状態:', this.audioContext.state);
                    if (this.audioContext.state === 'suspended' && this.isPlaying) {
                        console.log('AudioContextが停止されました。再開を試みます...');
                        this.audioContext.resume().catch(err => {
                            console.warn('AudioContextの再開に失敗:', err);
                        });
                    }
                });
            }
            
            // AudioContextの状態を確認
            if (this.audioContext.state === 'suspended') {
                console.log('AudioContextを再開します...');
                await this.audioContext.resume();
            }
            
            if (this.audioContext.state === 'closed') {
                throw new Error('AudioContextが閉じられています');
            }
            
            console.log('AudioContext初期化完了:', this.audioContext.state);
            
        } catch (error) {
            console.error('AudioContext初期化エラー:', error);
            throw error;
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
        
        // A4を基準とした半音の差を計算（A4は絶対インデックス45: (4-1)*12 + 9 = 45）
        const semitonesFromA4 = absoluteIndex - 45;
        return this.baseFrequency * Math.pow(2, semitonesFromA4 / 12);
    }
    
    // 等ラウドネス曲線に基づく音量補正を計算
    calculateLoudnessCorrection(frequency) {
        if (!this.loudnessCorrection) return 1.0;
        
        // 聴覚特性に合わせた補正（高音域の感度が非常に高い）
        // 440Hz（A4）付近から減衰を開始
        const f = frequency;
        
        // 等ラウドネス曲線の近似
        let correction = 1.0;
        
        if (f < 220) {
            // 極低音域の補正（220Hz以下）- 大幅に強調
            const logRatio = Math.log10(220 / f);
            correction = 1.0 + (logRatio * 0.8); // 低音域を大幅に強調
        } else if (f < 660) {
            // 220Hz-660Hz - 70%減衰を目安に調整
            const ratio = (f - 220) / (660 - 220);
            correction = 1.0 - (ratio * 0.7); // 220Hzから70%減衰
        } else if (f < 880) {
            // 660Hz-880Hz - 75%減衰
            const ratio = (f - 660) / (880 - 660);
            correction = 0.3 - (ratio * 0.05); // 30%から25%へ
        } else if (f < 1760) {
            // 880Hz-1760Hz - 85%減衰
            const ratio = (f - 880) / (1760 - 880);
            correction = 0.25 - (ratio * 0.1); // 25%から15%へ
        } else {
            // 1760Hz以上 - 90%減衰で安定
            correction = 0.1;
        }
        
        // 補正値を0.05-2.0の範囲に制限
        return Math.max(0.05, Math.min(2.0, correction));
    }
    
    createOscillator(frequency) {
        const oscillator = this.audioContext.createOscillator();
        this.gainNode = this.audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        
        // ラウドネス補正を適用した音量を設定
        const loudnessCorrection = this.calculateLoudnessCorrection(frequency);
        const adjustedVolume = this.volume * loudnessCorrection;
        this.gainNode.gain.setValueAtTime(adjustedVolume, this.audioContext.currentTime);
        
        oscillator.connect(this.gainNode);
        this.gainNode.connect(this.audioContext.destination);
        
        return oscillator;
    }
    
    playNote(relativeIndex) {
        try {
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
            const correctionInfo = this.loudnessCorrection ? ' [補正済]' : '';
            const wakeLockInfo = this.wakeLock ? ' [画面オン]' : '';
            const mediaSessionInfo = this.mediaSessionEnabled ? ' [メディア]' : '';
            this.currentNoteDisplay.textContent = `${noteName} (${frequency.toFixed(1)} Hz)`;
            
        } catch (error) {
            console.error('音の再生に失敗しました:', error);
            // エラーが発生した場合は再生を停止
            this.stop();
        }
    }
    
    async start() {
        try {
            await this.initializeAudioContext();
            
            if (this.isPlaying) return;
            
            this.isPlaying = true;
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            
            // Wake Lockを要求
            await this.requestWakeLock();
            
            // Media Sessionを更新
            this.updateMediaSessionMetadata();
            
            // 最初の音を再生
            this.playNote(this.currentNoteIndex);
            
            // テンポに基づいて次の音に進む間隔を計算（ミリ秒）
            const interval = (60 / this.tempo) * 1000;
            
            this.intervalId = setInterval(() => {
                if (this.isReverse) {
                    this.currentNoteIndex--;
                    if (this.currentNoteIndex <= 0) {
                        // 最初の音を再生してからループを完了
                        if (this.currentNoteIndex === 0) {
                            this.playNote(this.currentNoteIndex);
                        }
                        this.loopCount++;
                        this.isReverse = this.loopCount % 2 === 1;
                        this.currentNoteIndex = this.isReverse ? this.totalNotes - 1 : 0;
                        return;
                    }
                } else {
                    this.currentNoteIndex++;
                    if (this.currentNoteIndex >= this.totalNotes - 1) {
                        // 最後の音を再生してからループを完了
                        if (this.currentNoteIndex === this.totalNotes - 1) {
                            this.playNote(this.currentNoteIndex);
                        }
                        this.loopCount++;
                        this.isReverse = this.loopCount % 2 === 1;
                        this.currentNoteIndex = this.isReverse ? this.totalNotes - 1 : 0;
                        return;
                    }
                }
                this.playNote(this.currentNoteIndex);
            }, interval);
            
        } catch (error) {
            console.error('オーディオの初期化に失敗しました:', error);
            this.isPlaying = false;
            this.startBtn.disabled = false;
            this.stopBtn.disabled = true;
            
            let errorMessage = 'オーディオの初期化に失敗しました。\n\n';
            
            if (error.name === 'NotAllowedError') {
                errorMessage += 'ブラウザがオーディオの再生を許可していません。\n' +
                              'ページを更新してから再度お試しください。';
            } else if (error.name === 'NotSupportedError') {
                errorMessage += 'お使いのブラウザはWeb Audio APIをサポートしていません。\n' +
                              'Chrome、Firefox、Safari、Edgeなどの最新ブラウザをお使いください。';
            } else {
                errorMessage += 'エラー詳細: ' + error.message + '\n\n' +
                              '以下をお試しください：\n' +
                              '• ページを更新する\n' +
                              '• 他のタブで音楽が再生されていないか確認する\n' +
                              '• ブラウザを再起動する';
            }
            
            alert(errorMessage);
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
        
        // Wake Lockを解除
        this.releaseWakeLock();
        
        // Media Sessionを更新
        this.updateMediaSessionMetadata();
    }
    
    restart() {
        if (this.isPlaying) {
            this.stop();
            setTimeout(() => this.start(), 100);
        }
    }
    
    // Wake Lockを要求
    async requestWakeLock() {
        if (!this.wakeLockEnabled) return;
        
        try {
            if ('wakeLock' in navigator) {
                this.wakeLock = await navigator.wakeLock.request('screen');
                console.log('Wake Lock が有効になりました');
                
                // Wake Lockが解除された場合の処理
                this.wakeLock.addEventListener('release', () => {
                    console.log('Wake Lock が解除されました');
                });
            }
        } catch (err) {
            console.warn('Wake Lock の要求に失敗しました:', err);
        }
    }
    
    // Wake Lockを解除
    releaseWakeLock() {
        if (this.wakeLock) {
            this.wakeLock.release();
            this.wakeLock = null;
            console.log('Wake Lock を手動で解除しました');
        }
    }
    
    // Media Session APIのセットアップ
    setupMediaSession() {
        if (!this.mediaSessionEnabled || !('mediaSession' in navigator)) return;
        
        // アクションハンドラーを設定
        navigator.mediaSession.setActionHandler('play', () => {
            console.log('Media Session: 再生要求');
            this.start();
        });
        
        navigator.mediaSession.setActionHandler('pause', () => {
            console.log('Media Session: 一時停止要求');
            this.stop();
        });
        
        navigator.mediaSession.setActionHandler('stop', () => {
            console.log('Media Session: 停止要求');
            this.stop();
        });
        
        // 次/前の曲（ループ方向切り替え）
        navigator.mediaSession.setActionHandler('nexttrack', () => {
            console.log('Media Session: 次の曲（順方向に切り替え）');
            this.isReverse = false;
            this.loopCount = this.loopCount % 2 === 0 ? this.loopCount : this.loopCount + 1;
            this.updateMediaSessionMetadata();
        });
        
        navigator.mediaSession.setActionHandler('previoustrack', () => {
            console.log('Media Session: 前の曲（逆方向に切り替え）');
            this.isReverse = true;
            this.loopCount = this.loopCount % 2 === 1 ? this.loopCount : this.loopCount + 1;
            this.updateMediaSessionMetadata();
        });
        
        this.updateMediaSessionMetadata();
    }
    
    // Media Sessionのメタデータを更新
    updateMediaSessionMetadata() {
        if (!this.mediaSessionEnabled || !('mediaSession' in navigator)) return;
        
        const direction = this.isReverse ? '逆順' : '順方向';
        const range = `${this.startKey}-${this.endKey}`;
        
        navigator.mediaSession.metadata = new MediaMetadata({
            title: `12音正弦波ループ (${direction})`,
            artist: `範囲: ${range}`,
            album: `テンポ: ${this.tempo} BPM | 音量: ${Math.round(this.volume * 100)}%`,
            artwork: [
                {
                    src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" fill="#2196F3"/><text x="128" y="140" text-anchor="middle" fill="white" font-size="48" font-family="Arial">♪</text><text x="128" y="180" text-anchor="middle" fill="white" font-size="16" font-family="Arial">${range}</text></svg>`),
                    sizes: '256x256',
                    type: 'image/svg+xml'
                }
            ]
        });
        
        // 再生状態を更新
        navigator.mediaSession.playbackState = this.isPlaying ? 'playing' : 'paused';
    }
    
    // バックグラウンド再生のセットアップ
    setupBackgroundPlayback() {
        // ページの可視性変更を監視
        document.addEventListener('visibilitychange', () => {
            if (this.audioContext && this.isPlaying) {
                if (document.hidden) {
                    // バックグラウンドに移行時
                    console.log('バックグラウンド再生を継続します');
                } else {
                    // フォアグラウンドに復帰時
                    console.log('フォアグラウンドに復帰しました');
                    // AudioContextが停止している場合は再開
                    if (this.audioContext.state === 'suspended') {
                        this.audioContext.resume();
                    }
                }
            }
        });
        
        // ウィンドウのフォーカス変更を監視
        window.addEventListener('blur', () => {
            if (this.audioContext && this.isPlaying) {
                console.log('ウィンドウがフォーカスを失いましたが、再生を継続します');
            }
        });
        
        window.addEventListener('focus', () => {
            if (this.audioContext && this.isPlaying) {
                console.log('ウィンドウがフォーカスを取得しました');
                // AudioContextが停止している場合は再開
                if (this.audioContext.state === 'suspended') {
                    this.audioContext.resume();
                }
            }
        });
        
        // ページのアンロード前に警告とWake Lock解除
        window.addEventListener('beforeunload', (e) => {
            this.releaseWakeLock();
            if (this.isPlaying) {
                e.preventDefault();
                e.returnValue = '音楽が再生中です。ページを離れますか？';
                return e.returnValue;
            }
        });
        
        // ページの可視性が戻った時にWake Lockを再要求
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.isPlaying && this.wakeLockEnabled) {
                this.requestWakeLock();
            }
        });
    }
    
    // 設定をCookieに保存
    saveSettings() {
        const settings = {
            tempo: this.tempo,
            volume: this.volume,
            baseFrequency: this.baseFrequency,
            startKey: this.startKey,
            endKey: this.endKey,
            loudnessCorrection: this.loudnessCorrection,
            wakeLockEnabled: this.wakeLockEnabled,
            mediaSessionEnabled: this.mediaSessionEnabled
        };
        
        const expires = new Date();
        expires.setTime(expires.getTime() + (365 * 24 * 60 * 60 * 1000)); // 1年後
        document.cookie = `twelveToneSettings=${JSON.stringify(settings)}; expires=${expires.toUTCString()}; path=/`;
    }
    
    // Cookieから設定を読み込み
    loadSettings() {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'twelveToneSettings') {
                try {
                    const settings = JSON.parse(decodeURIComponent(value));
                    this.applySettings(settings);
                } catch (error) {
                    console.warn('設定の読み込みに失敗しました:', error);
                }
                break;
            }
        }
    }
    
    // 設定を適用
    applySettings(settings) {
        if (settings.tempo !== undefined) {
            this.tempo = settings.tempo;
            this.tempoSlider.value = settings.tempo;
            this.tempoValue.textContent = settings.tempo;
        }
        
        if (settings.volume !== undefined) {
            this.volume = settings.volume;
            this.volumeSlider.value = Math.round(settings.volume * 100);
            this.volumeValue.textContent = Math.round(settings.volume * 100);
        }
        
        if (settings.baseFrequency !== undefined) {
            this.baseFrequency = settings.baseFrequency;
            this.baseFreqSlider.value = settings.baseFrequency;
            this.baseFreqValue.textContent = settings.baseFrequency;
        }
        
        if (settings.loudnessCorrection !== undefined) {
            this.loudnessCorrection = settings.loudnessCorrection;
            this.loudnessCorrectionCheckbox.checked = settings.loudnessCorrection;
        }
        
        if (settings.wakeLockEnabled !== undefined) {
            this.wakeLockEnabled = settings.wakeLockEnabled;
            this.wakeLockEnabledCheckbox.checked = settings.wakeLockEnabled;
        }
        
        if (settings.mediaSessionEnabled !== undefined) {
            this.mediaSessionEnabled = settings.mediaSessionEnabled;
            this.mediaSessionEnabledCheckbox.checked = settings.mediaSessionEnabled;
        }
        
        if (settings.startKey !== undefined) {
            this.startKey = settings.startKey;
            const startMatch = settings.startKey.match(/^([A-G]#?)(\d+)$/);
            if (startMatch) {
                this.startNoteSelect.value = startMatch[1];
                this.startOctaveSelect.value = startMatch[2];
                this.startKeyValue.textContent = settings.startKey;
            }
        }
        
        if (settings.endKey !== undefined) {
            this.endKey = settings.endKey;
            const endMatch = settings.endKey.match(/^([A-G]#?)(\d+)$/);
            if (endMatch) {
                this.endNoteSelect.value = endMatch[1];
                this.endOctaveSelect.value = endMatch[2];
                this.endKeyValue.textContent = settings.endKey;
            }
        }
        
        // 音域を更新
        this.updateNoteRange();
    }
}

// ページ読み込み完了後にアプリケーションを初期化
document.addEventListener('DOMContentLoaded', () => {
    new TwelveToneLoop();
});
