
// BURGER MENU

const toggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('#site-nav');
if (toggle && nav) {
    toggle.addEventListener('click', () => {
        const open = nav.classList.toggle('open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
}


// FLYVENDE DÅSER FRA FOOTER (MED TILFÆLDIG STRØM)

const cans = document.querySelectorAll(".floating-can");
const footer = document.querySelector(".site-footer");

if (cans.length && footer) {

    function spawn(can, initial = false) {
        // basis-spawn: lige ved footeren
        const baseY = footer.offsetTop - window.scrollY;

        let y;
        if (initial) {
            // første gang: spred dåserne ud langs hele banen,
            // så de IKKE ligger på linje
            const pathHeight = window.innerHeight * 1.5; // hvor højt de kan være
            y = baseY - Math.random() * pathHeight;      // et tilfældigt sted undervejs
        } else {
            // efterfølgende spawns: start nede ved footeren igen
            y = baseY;
        }

        const left = 5 + Math.random() * 90; // 5–95% bredde

        can.style.left = left + "%";
        can.dataset.y = y;

        // hver dåse får sin egen lille fart
        const baseSpeed = 0.4;
        const extraSpeed = Math.random() * 0.4; // 0–0.4
        can.dataset.speed = baseSpeed + extraSpeed;

        can.style.transform = `translateY(${y}px)`;
    }

    // første spawn: spred dem ud
    cans.forEach(can => spawn(can, true));

    function animate() {
        cans.forEach(can => {
            let y = parseFloat(can.dataset.y);
            const speed = parseFloat(can.dataset.speed) || 0.5;

            // bevæg opad
            y -= speed;
            can.dataset.y = y;
            can.style.transform = `translateY(${y}px)`;

            // når dåsen er langt over toppen → respawn nede ved footeren
            if (y < -200) {
                spawn(can, false);
            }
        });

        requestAnimationFrame(animate);
    }

    animate();
}
