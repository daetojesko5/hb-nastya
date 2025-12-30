(() => {
  "use strict";

  // Playlist: add/remove files here.
  // Nothing is loaded until window.startBackgroundAudio() is called.
  const PLAYLIST = [
    "audio/id_b.mp3",
    "audio/lp_s.mp3",
    "audio/ss_m.mp3",
    "audio/21_i.mp3",
    "audio/bi_bof.mp3",
    "audio/21_ps.mp3",
  ];

  async function init() {
    if (!Array.isArray(PLAYLIST) || PLAYLIST.length === 0) {
      console.warn("PLAYLIST is empty; skipping music.");
      return;
    }

    let index = 0;
    let armed = false;
    let starting = false;
    let lastSrc = null;

    /** @type {HTMLAudioElement | null} */
    let audioEl = null;

    function getOrCreateAudio() {
      if (audioEl) return audioEl;

      const host = document.createElement("div");
      host.id = "bg-audio";
      host.style.display = "none";

      audioEl = document.createElement("audio");
      audioEl.preload = "none";
      audioEl.controls = false;

      host.appendChild(audioEl);
      document.body.appendChild(host);

      audioEl.addEventListener("ended", nextTrack);
      audioEl.addEventListener("error", nextTrack);

      return audioEl;
    }

    async function playCurrent() {
      const el = getOrCreateAudio();
      const src = PLAYLIST[index];

      // Reset + set source only when needed.
      if (lastSrc !== src) {
        el.pause();
        el.removeAttribute("src");
        el.load();
        el.src = src;
        lastSrc = src;
      }

      try {
        await el.play();
      } catch (e) {
        console.warn("Playback failed", e);
        throw e;
      }
    }

    function nextTrack() {
      index = (index + 1) % PLAYLIST.length;
      if (armed) {
        void tryPlay();
      }
    }

    async function tryPlay() {
      if (starting) return;
      starting = true;
      try {
        await playCurrent();
      } catch {
        // If playback is blocked or file missing, we just stop advancing.
      } finally {
        starting = false;
      }
    }

    // Expose explicit start hook; marker click is a user gesture so playback should be allowed.
    window.startBackgroundAudio = () => {
      armed = true;
      void tryPlay();
    };

    document.addEventListener("start-background-audio", () => {
      armed = true;
      void tryPlay();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    void init();
  }
})();
