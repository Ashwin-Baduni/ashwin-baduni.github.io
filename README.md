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

Main copy and links live in `src/content.ts`; the animated examples live in their demo components. The page runs from Introduction and About through MihawkAI, Kehsun, What I do, Experience, and Projects. Desktop sections settle after a scroll gesture only when their content fits the viewport. “What I do” uses four scroll-controlled chapters in a sticky viewport, with one chapter per wheel gesture. On phones, short screens, and reduced-motion settings, the four scenes appear in normal document order. Touch, short or overflowing layouts, and reduced-motion preferences keep native scrolling. Entrances replay in both directions, and demo timelines pause offscreen or in background tabs. The CV preview uses `public/files/CV.pdf`.

Pushing to `main` builds and deploys through GitHub Actions.
