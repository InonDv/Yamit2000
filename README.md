# Yamit 2000

A small third-person Three.js game set in a water park. Explore the park, pick up
white chairs, throw them at NPCs, and dodge the chair they throw back.

## Run locally

Requirements: Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, then click the game to capture the mouse.

## Controls

- W/S: move forward and backward
- A/D: rotate the aim without changing position
- Arrow keys or mouse movement: rotate the camera and the player's aim
- Space near a white chair: pick it up
- Space while carrying a chair: throw it forward
- Escape: release the mouse

## Verify

```bash
npm run typecheck
npm run build
```

For a gameplay check:

1. Walk near a white chair and press Space.
2. Face an orange walker or purple sunbather and press Space again.
3. Confirm the struck NPC picks up a chair and throws it back.
4. Confirm every landed chair can be picked up again.

Gameplay tuning values are kept in `src/config.ts`.

## Contributor

- [InonDv](https://github.com/InonDv) — creator and sole contributor
