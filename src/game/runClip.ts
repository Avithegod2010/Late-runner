/**
 * Rolling canvas recorder. Keeps the first WebM init/header chunk plus only the
 * most recent timed clusters, limiting memory while preserving a playable file.
 * The exact MIME is selected by the browser; Safari may choose MP4.
 */
export class RunClipRecorder {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private header: Blob | null = null;
  private recent: { blob: Blob; at: number }[] = [];
  private startedAt = 0;
  private stopResolve: ((blob: Blob | null) => void) | null = null;
  private maxSeconds = 10;

  static supported() {
    return typeof MediaRecorder !== "undefined" &&
      typeof HTMLCanvasElement !== "undefined" &&
      "captureStream" in HTMLCanvasElement.prototype;
  }

  start(canvas: HTMLCanvasElement, maxSeconds = 10) {
    this.abort();
    if (!RunClipRecorder.supported()) return false;
    try {
      this.maxSeconds = maxSeconds;
      this.header = null;
      this.recent = [];
      this.startedAt = performance.now();
      this.stream = canvas.captureStream(30);
      const mime = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
        "video/mp4",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      this.recorder = new MediaRecorder(this.stream, mime ? {
        mimeType: mime,
        videoBitsPerSecond: 1_800_000,
      } : { videoBitsPerSecond: 1_800_000 });
      this.recorder.ondataavailable = (event) => {
        if (!event.data.size) return;
        const now = performance.now();
        if (!this.header) {
          // The first chunk carries the WebM/MP4 initialization metadata.
          this.header = event.data;
          return;
        }
        this.recent.push({ blob: event.data, at: now });
        const cutoff = now - this.maxSeconds * 1000;
        while (this.recent.length > 1 && this.recent[0].at < cutoff) this.recent.shift();
      };
      this.recorder.onstop = () => {
        const pieces = [this.header, ...this.recent.map((x) => x.blob)].filter(Boolean) as Blob[];
        const type = this.recorder?.mimeType || pieces[0]?.type || "video/webm";
        const blob = pieces.length ? new Blob(pieces, { type }) : null;
        this.stream?.getTracks().forEach((track) => track.stop());
        this.stream = null;
        this.recorder = null;
        this.stopResolve?.(blob);
        this.stopResolve = null;
      };
      this.recorder.start(500);
      return true;
    } catch {
      this.abort();
      return false;
    }
  }

  stop(): Promise<Blob | null> {
    if (!this.recorder || this.recorder.state === "inactive") return Promise.resolve(null);
    const recorder = this.recorder;
    return new Promise((resolve) => {
      this.stopResolve = resolve;
      try {
        recorder.requestData();
        recorder.stop();
      } catch {
        this.abort();
        resolve(null);
      }
    });
  }

  abort() {
    if (this.recorder && this.recorder.state !== "inactive") {
      this.recorder.onstop = null;
      try { this.recorder.stop(); } catch { /* already stopped */ }
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    this.recorder = null;
    this.stream = null;
    this.header = null;
    this.recent = [];
    this.stopResolve?.(null);
    this.stopResolve = null;
  }

  get recording() {
    return !!this.recorder && this.recorder.state === "recording";
  }

  get elapsed() {
    return this.recording ? (performance.now() - this.startedAt) / 1000 : 0;
  }
}

export function downloadClip(blob: Blob) {
  const ext = blob.type.includes("mp4") ? "mp4" : "webm";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `wrong-way-rider-last-10s.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export async function shareClip(blob: Blob) {
  const ext = blob.type.includes("mp4") ? "mp4" : "webm";
  const file = new File([blob], `wrong-way-rider-last-10s.${ext}`, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Wrong Way Rider", text: "My last 10 seconds in Wrong Way Rider" });
      return;
    } catch { /* cancelled or unavailable: download instead */ }
  }
  downloadClip(blob);
}