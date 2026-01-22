/* ============================================
   ASHWIN BADUNI - PORTFOLIO
   GSAP Animations & Interactions
   ============================================ */

// Register GSAP ScrollTrigger
gsap.registerPlugin(ScrollTrigger);

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
    initAnimations();
    initNavbar();
    initSmoothScroll();
    initHoverEffects();
});

/* ============================================
   INITIAL ANIMATIONS
   ============================================ */
function initAnimations() {
    // Hero Section Animation
    const heroTimeline = gsap.timeline({ delay: 0.3 });

    // Navbar entrance
    heroTimeline.from('.navbar', {
        y: -100,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out'
    });

    // Hero main card
    heroTimeline.from('.hero-main', {
        y: 50,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out'
    }, '-=0.4');

    // Hero content stagger
    heroTimeline.from('.hero-main .hero-badge, .hero-main .hero-title, .hero-main .hero-subtitle, .hero-main .hero-description, .hero-main .hero-cta', {
        y: 30,
        opacity: 0,
        duration: 0.6,
        stagger: 0.1,
        ease: 'power3.out'
    }, '-=0.4');

    // Hero image
    heroTimeline.from('.hero-image', {
        scale: 0.8,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out'
    }, '-=0.8');

    // Stat cards
    heroTimeline.from('.stat-card', {
        x: 50,
        opacity: 0,
        duration: 0.6,
        stagger: 0.15,
        ease: 'power3.out'
    }, '-=0.6');

    // Social and tech cards
    heroTimeline.from('.social-card, .tech-card', {
        y: 30,
        opacity: 0,
        duration: 0.6,
        stagger: 0.1,
        ease: 'power3.out'
    }, '-=0.4');

    // Scroll-triggered animations for sections
    initScrollAnimations();
}

/* ============================================
   SCROLL ANIMATIONS
   ============================================ */
function initScrollAnimations() {
    // Section headers
    gsap.utils.toArray('.section-header').forEach(header => {
        gsap.from(header, {
            scrollTrigger: {
                trigger: header,
                start: 'top 85%',
                toggleActions: 'play none none reverse'
            },
            y: 50,
            opacity: 0,
            duration: 0.8,
            ease: 'power3.out'
        });
    });

    // Experience cards
    gsap.utils.toArray('.experience-card').forEach((card, i) => {
        gsap.from(card, {
            scrollTrigger: {
                trigger: card,
                start: 'top 85%',
                toggleActions: 'play none none reverse'
            },
            y: 60,
            opacity: 0,
            duration: 0.8,
            delay: i * 0.1,
            ease: 'power3.out',
            onComplete: () => card.classList.add('animate-in')
        });
    });

    // Project cards with stagger
    const projectCards = gsap.utils.toArray('.project-card');
    gsap.from(projectCards, {
        scrollTrigger: {
            trigger: '.projects-grid',
            start: 'top 80%',
            toggleActions: 'play none none reverse'
        },
        y: 60,
        opacity: 0,
        duration: 0.6,
        stagger: {
            amount: 0.8,
            from: 'start'
        },
        ease: 'power3.out',
        onComplete: () => {
            projectCards.forEach(card => card.classList.add('animate-in'));
        }
    });

    // Skill cards
    const skillCards = gsap.utils.toArray('.skill-card');
    gsap.from(skillCards, {
        scrollTrigger: {
            trigger: '.skills-grid',
            start: 'top 80%',
            toggleActions: 'play none none reverse'
        },
        y: 50,
        opacity: 0,
        duration: 0.6,
        stagger: {
            amount: 0.6,
            from: 'start'
        },
        ease: 'power3.out',
        onComplete: () => {
            skillCards.forEach(card => card.classList.add('animate-in'));
        }
    });

    // Contact card
    gsap.from('.contact-card', {
        scrollTrigger: {
            trigger: '.contact-card',
            start: 'top 85%',
            toggleActions: 'play none none reverse'
        },
        y: 80,
        opacity: 0,
        duration: 1,
        ease: 'power3.out'
    });

    // Parallax effect for gradient orbs
    gsap.to('.orb-1', {
        scrollTrigger: {
            trigger: 'body',
            start: 'top top',
            end: 'bottom bottom',
            scrub: 1
        },
        y: 200,
        ease: 'none'
    });

    gsap.to('.orb-2', {
        scrollTrigger: {
            trigger: 'body',
            start: 'top top',
            end: 'bottom bottom',
            scrub: 1
        },
        y: -150,
        ease: 'none'
    });
}

/* ============================================
   NAVBAR
   ============================================ */
