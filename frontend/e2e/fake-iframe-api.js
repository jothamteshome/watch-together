// Served in place of https://www.youtube.com/iframe_api so the browser suite runs offline and deterministically.
// Mimics the parts of YT.Player the app uses and exposes window.__yt so tests can read and drive the player.
(() => {
    const PlayerState = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };
    const players = [];

    class Player {
        constructor(containerId, options) {
            this.options = options;
            this.videoId = null;
            this.state = PlayerState.UNSTARTED;
            this.rate = 1;
            this.position = 0;
            this.since = Date.now();
            this.loads = [];

            // The real API swaps the container for an iframe; swap it for a labelled box instead
            const container = document.getElementById(containerId);
            this.element = document.createElement("div");
            this.element.id = containerId;
            this.element.className = container.className;
            this.element.style.cssText = "background:#333;color:#ccc;display:flex;align-items:center;justify-content:center;font:14px monospace";
            container.replaceWith(this.element);

            players.push(this);
            setTimeout(() => options.events?.onReady?.({ target: this }), 0);
        }

        getCurrentTime() {
            if (this.state !== PlayerState.PLAYING) return this.position;
            return this.position + (Date.now() - this.since) / 1000 * this.rate;
        }

        getPlaybackRate() { return this.rate; }
        getPlayerState() { return this.state; }

        loadVideoById(videoId, startSeconds = 0) {
            this.loads.push({ videoId, startSeconds });
            this.videoId = videoId;
            this.element.textContent = videoId;
            this.position = startSeconds;
            this.since = Date.now();
            // Autoplay is allowed unless a test blocks it, as browsers do in a tab the user hasn't interacted with
            this.setState(window.__ytAutoplayBlocked ? PlayerState.PAUSED : PlayerState.PLAYING);
        }

        seekTo(seconds) {
            this.position = seconds;
            this.since = Date.now();
        }

        setPlaybackRate(rate) {
            this.position = this.getCurrentTime();
            this.since = Date.now();
            this.rate = rate;
        }

        playVideo() {
            // While autoplay is blocked, script can't start playback; only the user can (__yt.play)
            if (window.__ytAutoplayBlocked) return;
            this.setState(PlayerState.PLAYING);
        }
        pauseVideo() { this.setState(PlayerState.PAUSED); }
        destroy() {}

        /** Moves to `state` and, like the real player, reports the change asynchronously */
        setState(state) {
            this.position = this.getCurrentTime();
            this.since = Date.now();
            if (this.state === state) return;
            this.state = state;
            setTimeout(() => this.options.events?.onStateChange?.({ target: this, data: state }), 0);
        }
    }

    window.YT = { Player, PlayerState };

    const current = () => players.at(-1);
    window.__yt = {
        snapshot() {
            const player = current();
            if (!player) return null;
            return { videoId: player.videoId, state: player.state, time: player.getCurrentTime(), loads: player.loads };
        },
        // What the user does in the YouTube UI: state changes the app didn't ask for. A user's
        // click also counts as the interaction that lifts the browser's autoplay block
        play() {
            window.__ytAutoplayBlocked = false;
            current().setState(PlayerState.PLAYING);
        },
        pause() { current().setState(PlayerState.PAUSED); },
        end() { current().setState(PlayerState.ENDED); }
    };

    window.onYouTubeIframeAPIReady?.();
})();
