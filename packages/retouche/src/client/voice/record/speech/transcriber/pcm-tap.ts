const TARGET_RATE = 16_000;
const WORKLET_NAME = "retouche-pcm";
const BASE64_CHUNK = 0x80_00;
const FULL_SCALE = 0x7f_ff;

const WORKLET_SOURCE = `registerProcessor("${WORKLET_NAME}", class extends AudioWorkletProcessor {
  buffer = new Float32Array(2048);
  length = 0;
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    if (this.length + channel.length > this.buffer.length) {
      this.port.postMessage(this.buffer.slice(0, this.length));
      this.length = 0;
    }
    this.buffer.set(channel, this.length);
    this.length += channel.length;
    return true;
  }
});`;

export interface PcmTap {
  close: () => void;
  keepLast: (ms: number) => void;
  sampleRate: number;
  take: () => string;
}

function toPcm(samples: Float32Array, ratio: number): Int16Array {
  const pcm = new Int16Array(Math.floor(samples.length / ratio));
  for (let index = 0; index < pcm.length; index++) {
    const from = Math.floor(index * ratio);
    const to = Math.floor((index + 1) * ratio);
    let sum = 0;
    for (const sample of samples.subarray(from, to)) {
      sum += sample;
    }
    const mean = sum / Math.max(1, to - from);
    pcm[index] = Math.round(Math.max(-1, Math.min(1, mean)) * FULL_SCALE);
  }
  return pcm;
}

function base64Of(chunks: readonly Int16Array[]): string {
  const pcm = new Int16Array(
    chunks.reduce((sum, { length }) => sum + length, 0)
  );
  let offset = 0;
  for (const chunk of chunks) {
    pcm.set(chunk, offset);
    offset += chunk.length;
  }
  const bytes = new Uint8Array(pcm.buffer);
  let binary = "";
  for (let start = 0; start < bytes.length; start += BASE64_CHUNK) {
    binary += String.fromCodePoint(
      ...bytes.subarray(start, start + BASE64_CHUNK)
    );
  }
  return btoa(binary);
}

async function loadWorklet(context: AudioContext): Promise<void> {
  const url = URL.createObjectURL(
    new Blob([WORKLET_SOURCE], { type: "text/javascript" })
  );
  try {
    await context.audioWorklet.addModule(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function openPcmTap(stream: MediaStream): Promise<PcmTap> {
  const context = new AudioContext();
  try {
    await loadWorklet(context);
  } catch (error) {
    void Promise.allSettled([context.close()]);
    throw error;
  }
  const node = new AudioWorkletNode(context, WORKLET_NAME, {
    numberOfOutputs: 0,
  });
  const sampleRate = Math.min(context.sampleRate, TARGET_RATE);
  const ratio = context.sampleRate / sampleRate;
  let chunks: Int16Array[] = [];
  node.port.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (event.data instanceof Float32Array) {
      chunks.push(toPcm(event.data, ratio));
    }
  });
  node.port.start();
  context.createMediaStreamSource(stream).connect(node);
  const waking = context.resume();
  return {
    close: () => {
      node.port.close();
      void Promise.allSettled([waking, context.close()]);
    },
    keepLast: (ms) => {
      let excess = chunks.reduce((sum, { length }) => sum + length, 0);
      excess -= Math.round((ms / 1000) * sampleRate);
      while (chunks[0] && excess >= chunks[0].length) {
        excess -= chunks[0].length;
        chunks.shift();
      }
    },
    sampleRate,
    take: () => {
      const taken = base64Of(chunks);
      chunks = [];
      return taken;
    },
  };
}
