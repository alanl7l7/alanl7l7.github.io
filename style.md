# Portfolio Style Guide

## File structure
alanl7l7.github.io/
│
├── index.html               <-- Your main website (Main Menu / "Choose a Game")
├── style.css                <-- Main website styling
│
├── brick-breaker/
│   ├── index.html           <-- Brick Breaker HTML
│   ├── game.js              <-- Brick Breaker Logic
│   └── style.css            
│
├── space-invaders/
│   ├── index.html           <-- Space Invaders HTML
│   ├── game.js              <-- Space Invaders Logic
│   └── style.css            
│
└── endless-runner/
    ├── index.html           <-- Endless Runner HTML
    ├── game.js              <-- Endless Runner Logic
    └── style.css

## Purpose

Keep all future work aligned with the existing retro terminal / arcade UI already established in the portfolio.

## Visual Direction

- Treat the site like a playable command console, not a generic portfolio.
- Preserve the CRT, HUD, boot-screen, and arcade-dashboard feel.
- Prefer dark backgrounds with high-contrast phosphor green as the main accent.
- Use warning colors like amber, red, or off-white only as secondary signals.
- Keep the layout feeling mechanical and screen-based: panels, borders, scanlines, grids, meters, tabs.

## Typography

- Prefer monospace or terminal-adjacent fonts.
- Headings should feel like commands, system banners, or mission labels.
- Navigation labels should stay short, uppercase, and machine-like when appropriate.

## Motion

- Use purposeful motion only: boot-up, scan-in, cursor blink, panel swap, progress bars.
- Animations should feel like a system response, not a modern app microinteraction.
- Keep animations short and readable.

## Content Tone

- Copy can be playful, dry, and slightly game-like.
- Avoid corporate portfolio language.
- Section labels can use system, mission, inventory, status, rank, or console wording.

## HTML And CSS Conventions

- Keep structure simple and readable in one file unless the project grows enough to justify splitting it.
- Reuse the current color language and border treatment unless there is a deliberate redesign.
- Favor explicit class names tied to the terminal concept.
- Preserve responsive behavior when adding new panels or content.

## JavaScript Conventions

- Keep interactions lightweight and UI-focused.
- Prefer simple DOM logic over unnecessary abstraction.
- New UI behavior should feel like operating a terminal screen or game menu.

## Terminal Command Style For Agent Work

- Assume Windows as the local environment.
- Prefer Windows-friendly commands and paths when giving the user commands.
- If shell commands are needed, prefer simple commands that work from the project root.
- Avoid bash-specific syntax in user-facing instructions unless explicitly requested.
- For this repo, explain HTML preview steps in browser terms first, then local server steps if needed.

## Change Guardrails

- Do not replace the retro terminal identity with a default portfolio template.
- Do not switch to modern glassmorphism, pastel gradients, or generic startup landing page patterns.
- Do not introduce visual noise that fights the readability of the console theme.
- When adding sections, make them feel like part of the same in-world interface.