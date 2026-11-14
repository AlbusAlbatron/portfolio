---
title: Lighting a web page with a fluid simulation
date: 2026-11-12
summary: The home page of this site has a fluid flowing behind the text and a lamp attached to your cursor. Here's how it works, why it's barely visible on purpose, and when it switches itself off.
tags: [webgpu, graphics, this-site]
---

## The idea

I wanted the home page to feel like it had weather. Not a particle effect pasted on top, but something that
reacted to the page: fluid that flowed around the words, and light that was blocked by them.

Both of those need to know where the content is. That turned out to be the easy part: every block of text
and every card is tagged with `data-field`, and a small script measures their boxes and uploads them to the
GPU as rectangles. The fluid treats them as solid. The light treats them as occluders.

## The fluid

The simulation is Jos Stam's "stable fluids", the same method behind most real-time smoke demos. It runs on
a grid of 6-pixel cells in WebGPU compute shaders:

1. **Advect** — move the velocity and the dye along the current velocity field.
2. **Splat** — push the cursor's motion into the field, and a little scroll velocity too, so scrolling the
   page stirs it.
3. **Project** — make the field incompressible. That's a pressure solve, twenty Jacobi iterations a frame,
   followed by subtracting the pressure gradient.

Twenty iterations isn't many (production fluid solvers use far more), but it's enough for the fluid to look
like it has volume rather than just smearing, and it keeps the whole thing under a millisecond on a laptop GPU.

## The light

This is the part I'm proudest of. The lamp under the cursor lights the page using **radiance cascades**, an
idea from Alexander Sannikov. Instead of casting a few hundred long rays from every point (too slow) or a few
long rays (too noisy), you cast several *cascades* of short rays. Cascade 0 has probes everywhere with short
rays in a handful of directions. Cascade 1 has a quarter as many probes, rays twice as long in twice as many
directions. And so on, five times, until the last cascade reaches about five hundred cells.

Then you merge them from far to near. Each probe's short rays pick up where the next cascade's longer rays
left off, so a point ends up with the full picture — sharp detail nearby, where it matters, and cheap
blurry light from far away, where it doesn't. Shadows fall out of this for free: a ray that hits a text box
stops.

## Why you can barely see it

The first version looked great and failed every contrast check I ran. Light tinting the background under
grey text is a fast way to drop below the 4.5:1 ratio that body text needs.

So the compositing shader clamps it. The tint can never move the background more than 14% of the way toward
the text colour on the dark surface, or 10% on the light one. At exactly those caps the muted text is still
at 4.51:1 and the main text is above 9:1. I tuned the numbers by measuring, not by eye, and the result is an
effect you feel more than see. I think that's right for a portfolio: it should never fight the words.

## When it switches itself off

The field is a treat, not a requirement, so it's quick to bow out:

- No WebGPU in the browser: off.
- Touch device, data-saver connection, or a low-end device: off.
- `prefers-reduced-motion`: off.
- 3.5 seconds without input: the simulation pauses until you move again.

It also only loads after the 3D hero has settled, so it's never in the way of the page's first paint. Lighthouse
still gives the home page 97–100, which was the condition for keeping it.

## What I'd try next

Letting the fluid carry a little of the page's own colour, so the dye is tinted by whatever it flows past.
And lighting the project pages too, if I can find a version that's cheap enough to run everywhere.
