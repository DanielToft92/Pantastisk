/* ==========================================================
   Pantastisk – Can Catcher (mobil-taller canvas + kantfix)
   ========================================================== */

(() => {
    const canvas = document.getElementById("game-canvas");
    const ctx = canvas.getContext("2d");

    // HUD
    const elScore = document.getElementById("hud-score");
    const elLives = document.getElementById("hud-lives");
    const elTime  = document.getElementById("hud-time");

    // Overlays & controls
    const overlayStart    = document.getElementById("overlay-start");
    const overlayGameover = document.getElementById("overlay-gameover");
    const startGameBtn    = document.getElementById("start-game");
    const btnStart        = document.getElementById("btn-start");
    const btnPause        = document.getElementById("btn-pause");
    const btnMute         = document.getElementById("btn-mute");
    const pauseBadge      = document.getElementById("pause-badge");
    const btnRestart      = document.getElementById("btn-restart");
    const btnSubmit       = document.getElementById("btn-submit");
    const submitForm      = document.getElementById("submit-form");
    const btnSend         = document.getElementById("btn-send");
    const finalScore      = document.getElementById("final-score");
    const overTitleEl     = document.getElementById("over-title");

    /* ---------- Assets ---------- */
    function loadImage(src){ const img = new Image(); img.src = src; return img; }

    const canSprites = [
        loadImage("images/dåse.png"),
        loadImage("images/dåse2.png"),
        loadImage("images/dåse3.png"),
        loadImage("images/dåse4.png"),
    ];
    const bottleSprites = [ loadImage("images/flaske.png") ];

    const sprites = {
        pantman: loadImage("images/gribe.png"),
        bomb:    loadImage("images/bombe.png"),
    };

    /* ---------- Game state ---------- */
    let running = false, paused = false, last = 0;

    const player = {
        x: 0,
        baseY: 0,
        spriteW: 170,
        spriteH: 210,
        // Hitbox
        catchOffsetX: -16,
        catchOffsetY: -42,
        catchW: 100,
        catchH: 40,
    };

    const game = {
        score: 0,
        lives: 3,
        timeLeft: 60,
        items: [],
        spawnRate: 0.70,
        burstChance: 0.35,
        fallSpeedMin: 95,
        fallSpeedMax: 150,
    };

    // Effekter
    const particles = [];
    let shakeT = 0, shakeMag = 0;

    // Slutsekvens
    let ending = false, endReason = null, endTimer = 0;
    const END_SHAKE_TIME = 0.6;
    const END_FORM_DELAY = 0.6;

    /* ---------- Responsiv canvas (mobil = højere) ---------- */
    function fitCanvas(){
        const parentW = canvas.parentElement.clientWidth;

        // Brug højere (taller) forhold på mobil → mere vertikal plads
        let baseRatio; // width / height
        if (window.innerWidth < 768) {
            baseRatio = 0.8;   // mobil: højt lærred (height ≈ width / 0.8)
        } else if (window.innerWidth < 1024) {
            baseRatio = 1.0;   // tablet: næsten kvadratisk
        } else {
            baseRatio = 900/700; // desktop som før
        }

        // Start fra bredden
        let width  = parentW;
        let height = Math.round(width / baseRatio);

        // Maks-højde (brug visualViewport på iOS for korrekt måling)
        const vh = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
        let maxH;
        if (window.innerWidth < 768) {
            maxH = vh * 0.93;
        } else if (window.innerWidth < 1024) {
            maxH = vh * 0.88;
        } else {
            maxH = vh * 0.78;
        }

        // Hvis beregnet højde er større end max → skaler ned
        if (height > maxH) {
            height = Math.round(maxH);
            width  = Math.round(height * baseRatio);
        }

        // Sæt CSS-størrelse
        canvas.style.width  = width + "px";
        canvas.style.height = height + "px";

        // Skarp rendering
        const dpr = window.devicePixelRatio || 1;
        canvas.width  = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr,0,0,dpr,0,0);

        player.x = width/2;
        player.baseY = height - 10;
    }
    window.addEventListener("resize", fitCanvas, { passive:true });
    window.addEventListener("orientationchange", () => setTimeout(fitCanvas, 50), { passive:true });
    fitCanvas();

    /* ---------- Gameplay ---------- */
    function resetGame(){
        game.score = 0;
        game.lives = 3;
        game.timeLeft = 60;
        game.items = [];
        particles.length = 0;
        shakeT = 0; shakeMag = 0;
        ending = false; endReason = null; endTimer = 0;
        submitForm.hidden = true;
        updateHUD();
    }

    function start(){
        resetGame();
        running = true; paused = false;
        overlayStart.classList.remove("shown");
        overlayGameover.classList.remove("shown");
        last = performance.now();
        requestAnimationFrame(loop);
    }

    function pause(){
        if (!running) return;
        paused = !paused;
        pauseBadge.classList.toggle("show", paused);
        if (!paused){ last = performance.now(); requestAnimationFrame(loop); }
    }

    function beginEndSequence(reason){
        if (ending) return;
        ending = true; endReason = reason; endTimer = 0;
        if (reason === "bombs" && shakeT <= 0){ shakeT = 0.25; shakeMag = 6; }
    }

    function updateHUD(){
        elScore.textContent = String(game.score);
        elLives.textContent = String(game.lives);
        elTime.textContent  = String(Math.max(0, Math.ceil(game.timeLeft)));
    }

    /* ---------- Spawns ---------- */
    function rand(min,max){ return Math.random()*(max-min)+min; }

    function spawnItem(stageW){
        const pBomb = 0.15;
        let img, type, w, h;

        if (Math.random() < pBomb){
            img = sprites.bomb; type = "bomb"; w = 56; h = 56;
        } else {
            if (Math.random() < 0.5){
                img = canSprites[Math.floor(Math.random()*canSprites.length)];
                type = "can"; w = 54; h = 54;
            } else {
                img = bottleSprites[0];
                type = "bottle"; w = 58; h = 70;
            }
        }

        const x = Math.random() * (stageW - w*2) + w;
        const speed = rand(game.fallSpeedMin, game.fallSpeedMax);
        const rotationSpeed = rand(-0.05, 0.05);

        game.items.push({ img, type, x, y: -h, w, h, speed, rotation: 0, rotationSpeed });
    }

    let spawnAcc = 0;

    /* ---------- Loop ---------- */
    function loop(ts){
        if (!running || paused) return;

        const dt = Math.min(0.032, (ts - last)/1000);
        last = ts;

        if (!ending){
            game.timeLeft -= dt;
            if (game.timeLeft <= 0){
                game.timeLeft = 0; updateHUD();
                beginEndSequence("time");
            }

            spawnAcc += dt;
            while (spawnAcc >= game.spawnRate){
                spawnItem(canvas.clientWidth);
                if (Math.random() < game.burstChance) spawnItem(canvas.clientWidth);
                spawnAcc -= game.spawnRate;
            }
        } else {
            endTimer += dt;
            if (endTimer >= END_SHAKE_TIME){
                if (!overlayGameover.classList.contains("shown")){
                    const title = endReason === "time" ? "Time's Up" : "Game Over";
                    overTitleEl.textContent = title;
                    finalScore.textContent = String(game.score);
                    overlayGameover.classList.add("shown");
                    setTimeout(()=>{ submitForm.hidden = false; }, END_FORM_DELAY*1000);
                }
                if (endTimer >= END_SHAKE_TIME + END_FORM_DELAY + 0.2){
                    running = false;
                }
            }
        }

        step(dt);
        draw();
        updateHUD();
        requestAnimationFrame(loop);
    }

    /* ---------- Step ---------- */
    function step(dt){
        const stageH = canvas.clientHeight;

        game.items.forEach(it => { it.y += it.speed * dt; it.rotation += it.rotationSpeed; });

        // Pantman hitbox
        const px = player.x;
        const pmY = player.baseY - player.spriteH;
        const catchX = px + player.catchOffsetX;
        const catchY = pmY + player.spriteH/2 + player.catchOffsetY;

        game.items = game.items.filter(it => {
            const hit =
                it.y + it.h/2 >= catchY - player.catchH/2 &&
                it.y - it.h/2 <= catchY + player.catchH/2 &&
                it.x + it.w/2 >= catchX - player.catchW/2 &&
                it.x - it.w/2 <= catchX + player.catchW/2;

            if (hit){
                if (it.type === "bomb"){
                    game.lives -= 1;
                    triggerExplosion(it.x, it.y, it.w, it.h);
                    if (game.lives <= 0 && !ending) beginEndSequence("bombs");
                } else {
                    game.score += 10;
                    triggerConfetti(it.x, it.y);
                }
                return false;
            }
            if (it.y > stageH + 50) return false;
            return true;
        });

        // particles
        for (const p of particles){
            p.life -= dt;
            if (p.life > 0){
                p.x += p.vx * dt; p.y += p.vy * dt;
                p.vy += p.gravity * dt;
                p.size += p.grow * dt;
            }
        }
        for (let i = particles.length-1; i>=0; i--){ if (particles[i].life <= 0) particles.splice(i,1); }

        if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
    }

    /* ---------- Effekter ---------- */
    function triggerExplosion(x,y,w=56,h=56){
        shakeT = 0.25; shakeMag = 6;
        const sparks = 16;
        for (let i=0;i<sparks;i++){
            const ang = Math.random()*Math.PI*2;
            const spd = 130 + Math.random()*120;
            particles.push({
                x, y,
                vx: Math.cos(ang)*spd, vy: Math.sin(ang)*spd,
                size: 3 + Math.random()*3,
                color: Math.random()<0.6 ? "rgba(255,170,30,0.9)" : "rgba(255,220,80,0.9)",
                life: 0.35 + Math.random()*0.25,
                gravity: 220,
                grow: -4
            });
        }
        const smoke = 10;
        for (let i=0;i<smoke;i++){
            particles.push({
                x: x + (Math.random()*w - w/2)*0.4,
                y: y + (Math.random()*h - h/2)*0.4,
                vx: (Math.random()-0.5)*40,
                vy: -40 - Math.random()*60,
                size: 10 + Math.random()*12,
                color: "rgba(80,80,80,0.35)",
                life: 0.6 + Math.random()*0.35,
                gravity: 20,
                grow: 12
            });
        }
    }

    function triggerConfetti(x,y){
        const n = 8;
        for (let i=0;i<n;i++){
            const ang = (-Math.PI/2) + (Math.random()-0.5)*0.9;
            const spd = 80 + Math.random()*60;
            particles.push({
                x, y,
                vx: Math.cos(ang)*spd, vy: Math.sin(ang)*spd,
                size: 3 + Math.random()*2,
                color: Math.random()<0.5 ? "rgba(50,200,120,0.9)" : "rgba(30,150,255,0.9)",
                life: 0.35 + Math.random()*0.2,
                gravity: 160,
                grow: -6
            });
        }
    }

    /* ---------- Draw ---------- */
    function draw(){
        const w = canvas.clientWidth, h = canvas.clientHeight;
        let ox=0, oy=0;
        if (shakeT>0){ ox = (Math.random()*2-1)*shakeMag; oy = (Math.random()*2-1)*shakeMag; }

        ctx.clearRect(0,0,w,h);
        ctx.save(); ctx.translate(ox,oy);

        // Pantman
        const pm = sprites.pantman;
        const pmX = player.x - player.spriteW/2;
        const pmY = player.baseY - player.spriteH;
        if (pm.complete && pm.naturalWidth > 0){
            ctx.drawImage(pm, pmX, pmY, player.spriteW, player.spriteH);
        }

        // Items
        for (const it of game.items){
            const img = it.img;
            if (img.complete && img.naturalWidth > 0){
                ctx.save();
                ctx.translate(it.x, it.y);
                ctx.rotate(it.rotation);
                ctx.drawImage(img, -it.w/2, -it.h/2, it.w, it.h);
                ctx.restore();
            }
        }

        // Partikler
        for (const p of particles){
            if (p.life <= 0) continue;
            ctx.beginPath();
            ctx.fillStyle = p.color;
            ctx.arc(p.x, p.y, Math.max(0.1, p.size), 0, Math.PI*2);
            ctx.fill();
        }

        ctx.restore();
    }

    /* ---------- Input (sprite inde i canvas, hitbox til kanten) ---------- */
    const stage = canvas;
    function setPlayerX(pageX){
        const rect = stage.getBoundingClientRect();
        const x = pageX - rect.left;

        const spriteHalf = player.spriteW / 2;
        const hbHalfW = player.catchW / 2;

        const leftBySprite  = spriteHalf;
        const rightBySprite = rect.width - spriteHalf;

        const leftByHitbox  = hbHalfW - player.catchOffsetX;
        const rightByHitbox = rect.width - hbHalfW - player.catchOffsetX;

        const leftLimit  = Math.max(leftBySprite,  leftByHitbox);
        const rightLimit = Math.min(rightBySprite, rightByHitbox);

        player.x = Math.max(leftLimit, Math.min(rightLimit, x));
    }
    stage.addEventListener("mousemove", e => setPlayerX(e.clientX));
    stage.addEventListener("touchmove", e => {
        setPlayerX(e.touches[0].clientX);
        e.preventDefault();
    }, { passive:false });

    /* ---------- Buttons ---------- */
    let muted = true;
    btnMute?.addEventListener("click", () => {
        muted = !muted;
        btnMute.setAttribute("aria-pressed", String(!muted));
        btnMute.textContent = muted ? "Lyd fra" : "Lyd til";
    });

    startGameBtn?.addEventListener("click", start);
    btnStart?.addEventListener("click", start);
    btnPause?.addEventListener("click", pause);

    btnRestart?.addEventListener("click", () => {
        overlayGameover.classList.remove("shown");
        start();
    });

    btnSubmit?.addEventListener("click", () => { submitForm.hidden = !submitForm.hidden; });
    btnSend?.addEventListener("click", () => {
        const name = document.getElementById("player-name").value.trim() || "Ukendt";
        alert(`High Score sendt!\n${name}: ${game.score}`);
        submitForm.hidden = true;
    });
})();
