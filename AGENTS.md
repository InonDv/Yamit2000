# AGENTS.md

Guidance for AI coding agents working on this project.

## Project Overview

A small 3D third-person mini game set in a water park called **"Yamit 2000"** (signs with this name are placed around the map). The player walks around the park, picks up white chairs, and throws them at NPCs who are sunbathing or wandering around. NPCs hit by a chair retaliate by throwing a chair back at the player.

## Setting / Map

- The whole game takes place in a single map: a water park.
- Signs reading **"Yamit 2000"** are placed around the park.
- The map contains **white chairs** scattered around that can be picked up and thrown.
- The map contains **NPC characters** (see below).

## Player Controls

| Input | Action |
|-------|--------|
| Arrow keys | Move the player |
| Mouse movement | Rotate the camera around the map |
| `SPACE` (not holding a chair) | Pick up a nearby white chair and carry it |
| `SPACE` (holding a chair) | Throw the chair straight forward |

Notes:
- The keyboard is used for player movement; the mouse is used only for camera rotation.
- While carrying a chair, the player keeps walking normally with the chair held.
- A thrown chair travels straight ahead in the direction the player is facing.

## Chairs

- Chairs are **white** and spread across the map.
- Only chairs that are available (not currently held or in flight) can be picked up.
- A chair can be in one of these states: `idle` (on the ground), `held` (carried by player or NPC), `thrown` (in flight).
- A thrown chair that lands on the ground becomes `idle` again and can be picked up again.

## NPCs

- NPCs are characters that populate the park.
- They have two kinds of behavior:
  - **Moving**: walking around the park.
  - **Sunbathing**: sitting on chairs in the sun.
- The player can throw a chair at an NPC.
- **When a thrown chair hits an NPC:** that NPC reacts by picking up a chair and throwing it back at the player.
- Only the NPC that was hit retaliates.

## Gameplay Loop

1. Walk around the park and find a white chair.
2. Pick it up with `SPACE`.
3. Aim at an NPC (by facing it) and throw with `SPACE`.
4. If the chair hits, the NPC picks up a chair and throws it back at you.
5. Repeat.

## Tech Stack

- Three.js + Vite (TypeScript), running in the browser.
- Physics/collisions: a lightweight library such as `cannon-es` or `Rapier`, or simple custom hit detection (the stack can be changed if needed).

## Development Guidelines for Agents

- Keep the scope small. This is a mini game: implement one mechanic at a time.
- Build in this order, making sure each step works before moving on:
  1. Scene, ground, lighting, and the park map with "Yamit 2000" signs.
  2. Player movement (arrow keys) and mouse camera rotation.
  3. Chair pickup and throw with `SPACE`.
  4. Static NPCs sitting on chairs.
  5. Moving NPCs.
  6. Hit detection (chair hits NPC).
  7. NPC retaliation (hit NPC throws a chair at the player).
- Use simple primitive shapes (boxes, spheres, capsules) as placeholders for the player, NPCs, chairs, and signs until real assets are added.
- Keep game constants (move speed, throw speed, pickup range, camera sensitivity) in one config file so they are easy to tune.
- Keep code modular: separate files for player, camera, chairs, NPCs, and map.
- Commit after each working step.
- After each change, tell the user how to run and test it.

## Out of Scope (for now)

- Multiplayer
- Complex graphics or animation
- Menus, saving, or progression systems