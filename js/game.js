/* ==========================================================
   Pantastisk – Pant catch (template)
   - Canvas er responsiv
   - Mus / touch til kontrol
   - Enkel “falling items” demo (kan fjernes/erstattes med din kode)
   - Overlays: Start, Pause, Game Over
   - Knapper: Spil igen + Indsend High Score
   ========================================================== */

(() => {
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');

    // HUD
    const elScore = document.getElementById('hud-score');
    const elLives = document.getElementById('hud-lives');
    const elTime  = document.getElementById('hud-time');

    // Overlays & controls
    const overlayStart = document.getElementById('overlay-start');
    const overlayGameover = document.getElementById('overlay-gameover');
    const startGameBtn = document.getElementById('start-game');
    const btnStart = document.getElementById('btn-start');
    const btnPause = document.getElementById('btn-pause');
    const btnMute  = document.getElementById('btn-mute');
    const pauseBadge = document.getElementById('pause-badge');
    const btnRestart = document.getElementById('btn-restart');
    const btnSubmit  = document.getElementById('btn-submit');
    const submitForm = document.getElementById('submit-form');
    const btnSend    = document.getElementById('btn-send');
    const finalScore = document.getElementById('final-score');

    // Lyd (valgfrit – placeholder)
    let muted = true;
    btnMute?.addEventListener('click', () => {
        muted = !muted;
        btnMute.setAttribute('aria-pressed', String(!muted));
        btnMute.textContent = muted ? 'Lyd fra' : 'Lyd til';
    });

    // Spil-state
    let running = false;
    let paused = false;
    let last = 0;

    const game = {
        score: 0,
        lives: 3,
        timeLeft: 60, // sekunder
        playerX: canvas.width/2,
        playerW: 110,
        playerH: 30,
        speed: 180, // ikke brugt i mouse-mode, men lader stå
        items: [],
    };

    // Assets (brug dine egne sprites – ellers tegner vi shapes)
    const sprites = {
        can: loadImage('images/can.png'),
        bottle: loadImage('images/bottle.png'),
        leaf: loadImage('images/leaf.png'),
        pantman: loadImage('images/pantman.png')
    };

    function loadImage(src){
        const img = new Image();
        img.src = src;
        return img;
    }

    /* ---------- Resizing (responsiv canvas) ---------- */
    function fitCanvas(){
        const w = canvas.parentElement.clientWidth;
        const baseRatio = 900/540; // samme som default size
        let width = w;
        let height = Math.round(w / baseRatio);
        // begræns max-højde på små skærme
        const maxH = window.innerHeight * 0.62;
        if (height > maxH) {
            height = Math.round(maxH);
            width = Math.round(height * baseRatio);
        }
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        // skaler intern buffer, så det ser skarpt ud
        const dpr = window.devicePixelRatio || 1;
        canvas.width  = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr,0,0,dpr,0,0); // skaler tegning til CSS pixels
    }
    window.addEventListener('resize', fitCanvas);
    fitCanvas();

    /* ---------- Simple demo-spil (kan erstattes af din kode) ---------- */
    function resetGame(){
        game.score = 0;
        game.lives = 3;
        game.timeLeft = 60;
        game.items = [];
        game.playerX = canvas.width/(window.devicePixelRatio||1)/2;
        updateHUD();
    }

    function start(){
        resetGame();
        running = true;
        paused = false;
        overlayStart.classList.remove('shown');
        overlayGameover.classList.remove('shown');
        last = performance.now();
        requestAnimationFrame(loop);
    }

    function pause(){
        if (!running) return;
        paused = !paused;
        pauseBadge.classList.toggle('show', paused);
        if (!paused) { last = performance.now(); requestAnimationFrame(loop); }
    }

    function endGame(){
        running = false;
        overlayGameover.classList.add('shown');
        finalScore.textContent = String(game.score);
    }

    function updateHUD(){
        elScore.textContent = String(game.score);
        elLives.textContent = String(game.lives);
        elTime.textContent  = String(Math.max(0, Math.ceil(game.timeLeft)));
    }

    function spawnItem(){
        const types = ['can','bottle','leaf']; // leaf = “skrald”
        const t = types[Math.floor(Math.random()*types.length)];
        const stageW = canvas.clientWidth;
        const x = Math.random() * (stageW - 40) + 20;
        const speed = 90 + Math.random()*120;
        game.items.push({t, x, y: -30, speed, w: 38, h: 38});
    }

    let spawnAcc = 0;

    function loop(ts){
        if (!running) return;
        if (paused) return;

        const dt = Math.min(0.032, (ts - last)/1000);
        last = ts;
        game.timeLeft -= dt;
        if (game.timeLeft <= 0) {
            game.timeLeft = 0;
            updateHUD();
            endGame();
            return;
        }

        spawnAcc += dt;
        if (spawnAcc > 0.6) { // spawn-interval
            spawnItem();
            spawnAcc = 0;
        }

        step(dt);
        draw();
        updateHUD();
        requestAnimationFrame(loop);
    }

    function step(dt){
        const stageH = canvas.clientHeight;
        // flyt items
        game.items.forEach(it => { it.y += it.speed * dt; });

        // kollision (simple AABB)
        const pY = stageH - 80;
        const pX = game.playerX - game.playerW/2;
        game.items = game.items.filter(it => {
            // rammer bakken?
            const hit = it.y + it.h >= pY &&
                it.y <= pY + game.playerH &&
                it.x + it.w >= pX &&
                it.x <= pX + game.playerW;
            if (hit) {
                if (it.t === 'leaf') { // skrald
                    game.lives -= 1;
                    if (game.lives <= 0) endGame();
                } else {
                    game.score += 10;
                }
                return false;
            }
            // forbi bunden => fjern
            if (it.y > stageH + 40) return false;
            return true;
        });
    }

    function draw(){
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        ctx.clearRect(0,0,w,h);

        // Pantman “bakke”
        const px = game.playerX;
        const py = h - 60;
        // bakke
        ctx.fillStyle = 'rgba(0,0,0,.15)';
        roundRect(ctx, px - game.playerW/2, py - 10, game.playerW, game.playerH, 12, true);

        // (valgfrit) Pantman sprite ved bakken
        const pm = sprites.pantman;
        if (pm.complete && pm.naturalWidth > 0) {
            const pmW = 120; const pmH = 140;
            ctx.drawImage(pm, px + game.playerW/2 - pmW/2, py - pmH + 12, pmW, pmH);
        }

        // items
        for (const it of game.items){
            const img = sprites[it.t];
            if (img.complete && img.naturalWidth > 0) {
                ctx.drawImage(img, it.x - it.w/2, it.y - it.h/2, it.w, it.h);
            } else {
                // fallback shapes
                ctx.fillStyle = it.t === 'leaf' ? '#5dbb63' : '#e33a2c';
                ctx.beginPath();
                ctx.arc(it.x, it.y, it.w/2, 0, Math.PI*2);
                ctx.fill();
            }
        }
    }

    function roundRect(ctx, x, y, w, h, r, fill=true){
        ctx.beginPath();
        ctx.moveTo(x+r, y);
        ctx.arcTo(x+w, y, x+w, y+h, r);
        ctx.arcTo(x+w, y+h, x, y+h, r);
        ctx.arcTo(x, y+h, x, y, r);
        ctx.arcTo(x, y, x+w, y, r);
        if (fill) ctx.fill();
    }

    /* ---------- Input: mus/touch – vandret kontrol ---------- */
    const stage = canvas;
    function setPlayerX(pageX){
        const rect = stage.getBoundingClientRect();
        const x = pageX - rect.left;
        game.playerX = Math.max(game.playerW/2, Math.min(rect.width - game.playerW/2, x));
    }
    stage.addEventListener('mousemove', (e)=> setPlayerX(e.clientX));
    stage.addEventListener('touchmove', (e)=> {
        setPlayerX(e.touches[0].clientX);
        e.preventDefault();
    }, {passive:false});

    /* ---------- Buttons ---------- */
    startGameBtn?.addEventListener('click', start);
    btnStart?.addEventListener('click', start);
    btnPause?.addEventListener('click', pause);

    btnRestart?.addEventListener('click', () => { overlayGameover.classList.remove('shown'); start(); });

    btnSubmit?.addEventListener('click', () => {
        submitForm.hidden = !submitForm.hidden;
    });
    btnSend?.addEventListener('click', () => {
        const name = document.getElementById('player-name').value.trim() || 'Ukendt';
        // Her kan du POST’e til backend/Google Sheet mm.
        alert(`High Score sendt!\n${name}: ${game.score}`);
        submitForm.hidden = true;
    });

    // Startoverlay er vist fra start (CSS). Intet andet at gøre her.
})();
