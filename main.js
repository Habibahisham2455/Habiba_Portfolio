(function () {
    'use strict';

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var FPS = 24;

    function pad(n, l) { n = String(n); while (n.length < (l || 2)) n = '0' + n; return n; }
    function timecode(totalSeconds) {
        var s = Math.max(0, totalSeconds);
        var h = Math.floor(s / 3600);
        var m = Math.floor((s % 3600) / 60);
        var sec = Math.floor(s % 60);
        var f = Math.floor((s % 1) * FPS);
        return pad(h) + ':' + pad(m) + ':' + pad(sec) + ':' + pad(f);
    }

    /* ---------- Handwritten signature ---------- */
    function buildSignature() {
        var svg = document.getElementById('sig');
        if (!svg) return;
        var base = document.getElementById('sigBase');
        var group = document.getElementById('sigLetters');
        var ns = 'http://www.w3.org/2000/svg';

        function run() {
            try {
                var str = base.textContent;
                var idx = 0;
                for (var i = 0; i < str.length; i++) {
                    var ch = str.charAt(i);
                    if (ch === ' ') continue;
                    var p = base.getStartPositionOfChar(i);
                    var t = document.createElementNS(ns, 'text');
                    t.setAttribute('x', p.x);
                    t.setAttribute('y', p.y);
                    t.setAttribute('class', 'sig-letter');
                    t.style.setProperty('--i', idx++);
                    t.textContent = ch;
                    group.appendChild(t);
                }
                svg.classList.add('write');
            } catch (e) {
                document.documentElement.classList.add('no-sig');
            }
        }

        if (reduceMotion || !document.fonts || !document.fonts.load) {
            document.documentElement.classList.add('no-sig');
            return;
        }
        var done = false;
        function go() { if (done) return; done = true; run(); }
        document.fonts.load('200px Parisienne', 'Habiba Hisham').then(go, function () {
            done = true; document.documentElement.classList.add('no-sig');
        });
        setTimeout(go, 1200); // don't wait long on a slow font
    }

    /* ---------- Waveform ---------- */
    function buildWaveform() {
        var wf = document.getElementById('waveform');
        if (!wf) return;
        var bars = window.innerWidth < 700 ? 28 : 56;
        for (var i = 0; i < bars; i++) {
            var el = document.createElement('i');
            var env = Math.sin((i / (bars - 1)) * Math.PI);          // taller in the middle
            var h = 0.18 + env * (0.35 + Math.random() * 0.5);
            el.style.setProperty('--h', Math.min(h, 1).toFixed(2));
            el.style.setProperty('--d', (-Math.random() * 1.3).toFixed(2) + 's');
            wf.appendChild(el);
        }
    }

    /* ---------- Running timecodes + scrub bar ---------- */
    function initTimecode() {
        var start = performance.now();
        var heroTc = document.getElementById('heroTimecode');
        var topTc = document.getElementById('topTimecode');
        var scrubTime = document.getElementById('scrubTime');
        var fill = document.getElementById('scrubFill');
        var head = document.getElementById('scrubHead');

        function update() {
            var elapsed = (performance.now() - start) / 1000;
            if (heroTc) heroTc.textContent = timecode(elapsed);
            if (topTc) topTc.textContent = timecode(elapsed);
        }
        function scrub() {
            var max = document.documentElement.scrollHeight - window.innerHeight;
            var p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
            if (fill) fill.style.width = (p * 100) + '%';
            if (head) head.style.left = (p * 100) + '%';
            if (scrubTime) scrubTime.textContent = timecode(window.scrollY / 40);
        }
        setInterval(update, 41);
        window.addEventListener('scroll', scrub, { passive: true });
        window.addEventListener('resize', scrub);
        scrub();
    }

    /* ---------- Reveal on scroll + counters ---------- */
    function initReveal() {
        var els = document.querySelectorAll('.reveal');
        if (!('IntersectionObserver' in window)) {
            els.forEach(function (el) { el.classList.add('in'); });
            runCounters(document);
            return;
        }
        // stagger cards that share a row
        document.querySelectorAll('.videos-grid, .contact-info, .timeline').forEach(function (grid) {
            grid.querySelectorAll('.reveal').forEach(function (el, i) {
                el.style.setProperty('--rd', ((i % 4) * 0.08) + 's');
            });
        });
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (!e.isIntersecting) return;
                e.target.classList.add('in');
                if (e.target.classList.contains('stats-strip')) runCounters(e.target);
                io.unobserve(e.target);
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
        els.forEach(function (el) { io.observe(el); });
    }

    function runCounters(root) {
        root.querySelectorAll('[data-count]').forEach(function (el) {
            var target = parseInt(el.getAttribute('data-count'), 10);
            if (reduceMotion) { el.textContent = target; return; }
            var t0 = performance.now(), dur = 1400;
            (function tick(now) {
                var k = Math.min(1, (now - t0) / dur);
                el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3)));
                if (k < 1) requestAnimationFrame(tick);
            })(t0);
        });
    }

    /* ---------- Nav highlight ---------- */
    function initNav() {
        var links = document.querySelectorAll('.topnav a');
        var map = {};
        links.forEach(function (a) { map[a.dataset.sec] = a; });
        var targets = ['work', 'about', 'services', 'experience', 'skills', 'contact']
            .map(function (id) { return document.getElementById(id); }).filter(Boolean);
        function onScroll() {
            var y = window.scrollY + window.innerHeight * 0.35;
            var current = null;
            targets.forEach(function (s) { if (s.offsetTop <= y) current = s.id; });
            // horizontal videos belong to "work"
            links.forEach(function (a) { a.classList.toggle('active', a.dataset.sec === current); });
        }
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    /* ---------- Video filters ---------- */
    function initFilters() {
        var chips = document.querySelectorAll('.chip');
        var cards = document.querySelectorAll('#verticalGrid .video-card');
        chips.forEach(function (chip) {
            chip.addEventListener('click', function () {
                chips.forEach(function (c) { c.classList.remove('active'); });
                chip.classList.add('active');
                var f = chip.getAttribute('data-filter');
                cards.forEach(function (card) {
                    var show = f === 'all' || card.getAttribute('data-tag') === f;
                    card.classList.toggle('hide', !show);
                    if (show) card.classList.add('in');
                    var v = card.querySelector('video');
                    if (!show && v) v.pause();
                });
            });
        });
    }

    /* ---------- Only one video plays at a time ---------- */
    function initVideos() {
        var vids = document.querySelectorAll('video');
        vids.forEach(function (v) {
            v.addEventListener('play', function () {
                vids.forEach(function (o) { if (o !== v) o.pause(); });
            });
        });
    }

    /* ---------- Hero spotlight follows pointer ---------- */
    function initSpot() {
        var hero = document.querySelector('.hero');
        var spot = document.getElementById('heroSpot');
        if (!hero || !spot || reduceMotion) return;
        hero.addEventListener('pointermove', function (e) {
            var r = hero.getBoundingClientRect();
            spot.style.setProperty('--mx', (e.clientX - r.left) + 'px');
            spot.style.setProperty('--my', (e.clientY - r.top) + 'px');
        });
    }

    buildSignature();
    buildWaveform();
    initTimecode();
    initReveal();
    initNav();
    initFilters();
    initVideos();
    initSpot();
})();