function initNavbar() {
    const navbar = document.querySelector('.navbar');
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;

        if (currentScroll > 100) {
            navbar.style.background = 'rgba(10, 10, 15, 0.95)';
            navbar.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.3)';
        } else {
            navbar.style.background = 'rgba(18, 18, 26, 0.8)';
            navbar.style.boxShadow = 'none';
        }

        // Hide/show on scroll direction
        if (currentScroll > lastScroll && currentScroll > 200) {
            gsap.to(navbar, { y: -100, duration: 0.3 });
        } else {
            gsap.to(navbar, { y: 0, duration: 0.3 });
        }

        lastScroll = currentScroll;
    });

    // Active link highlighting
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-links a');

    window.addEventListener('scroll', () => {
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            if (window.pageYOffset >= sectionTop - 200) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.style.color = '';
            if (link.getAttribute('href') === `#${current}`) {
                link.style.color = '#00d4ff';
            }
        });
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
                gsap.to(window, {
                    duration: 1,
                    scrollTo: {
                        y: target,
                        offsetY: 100
                    },
                    ease: 'power3.inOut'
                });
            }
        });
    });
}

/* ============================================
   HOVER EFFECTS
   ============================================ */
function initHoverEffects() {
    // Card tilt effect
    const cards = document.querySelectorAll('.bento-card');

    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const rotateX = (y - centerY) / 20;
            const rotateY = (centerX - x) / 20;

            gsap.to(card, {
                rotateX: rotateX,
                rotateY: rotateY,
                transformPerspective: 1000,
                duration: 0.3,
                ease: 'power2.out'
            });
        });

        card.addEventListener('mouseleave', () => {
            gsap.to(card, {
                rotateX: 0,
                rotateY: 0,
                duration: 0.5,
                ease: 'power2.out'
            });
        });
    });

    // Magnetic effect for buttons
    const buttons = document.querySelectorAll('.btn, .nav-cta, .social-link');

    buttons.forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;

            gsap.to(btn, {
                x: x * 0.2,
                y: y * 0.2,
                duration: 0.3,
                ease: 'power2.out'
            });
        });

        btn.addEventListener('mouseleave', () => {
            gsap.to(btn, {
                x: 0,
                y: 0,
                duration: 0.3,
                ease: 'power2.out'
            });
        });
    });

    // Tech items glow effect
    const techItems = document.querySelectorAll('.tech-item, .lang-item');

    techItems.forEach(item => {
        item.addEventListener('mouseenter', () => {
            gsap.to(item, {
                boxShadow: '0 0 30px rgba(0, 212, 255, 0.3)',
                duration: 0.3
            });
        });

        item.addEventListener('mouseleave', () => {
            gsap.to(item, {
                boxShadow: 'none',
                duration: 0.3
            });
        });
    });
}

/* ============================================
   TYPING EFFECT
   ============================================ */
const typingText = document.querySelector('.typing-text');
if (typingText) {
    const roles = ['AI Engineer', 'ML Engineer', 'Full-Stack Developer', 'Problem Solver'];
    let roleIndex = 0;
    let charIndex = 0;
    let isDeleting = false;

    function typeRole() {
        const currentRole = roles[roleIndex];

        if (isDeleting) {
            typingText.textContent = currentRole.substring(0, charIndex - 1);
            charIndex--;
        } else {
            typingText.textContent = currentRole.substring(0, charIndex + 1);
            charIndex++;
        }

        let typeSpeed = isDeleting ? 50 : 100;

        if (!isDeleting && charIndex === currentRole.length) {
            typeSpeed = 2000;
            isDeleting = true;
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            roleIndex = (roleIndex + 1) % roles.length;
            typeSpeed = 500;
        }

        setTimeout(typeRole, typeSpeed);
    }

    // Start typing after initial animation
    setTimeout(typeRole, 2000);
}

/* ============================================
   INTERSECTION OBSERVER FOR LAZY ANIMATIONS
   ============================================ */
const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
        }
    });
}, observerOptions);

// Observe all bento cards
document.querySelectorAll('.bento-card').forEach(card => {
    observer.observe(card);
});

/* ============================================
   CONSOLE EASTER EGG
   ============================================ */
console.log('%c Hey there! 👋', 'font-size: 24px; font-weight: bold; color: #00d4ff;');
console.log('%c Interested in the code? Check out my GitHub!', 'font-size: 14px; color: #a1a1aa;');
console.log('%c https://github.com/Ashwin-Baduni', 'font-size: 14px; color: #7c3aed;');
