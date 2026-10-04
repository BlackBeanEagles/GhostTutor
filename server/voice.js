// ElevenLabs voice. When no key is set the browser's own speech APIs take over.
import { config } from './config.js';
import { traced } from './tracing.js';

export const voiceOn = () => Boolean(config.elevenKey);

export async function tts(text) {
  return traced('ghost.elevenlabs.tts', { chars: text.length }, async () => {
    const r = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${config.elevenVoice}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: { 'xi-api-key': config.elevenKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 800), model_id: 'eleven_flash_v2_5' }),
      },
    );
    if (!r.ok) throw new Error(`ElevenLabs TTS ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  });
}

export async function stt(buffer, mime = 'audio/webm') {
  return traced('ghost.elevenlabs.stt', { bytes: buffer.length }, async () => {
    const form = new FormData();
    form.append('model_id', 'scribe_v1');
    form.append('file', new Blob([buffer], { type: mime }), 'answer.webm');
    const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': config.elevenKey },
      body: form,
    });
    if (!r.ok) throw new Error(`ElevenLabs STT ${r.status}`);
    return (await r.json()).text ?? '';
  });
}
