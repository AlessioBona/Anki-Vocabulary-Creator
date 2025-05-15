// Handles the Generate Audio Files feature for Anki Vocabulary Creator
// This script is loaded after all other JS files

(function() {
    // Wait for DOM and appState to be ready
    document.addEventListener('DOMContentLoaded', function() {
        const btn = document.getElementById('generate-audio-files');
        if (!btn) return;
        btn.addEventListener('click', handleGenerateAudioFiles);
    });

    async function handleGenerateAudioFiles(e) {
        e.preventDefault();
        const btn = e.target; // <-- Add this line
        const model = document.getElementById('tts-model').value.trim();
        const voice = document.getElementById('tts-voice').value.trim();
        const instructions = document.getElementById('tts-instructions').value.trim();
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
        const idxEnglish = header.indexOf('Pronunciation');
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
            const mp3Files = [];
            for (const rowIdx of visibleRowIndexes) {
                const row = data[rowIdx];
                // Sentence 1
                const text1 = row[idxSentence1];
                if (text1) {
                    const filename1 = makeAudioFilename(row[idxEnglish], 1);
                    const mp3Blob1 = await generateTTS(text1, model, voice, instructions);
                    mp3Files.push({filename: filename1, blob: mp3Blob1});
                    row[idxAudio1] = `[sound:${filename1}]`;
                }
                // Sentence 2
                const text2 = row[idxSentence2];
                if (text2) {
                    const filename2 = makeAudioFilename(row[idxEnglish], 2);
                    const mp3Blob2 = await generateTTS(text2, model, voice, instructions);
                    mp3Files.push({filename: filename2, blob: mp3Blob2});
                    row[idxAudio2] = `[sound:${filename2}]`;
                }
            }
            // Update table UI
            if (window.displayData) displayData(data);
            // Create ZIP and trigger download
            await downloadZip(mp3Files);
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

    function makeAudioFilename(english, which) {
        const base = (english || 'audio').replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 30);
        const rand = Math.floor(Math.random() * 90000 + 10000);
        return `${base}_s${which}_${rand}.mp3`;
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
})();
