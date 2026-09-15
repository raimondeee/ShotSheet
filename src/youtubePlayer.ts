/**
 * YouTube IFrame API wrapper for ShotSheet live marking.
 * Controls stay outside the iframe (YouTube ToS).
 */

/* Loose YT globals so tsc passes without @types/youtube */
declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export type YtPlayerHandle = {
  getCurrentTime(): number;
  pause(): void;
  play(): void;
  seekTo(sec: number): void;
  destroy(): void;
  getVideoData?: () => { video_id?: string };
};

export type CreatePlayerOpts = {
  onReady?: (player: YtPlayerHandle) => void;
  onError?: (code: number) => void;
  origin?: string;
};

let apiLoadPromise: Promise<void> | null = null;

/** Extract video id from watch?v=, youtu.be/, embed/, shorts/ */
export function extractYoutubeId(url: string | undefined | null): string | null {
  if (!url) return null;
  const raw = url.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return id && /^[\w-]{6,}$/.test(id) ? id : null;
    }
    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      if (u.pathname.startsWith('/embed/') || u.pathname.startsWith('/shorts/')) {
        const id = u.pathname.split('/').filter(Boolean)[1];
        return id && /^[\w-]{6,}$/.test(id) ? id : null;
      }
      const v = u.searchParams.get('v');
      if (v && /^[\w-]{6,}$/.test(v)) return v;
    }
  } catch {
    /* fall through */
  }
  const m = raw.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|shorts\/|watch\?.*?v=))([\w-]{6,})/,
  );
  return m?.[1] ?? null;
}

function loadIframeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.YT?.Player) return Promise.resolve();
  if (apiLoadPromise) return apiLoadPromise;

  apiLoadPromise = new Promise<void>((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      try {
        prev?.();
      } catch {
        /* ignore */
      }
      resolve();
    };

    if (document.querySelector('script[data-yt-iframe-api]')) {
      // Script already injected; wait for callback or poll
      const start = Date.now();
      const poll = () => {
        if (window.YT?.Player) {
          resolve();
          return;
        }
        if (Date.now() - start > 20000) {
          reject(new Error('YouTube IFrame API timeout'));
          return;
        }
        requestAnimationFrame(poll);
      };
      poll();
      return;
    }

    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.dataset.ytIframeApi = '1';
    s.onerror = () => {
      apiLoadPromise = null;
      reject(new Error('Failed to load YouTube IFrame API'));
    };
    document.head.appendChild(s);

    window.setTimeout(() => {
      if (!window.YT?.Player) {
        apiLoadPromise = null;
        reject(new Error('YouTube IFrame API timeout'));
      }
    }, 20000);
  });

  return apiLoadPromise;
}

function wrapPlayer(raw: any): YtPlayerHandle {
  return {
    getCurrentTime() {
      try {
        const t = raw?.getCurrentTime?.();
        return typeof t === 'number' && !Number.isNaN(t) ? t : 0;
      } catch {
        return 0;
      }
    },
    pause() {
      try {
        raw?.pauseVideo?.();
      } catch {
        /* ignore */
      }
    },
    play() {
      try {
        raw?.playVideo?.();
      } catch {
        /* ignore */
      }
    },
    seekTo(sec: number) {
      try {
        raw?.seekTo?.(Math.max(0, sec), true);
      } catch {
        /* ignore */
      }
    },
    destroy() {
      try {
        raw?.destroy?.();
      } catch {
        /* ignore */
      }
    },
    getVideoData() {
      try {
        return raw?.getVideoData?.() ?? {};
      } catch {
        return {};
      }
    },
  };
}

/**
 * Create a YT.Player inside `el` (should be an empty div).
 * Loads the iframe API once.
 */
export async function createPlayer(
  el: HTMLElement,
  videoId: string,
  opts: CreatePlayerOpts = {},
): Promise<YtPlayerHandle> {
  await loadIframeApi();
  if (!window.YT?.Player) throw new Error('YouTube API unavailable');

  const origin =
    opts.origin ||
    (typeof location !== 'undefined' ? location.origin : undefined);

  return new Promise<YtPlayerHandle>((resolve, reject) => {
    let settled = false;
    let handle: YtPlayerHandle | null = null;

    try {
      // Clear previous iframe children
      el.innerHTML = '';
      const target = document.createElement('div');
      el.appendChild(target);

      const player = new window.YT.Player(target, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          enablejsapi: 1,
          origin,
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          // Controls stay in YouTube chrome; our app controls are outside
          controls: 1,
          fs: 1,
        },
        events: {
          onReady: () => {
            handle = wrapPlayer(player);
            settled = true;
            opts.onReady?.(handle);
            resolve(handle);
          },
          onError: (ev: { data?: number }) => {
            const code = ev?.data ?? -1;
            opts.onError?.(code);
            if (!settled) {
              settled = true;
              reject(new Error(`YouTube player error ${code}`));
            }
          },
        },
      });
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}
