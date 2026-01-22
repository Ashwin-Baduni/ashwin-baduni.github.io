/* ============================================
   ASHWIN BADUNI - PORTFOLIO
   Clean, Minimal JavaScript
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    initNavbar();
    initSmoothScroll();
    initTypingEffect();
    initTiltEffect();
});

/* ============================================
   3D TILT EFFECT ON HOVER
   ============================================ */
function initTiltEffect() {
    const cards = document.querySelectorAll('.bento-card');

    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const rotateX = (y - centerY) / 25;
            const rotateY = (centerX - x) / 25;

            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.01, 1.01, 1.01)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
        });
    });
}

/* ============================================
   NAVBAR
   ============================================ */
function initNavbar() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    // Simple scroll background change - no hiding/showing
    let ticking = false;

    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(() => {
                if (window.pageYOffset > 50) {
                    navbar.classList.add('scrolled');
                } else {
                    navbar.classList.remove('scrolled');
                }
                ticking = false;
            });
            ticking = true;
        }
    });
}

/* ============================================
   SMOOTH SCROLL
   ============================================ */
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                window.scrollTo({
                    top: target.offsetTop - 100,
                    behavior: 'smooth'
                });
            }
        });
    });
}

/* ============================================
   TYPING EFFECT
   ============================================ */
function initTypingEffect() {
    const typingText = document.querySelector('.typing-text');
    if (!typingText) return;

    const roles = ['AI Engineer', 'ML Engineer', 'Full-Stack Developer', 'Problem Solver'];
    let roleIndex = 0;
    let charIndex = roles[0].length;
    let isDeleting = true;

    function typeRole() {
        const currentRole = roles[roleIndex];

        if (isDeleting) {
            charIndex--;
            typingText.textContent = currentRole.substring(0, charIndex);
        } else {
            charIndex++;
            typingText.textContent = currentRole.substring(0, charIndex);
        }

        let speed = isDeleting ? 50 : 100;

        if (!isDeleting && charIndex === currentRole.length) {
            speed = 2000;
            isDeleting = true;
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            roleIndex = (roleIndex + 1) % roles.length;
            speed = 500;
        }

        setTimeout(typeRole, speed);
    }

    setTimeout(typeRole, 3000);
}

/* ============================================
   CONSOLE
   ============================================ */
console.log('%c Hey there! 👋', 'font-size: 24px; font-weight: bold; color: #00d4ff;');
console.log('%c https://github.com/Ashwin-Baduni', 'font-size: 14px; color: #7c3aed;');
