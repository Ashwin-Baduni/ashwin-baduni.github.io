# Ashwin Baduni

Personal site of Ashwin Baduni, co-founder of [MihawkAI](https://mihawk.ai).

**Live:** [ashwin-baduni.github.io](https://ashwin-baduni.github.io)

## Stack

- Vite, React and TypeScript
- Tailwind CSS v4
- GSAP (ScrollTrigger, ScrollTo, ScrambleText) for motion
- A hand-drawn canvas site plan in the hero
- Self-hosted fonts: Newsreader, Inter Tight, JetBrains Mono

## Develop

```bash
npm install
npm run dev      # local dev server
npm run build    # production build into dist/
npm run preview  # serve the production build locally
```

Main copy and links live in `src/content.ts`; the animated examples live in their demo components. The page runs from Introduction and About through MihawkAI, Kehsun, What I do, Experience, and Projects.

`useScrollGravity` catches wheel and touch momentum at section entrances with an earlier pull, bounded overshoot, and a slower return. Wheel momentum is held through the complete settle; a fresh gesture then releases the stop. Tall sections have additional reading stops for lower content and remain scrollable between them. The final fitting section has a small overshoot allowance. “What I do” builds four scenes as the page scrolls through a sticky panel, with a resting point after each completed illustration. CSS scroll snapping is disabled so it cannot compete with the spring. Keyboard and scrollbar navigation remain native. Reduced motion, pinch zoom, and open dialogs bypass gravity. `usePageScroll` handles anchor links and layout measurements. Entrances reverse with scrolling, and demo timelines pause offscreen or in background tabs. The CV preview uses `public/files/CV.pdf`.

Pushing to `main` builds and deploys through GitHub Actions.
