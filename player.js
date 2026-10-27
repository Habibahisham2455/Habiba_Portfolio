/* =========================================================
   Video cards + theater player + contact copy button
   ========================================================= */
(function () {
    'use strict';

    var FPS = 24;
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function mmss(t) {
        if (!isFinite(t) || t < 0) t = 0;
        return pad(Math.floor(t / 60)) + ':' + pad(Math.floor(t % 60));
    }
    function timecode(t) {
        if (!isFinite(t) || t < 0) t = 0;
        var h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = Math.floor(t % 60);
        var f = Math.floor((t % 1) * FPS);
        return pad(h) + ':' + pad(m) + ':' + pad(s) + ':' + pad(f);
    }
    function $(id) { return document.getElementById(id); }

    var cards = Array.prototype.slice.call(document.querySelectorAll('.video-card'));

    function cardData(card) {
        var v = card.querySelector('video');
        var src = card.querySelector('source');
        var tag = card.querySelector('.clip-tag');
        return {
            title: (card.querySelector('.video-title') || {}).textContent || '',
            date: ((card.querySelector('.video-info h4') || {}).textContent || '').replace(/^Date:\s*/i, ''),
            desc: (card.querySelector('.video-description') || {}).textContent || '',
            tag: tag ? tag.textContent : '',
            src: src ? src.getAttribute('src') : (v ? v.getAttribute('src') : ''),
            poster: v ? v.getAttribute('poster') : '',
            wide: card.classList.contains('horizontal')
        };
    }

    /* ---------- Turn cards into thumbnails ---------- */
    cards.forEach(function (card) {
        var v = card.querySelector('video');
        if (!v) return;
        var d = cardData(card);

        v.removeAttribute('controls');
        v.muted = true;
        v.setAttribute('playsinline', '');
        v.setAttribute('tabindex', '-1');

        var thumb = document.createElement('div');
        thumb.className = 'thumb';
        thumb.setAttribute('role', 'button');
        thumb.setAttribute('tabindex', '0');
        thumb.setAttribute('aria-label', 'Play video: ' + d.title);
        v.parentNode.insertBefore(thumb, v);
        thumb.appendChild(v);
        thumb.insertAdjacentHTML('beforeend',
            '<span class="thumb-shade"></span>' +
            '<span class="thumb-play"><svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="7,4 20,12 7,20"/></svg></span>' +
            '<span class="thumb-dur" hidden></span>' +
            '<span class="thumb-cta">Watch</span>');

        var dur = thumb.querySelector('.thumb-dur');
        v.addEventListener('loadedmetadata', function () {
            if (isFinite(v.duration) && v.duration > 0) {
                dur.textContent = mmss(v.duration);
                dur.hidden = false;
            }
        });

        function open(e) { if (e) e.preventDefault(); openTheater(card); }
        thumb.addEventListener('click', open);
        thumb.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') open(e);
        });
        var title = card.querySelector('.video-title');
        if (title) title.addEventListener('click', open);
    });

    /* ---------- Clip counter ---------- */
    function updateCount() {
        var el = $('clipCount');
        if (!el) return;
        var n = document.querySelectorAll('#verticalGrid .video-card:not(.hide)').length;
        el.textContent = n + (n === 1 ? ' clip' : ' clips');
    }
    document.querySelectorAll('.chip').forEach(function (c) {
        c.addEventListener('click', function () { setTimeout(updateCount, 0); });
    });
    updateCount();

    /* ---------- Theater ---------- */
    var theater = $('theater');
    if (theater) initTheater();

    function initTheater() {
        var stage = $('theaterStage');
        var video = $('theaterVideo');
        var bar = $('playerBar');
        var pb = $('pb'), pbBuf = $('pbBuf'), pbFill = $('pbFill'), pbKnob = $('pbKnob'), pbTip = $('pbTip');
        var pcTime = $('pcTime'), hudTime = $('hudTime');
        var msg = $('playerMsg');
        var list = [], index = 0, lastFocus = null, idleTimer = null, dragging = false;
        var speeds = [1, 1.5, 2, 0.5], speedIdx = 0;

        window.openTheater = function (card) {
            list = cards.filter(function (c) { return !c.classList.contains('hide') && c.querySelector('video'); });
            index = Math.max(0, list.indexOf(card));
            lastFocus = document.activeElement;
            theater.hidden = false;
            document.body.classList.add('no-scroll');
            load(index);
            $('theaterClose').focus();
        };

        function close() {
            video.pause();
            video.removeAttribute('src');
            video.load();
            theater.hidden = true;
            document.body.classList.remove('no-scroll');
            if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
            if (lastFocus && lastFocus.focus) lastFocus.focus();
        }

        function setRatio(r) {
            r = Math.min(2, Math.max(0.5, r || 1));
            stage.style.setProperty('--ar', r);
        }

        function load(i) {
            index = (i + list.length) % list.length;
            var card = list[index];
            var d = cardData(card);

            stage.classList.remove('unavailable');
            msg.hidden = true;
            stage.classList.add('paused');
            setRatio(d.wide ? 16 / 9 : 1);
            setProgress(0, 0);

            video.pause();
            video.poster = d.poster || '';
            stage.parentNode.style.setProperty('--tbg', d.poster ? 'url("' + d.poster + '")' : 'none');
            video.src = d.src;
            video.playbackRate = speeds[speedIdx];
            video.load();
            var p = video.play();
            if (p && p.catch) p.catch(function () { /* autoplay blocked: user presses play */ });

            $('tSeq').textContent = 'CLIP ' + pad(index + 1) + ' / ' + pad(list.length);
            $('tTag').textContent = d.tag;
            $('tTitle').textContent = d.title;
            $('tDate').textContent = d.date;
            $('tDesc').textContent = d.desc;
            $('theater').setAttribute('aria-label', 'Video player: ' + d.title);
            renderUpNext();
            wake();
        }

        function renderUpNext() {
            var box = $('upNext');
            box.innerHTML = '';
            var n = Math.min(3, list.length - 1);
            for (var k = 1; k <= n; k++) {
                (function (idx) {
                    var d = cardData(list[idx]);
                    var b = document.createElement('button');
                    b.type = 'button';
                    b.className = 'un-item' + (d.wide ? ' wide' : '');
                    var img = document.createElement('img');
                    img.src = d.poster; img.alt = ''; img.loading = 'lazy';
                    var meta = document.createElement('span');
                    meta.className = 'un-meta';
                    var t = document.createElement('b'); t.textContent = d.title;
                    var s = document.createElement('span'); s.textContent = d.date;
                    meta.appendChild(t); meta.appendChild(s);
                    b.appendChild(img); b.appendChild(meta);
                    b.addEventListener('click', function () { load(idx); });
                    box.appendChild(b);
                })((index + k) % list.length);
            }
            box.parentNode.hidden = n === 0;
        }

        /* --- play / pause --- */
        function toggle() {
            if (stage.classList.contains('unavailable')) return;
            if (video.paused || video.ended) {
                var p = video.play();
                if (p && p.catch) p.catch(function () {});
            } else {
                video.pause();
            }
        }
        video.addEventListener('play', function () { stage.classList.remove('paused'); wake(); });
        video.addEventListener('pause', function () { stage.classList.add('paused'); wake(); });
        video.addEventListener('ended', function () { stage.classList.add('paused'); });
        video.addEventListener('click', toggle);
        $('bigPlay').addEventListener('click', toggle);
        $('pcPlay').addEventListener('click', toggle);

        /* --- loading / errors --- */
        video.addEventListener('loadedmetadata', function () {
            if (video.videoWidth && video.videoHeight) setRatio(video.videoWidth / video.videoHeight);
            updateTime();
        });
        video.addEventListener('error', function () {
            if (!video.getAttribute('src')) return;     // fired after we cleared it on close
            stage.classList.add('unavailable', 'paused');
            msg.hidden = false;
        });

        /* --- progress --- */
        function setProgress(cur, dur) {
            var pct = dur > 0 ? Math.min(100, (cur / dur) * 100) : 0;
            pbFill.style.width = pct + '%';
            pbKnob.style.left = pct + '%';
            pb.setAttribute('aria-valuenow', Math.round(pct));
        }
        function updateTime() {
            setProgress(video.currentTime, video.duration);
            pcTime.textContent = mmss(video.currentTime) + ' / ' + mmss(video.duration);
            hudTime.textContent = timecode(video.currentTime);
        }
        video.addEventListener('timeupdate', updateTime);
        video.addEventListener('durationchange', updateTime);
        video.addEventListener('progress', function () {
            try {
                if (video.buffered.length && video.duration) {
                    var end = video.buffered.end(video.buffered.length - 1);
                    pbBuf.style.width = Math.min(100, (end / video.duration) * 100) + '%';
                }
            } catch (e) { /* ignore */ }
        });

        function seekFromEvent(e) {
            var r = pb.getBoundingClientRect();
            var x = Math.min(r.width, Math.max(0, e.clientX - r.left));
            var ratio = r.width ? x / r.width : 0;
            if (video.duration) {
                video.currentTime = ratio * video.duration;
                updateTime();
            }
            return ratio;
        }
        pb.addEventListener('pointerdown', function (e) {
            dragging = true;
            pb.classList.add('dragging');
            pb.setPointerCapture(e.pointerId);
            seekFromEvent(e);
        });
        pb.addEventListener('pointermove', function (e) {
            var r = pb.getBoundingClientRect();
            var x = Math.min(r.width, Math.max(0, e.clientX - r.left));
            pbTip.style.left = x + 'px';
            pbTip.textContent = mmss(r.width && video.duration ? (x / r.width) * video.duration : 0);
            if (dragging) seekFromEvent(e);
        });
        function endDrag() { dragging = false; pb.classList.remove('dragging'); }
        pb.addEventListener('pointerup', endDrag);
        pb.addEventListener('pointercancel', endDrag);
        pb.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowLeft') { video.currentTime = Math.max(0, video.currentTime - 5); e.preventDefault(); e.stopPropagation(); }
            if (e.key === 'ArrowRight') { video.currentTime = Math.min(video.duration || 0, video.currentTime + 5); e.preventDefault(); e.stopPropagation(); }
        });

        /* --- mute / speed / fullscreen --- */
        function toggleMute() {
            video.muted = !video.muted;
            stage.classList.toggle('muted', video.muted);
        }
        $('pcMute').addEventListener('click', toggleMute);
        $('pcSpeed').addEventListener('click', function () {
            speedIdx = (speedIdx + 1) % speeds.length;
            video.playbackRate = speeds[speedIdx];
            this.innerHTML = speeds[speedIdx] + '&times;';
        });
        function toggleFs() {
            if (document.fullscreenElement || document.webkitFullscreenElement) {
                (document.exitFullscreen || document.webkitExitFullscreen).call(document);
            } else if (stage.requestFullscreen) {
                stage.requestFullscreen();
            } else if (stage.webkitRequestFullscreen) {
                stage.webkitRequestFullscreen();
            } else if (video.webkitEnterFullscreen) {
                video.webkitEnterFullscreen();     // iOS Safari
            }
        }
        $('pcFs').addEventListener('click', toggleFs);
        video.addEventListener('dblclick', toggleFs);

        /* --- auto-hide controls while playing --- */
        function wake() {
            stage.classList.remove('idle');
            clearTimeout(idleTimer);
            idleTimer = setTimeout(function () { stage.classList.add('idle'); }, 2600);
        }
        stage.addEventListener('pointermove', wake);
        stage.addEventListener('pointerdown', wake);

        /* --- navigation + closing --- */
        $('tPrev').addEventListener('click', function () { load(index - 1); });
        $('tNext').addEventListener('click', function () { load(index + 1); });
        theater.addEventListener('click', function (e) {
            if (e.target.closest && e.target.closest('[data-close]')) close();
        });

        document.addEventListener('keydown', function (e) {
            if (theater.hidden) return;
            var tag = (e.target && e.target.tagName) || '';
            var onButton = tag === 'BUTTON' || tag === 'A';
            switch (e.key) {
                case 'Escape': close(); break;
                case ' ':
                case 'k': if (!onButton || e.key === 'k') { e.preventDefault(); toggle(); } break;
                case 'ArrowLeft': video.currentTime = Math.max(0, video.currentTime - 5); wake(); break;
                case 'ArrowRight': video.currentTime = Math.min(video.duration || 0, video.currentTime + 5); wake(); break;
                case '[': load(index - 1); break;
                case ']': load(index + 1); break;
                case 'm': case 'M': toggleMute(); break;
                case 'f': case 'F': toggleFs(); break;
                case 'Tab': trapFocus(e); break;
            }
        });

        function trapFocus(e) {
            var f = theater.querySelectorAll('button:not([disabled]), [tabindex="0"], a[href]');
            f = Array.prototype.filter.call(f, function (n) { return n.offsetParent !== null; });
            if (!f.length) return;
            var first = f[0], last = f[f.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
    }

    /* ---------- Copy email ---------- */
    var copyBtn = $('copyEmail');
    if (copyBtn) {
        copyBtn.addEventListener('click', function () {
            var text = copyBtn.getAttribute('data-copy');
            var label = copyBtn.querySelector('span');
            function done() {
                copyBtn.classList.add('copied');
                label.textContent = 'Copied!';
                setTimeout(function () { copyBtn.classList.remove('copied'); label.textContent = 'Copy Email'; }, 1800);
            }
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(done, fallback);
            } else { fallback(); }
            function fallback() {
                var ta = document.createElement('textarea');
                ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
                document.body.appendChild(ta); ta.select();
                try { document.execCommand('copy'); done(); } catch (e) { /* ignore */ }
                document.body.removeChild(ta);
            }
        });
    }
})();
