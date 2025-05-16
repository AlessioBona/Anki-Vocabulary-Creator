// Handles the Generate Audio Files feature for Anki Vocabulary Creator
// This script is loaded after all other JS files

(function() {
    let mp3Files = []; // Move this outside the function for global access

    // Wait for DOM and appState to be ready
    document.addEventListener('DOMContentLoaded', function() {
        const btn = document.getElementById('generate-audio-files');
        if (!btn) return;
        btn.addEventListener('click', handleGenerateAudioFiles);

        const downloadBtn = document.getElementById('download-audio-files');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', function() {
                if (!mp3Files.length) {
                    alert('No audio files generated yet.');
                    return;
                }
                downloadZip(mp3Files);
            });
        }
    });

    async function handleGenerateAudioFiles(e) {
        e.preventDefault();
        const btn = e.target; // <-- Add this line
        const model = document.getElementById('tts-model').value.trim();
        const voice = document.getElementById('tts-voice').value.trim();
        const instructions = document.getElementById('tts-instructions').value.trim();
        const prefix = document.getElementById('tts-prefix') ? document.getElementById('tts-prefix').value.trim() : 'zh01_';
        if (!model || !voice) {
            alert('Please specify both TTS model and voice.');
            return;
        }
        if (!window.appState || !appState.sheetData || !appState.sheetData.values) {
            alert('No data loaded.');
            return;
        }
        const data = appState.sheetData.values;
        const header = data[0];
        const rows = data.slice(1);
        // Find relevant column indexes
        const idxSentence1 = header.indexOf('Sentence_01_zh');
        const idxSentence2 = header.indexOf('Sentence_02_zh');
        const idxAudio1 = header.indexOf('Sentence_01_audio');
        const idxAudio2 = header.indexOf('Sentence_02_audio');
        const idxEnglish = header.indexOf('Translation');
        if (idxSentence1 === -1 || idxSentence2 === -1 || idxAudio1 === -1 || idxAudio2 === -1 || idxEnglish === -1) {
            alert('Required columns not found.');
            return;
        }
        // Only process visible rows
        const visibleRowIndexes = getVisibleRowIndexes();
        if (visibleRowIndexes.length === 0) {
            alert('No visible rows to process.');
            return;
        }
        btn.disabled = true;
        btn.textContent = 'Generating...';
        try {
            for (const rowIdx of visibleRowIndexes) {
                const row = data[rowIdx];
                // Sentence 1
                const text1 = row[idxSentence1];
                if (text1) {
                    const filename1 = makeAudioFilename(row[idxEnglish], 1, prefix);
                    const mp3Blob1 = await generateTTS(text1, model, voice, instructions);
                    mp3Files.push({filename: filename1, blob: mp3Blob1});
                    row[idxAudio1] = `[sound:${filename1}]`;
                }
                // Sentence 2
                const text2 = row[idxSentence2];
                if (text2) {
                    const filename2 = makeAudioFilename(row[idxEnglish], 2, prefix);
                    const mp3Blob2 = await generateTTS(text2, model, voice, instructions);
                    mp3Files.push({filename: filename2, blob: mp3Blob2});
                    row[idxAudio2] = `[sound:${filename2}]`;
                }
            }
            // Update table UI
            if (window.displayData) displayData(data);
        } catch (err) {
            alert('Error generating audio: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Generate Audio Files';
        }
    }

    function getVisibleRowIndexes() {
        // Returns 1-based indexes (since data[0] is header)
        const table = document.getElementById('sheet-data-table');
        if (!table) return [];
        const visible = [];
        const trs = table.querySelectorAll('tbody tr');
        trs.forEach((tr, i) => {
            if (tr.style.display !== 'none') visible.push(i + 1);
        });
        return visible;
    }

    function makeAudioFilename(english, which, prefix = '') {
        const base = (english || 'audio').replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 30);
        const rand = Math.floor(Math.random() * 90000 + 10000);
        return `${prefix}${prefix ? '_' : ''}${base}_s${which}_${rand}.mp3`;
    }

    async function generateTTS(text, model, voice, instructions) {
        // Use apiHandler.js TTS API
        if (!window.openAIAPI || !openAIAPI.generateTTS) throw new Error('TTS API not available');
        const result = await openAIAPI.generateTTS({text, model, voice, instructions});
        if (!result || !result.audioContent) throw new Error('No audio returned');
        // Convert base64 to Blob
        const bstr = atob(result.audioContent);
        const u8arr = new Uint8Array(bstr.length);
        for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
        return new Blob([u8arr], {type: 'audio/mp3'});
    }

    async function downloadZip(files) {
        // Use JSZip (load dynamically if needed)
        let JSZip = window.JSZip;
        if (!JSZip) {
            JSZip = await loadJSZip();
        }
        const zip = new JSZip();
        files.forEach(f => zip.file(f.filename, f.blob));
        const blob = await zip.generateAsync({type: 'blob'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'anki-audio.zip';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 1000);
    }

    function loadJSZip() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            script.onload = () => resolve(window.JSZip);
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // Expose mp3Files globally for data-display.js
    window.mp3Files = mp3Files;

    // Expose a function to regenerate TTS for a single cell (rowIdx, colIdx, filename, td, regenBtn)
    window.generateTTSForCell = async function(rowIdx, colIdx, filename, td, regenBtn) {
        const data = appState.sheetData.values;
        const header = data[0];
        const row = data[rowIdx];
        // Determine which sentence column this is
        let text = null;
        let model = document.getElementById('tts-model').value.trim();
        let voice = document.getElementById('tts-voice').value.trim();
        let instructions = document.getElementById('tts-instructions').value.trim();
        if (header[colIdx] === 'Sentence_01_audio') {
            // Find the corresponding Sentence_01_zh column
            const idxSentence1 = header.indexOf('Sentence_01_zh');
            text = row[idxSentence1];
        } else if (header[colIdx] === 'Sentence_02_audio') {
            const idxSentence2 = header.indexOf('Sentence_02_zh');
            text = row[idxSentence2];
        }
        if (!text) {
            alert('No sentence text found for this row.');
            return;
        }
        // Regenerate audio
        try {
            const newBlob = await generateTTS(text, model, voice, instructions);
            // Replace in mp3Files (keep same filename)
            const fileIdx = mp3Files.findIndex(f => f.filename === filename);
            if (fileIdx !== -1) {
                mp3Files[fileIdx].blob = newBlob;
            }
            // No need to change filename or cell tag
            // Optionally, flash the cell to indicate update
            td.style.background = '#e0ffe0';
            setTimeout(() => { td.style.background = ''; }, 600);
        } catch (err) {
            alert('Error regenerating audio: ' + err.message);
        }
    };
})();
