import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Encode Float32 PCM chunks to a WAV Blob (16-bit mono).
function encodeWav(chunks: Float32Array[], sampleRate: number): Blob {
  const targetRate = 16000;
  // simple downsample
  const totalIn = chunks.reduce((s, c) => s + c.length, 0);
  const flat = new Float32Array(totalIn);
  let off = 0;
  for (const c of chunks) { flat.set(c, off); off += c.length; }
  const ratio = sampleRate / targetRate;
  const outLen = Math.floor(flat.length / ratio);
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const s = flat[Math.floor(i * ratio)] || 0;
    out[i] = Math.max(-32768, Math.min(32767, s * 32767));
  }
  const buffer = new ArrayBuffer(44 + out.length * 2);
  const view = new DataView(buffer);
  const wr = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  wr(0, "RIFF"); view.setUint32(4, 36 + out.length * 2, true); wr(8, "WAVE");
  wr(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, targetRate, true); view.setUint32(28, targetRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  wr(36, "data"); view.setUint32(40, out.length * 2, true);
  const bytes = new Uint8Array(buffer, 44);
  const view16 = new DataView(buffer, 44);
  for (let i = 0; i < out.length; i++) view16.setInt16(i * 2, out[i], true);
  void bytes;
  return new Blob([buffer], { type: "audio/wav" });
}

export function useVoiceRecorder(onTranscript: (text: string) => void) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const stateRef = useRef<{ ctx: AudioContext; stream: MediaStream; node: ScriptProcessorNode; source: MediaStreamAudioSourceNode; pcm: Float32Array[] } | null>(null);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const node = ctx.createScriptProcessor(4096, 1, 1);
      const pcm: Float32Array[] = [];
      node.onaudioprocess = (e) => pcm.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      source.connect(node); node.connect(ctx.destination);
      stateRef.current = { ctx, stream, node, source, pcm };
      setRecording(true);
    } catch {
      toast.error("Acesso ao microfone negado");
    }
  };

  const stop = async () => {
    const st = stateRef.current;
    stateRef.current = null;
    setRecording(false);
    if (!st) return;
    st.stream.getTracks().forEach(t => t.stop());
    st.node.disconnect(); st.source.disconnect();
    const blob = encodeWav(st.pcm, st.ctx.sampleRate);
    await st.ctx.close();
    if (blob.size < 2048) { toast.error("Áudio muito curto"); return; }
    setProcessing(true);
    try {
      const form = new FormData();
      form.append("file", blob, "recording.wav");
      const { data, error } = await supabase.functions.invoke("voice-transcribe", { body: form });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.text) onTranscript(data.text);
    } catch (e: any) {
      toast.error("Falha na transcrição", { description: e.message });
    } finally {
      setProcessing(false);
    }
  };

  const toggle = () => (recording ? stop() : start());
  return { recording, processing, toggle };
}
