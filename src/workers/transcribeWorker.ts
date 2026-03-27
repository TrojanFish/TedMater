import { pipeline, env } from '@huggingface/transformers';

// Use HuggingFace Hub with Cache API storage
env.allowLocalModels = false;

// whisper-tiny.en q4f16: ~40MB, native chunking, no manual OOM workaround needed
const MODEL_ID = 'onnx-community/whisper-tiny.en_timestamped';

let transcriber: any = null;

function onProgress(p: any) {
    if (p.status === 'downloading' && p.total) {
        const pct = Math.round((p.loaded / p.total) * 100);
        self.postMessage({ status: 'loading', message: `正在下载模型... ${pct}% (${Math.round(p.loaded / 1024 / 1024)}MB / ${Math.round(p.total / 1024 / 1024)}MB)` });
    } else if (p.status === 'loading') {
        self.postMessage({ status: 'loading', message: '正在加载模型到内存...' });
    }
}

async function getTranscriber() {
    if (transcriber) return transcriber;

    self.postMessage({ status: 'loading', message: '正在初始化 AI 引擎 (首次启动需下载 ~40MB)...' });

    try {
        // WebGPU: q4f16 — smallest + fastest
        try {
            transcriber = await pipeline('automatic-speech-recognition', MODEL_ID, {
                device: 'webgpu',
                dtype: 'q4f16',
                progress_callback: onProgress,
            });
        } catch (gpuErr) {
            console.warn('WebGPU failed, falling back to WASM:', gpuErr);
            // WASM: q8 — better compatibility than q4f16 on CPU
            transcriber = await pipeline('automatic-speech-recognition', MODEL_ID, {
                device: 'wasm',
                dtype: 'q8',
                progress_callback: onProgress,
            });
        }

        self.postMessage({ status: 'ready', message: 'AI 转录引擎就绪' });
        return transcriber;
    } catch (error: any) {
        throw new Error('模型加载失败: ' + error.message);
    }
}

self.onmessage = async (e: MessageEvent) => {
    const { type, audio } = e.data;

    if (type === 'transcribe') {
        try {
            const pipe = await getTranscriber();

            self.postMessage({ status: 'processing', message: 'AI 正在转录语音内容...' });

            // Whisper handles chunking internally via chunk_length_s / stride_length_s
            // stride provides overlap so sentences at chunk boundaries aren't cut off
            const result = await pipe(audio, {
                return_timestamps: true,
                chunk_length_s: 30,
                stride_length_s: 5,
            });

            let transcript: any[];
            const idBase = Date.now();

            if (result.chunks && result.chunks.length > 0) {
                transcript = result.chunks.map((c: any, i: number) => ({
                    id: idBase + i,
                    startTime: Math.round((c.timestamp?.[0] ?? 0) * 1000),
                    english: c.text.trim(),
                    translated: '',
                }));
            } else {
                transcript = [{
                    id: idBase,
                    startTime: 0,
                    english: (result.text ?? '').trim(),
                    translated: '',
                }];
            }

            self.postMessage({ status: 'done', transcript });
        } catch (error: any) {
            self.postMessage({ status: 'error', message: error.message });
        }
    }
};
