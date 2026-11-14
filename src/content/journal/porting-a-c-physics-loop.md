---
title: Porting a C physics loop to the browser
date: 2026-11-08
summary: WinGravity's physics is about a hundred lines of C that move real Windows windows. Getting the same code to move fake windows on this site taught me more about timing than writing it did.
tags: [wingravity, typescript, physics]
---

## The starting point

WinGravity is a C program that gives every window on a Windows desktop mass. The interesting part is a
single function, `UpdateEnginePhysics`, which runs every frame: add gravity to each window's vertical speed,
check it against the edges of the screen, bounce or settle, then call `SetWindowPos` to move the real window.

When I started this site I wanted the project page to *be* the program, not a screenshot of it. So the
plan was simple: port that one function to TypeScript, keep every constant the same, and swap the Win32 parts
for DOM parts.

## What swapped cleanly

More than I expected.

- `EnumWindows` became `querySelectorAll('[data-window]')`.
- The window hooks (`EVENT_SYSTEM_MOVESIZESTART` and friends) became `pointerdown`, `pointermove` and
  `pointerup` on the title bars.
- `SetWindowPos` became setting the element's CSS `translate`.
- The screen rectangle became the demo container's `clientWidth` and `clientHeight`.

The constants came across untouched: gravity 444, friction 5, bounce 0.6, and the two bounce thresholds (80
for walls, 120 for the floor) that decide when a window stops bouncing and just lands.

## What didn't: time

In the C, I measured elapsed time with `QueryPerformanceCounter` and stepped the simulation in fixed slices
of 0.0069 seconds using an accumulator. That's the standard "fix your timestep" pattern and I'd included it
mostly because I'd read that I should.

In the browser I nearly dropped it. `requestAnimationFrame` gives you a timestamp, so why not just use the
real frame time? Two reasons showed up within an hour:

1. **Tabs sleep.** Switch away and come back and the frame delta is twenty seconds. Multiply gravity by that
   once and every window is a kilometre underground. The accumulator caps the delta and catches up in small
   steps instead.
2. **Refresh rates differ.** A 144 Hz monitor would have run the collision checks twice as often as a 60 Hz
   one. With a fixed step the window hits the floor at the same speed on both, which means the bounce
   threshold means the same thing on both.

So the accumulator stayed, and it's now the part of the port I'm most glad I kept.

## The throw

The bit of the C I was least sure about was the throw. While you drag a window it samples the position every
20 frames; when you let go, the distance since the last sample divided by the time becomes the velocity.

I copied that logic as-is, including a detail that looked like a bug: the sample counter is a `static` local,
so there's only one for the whole program. In practice you can only drag one window at a time, so it works,
and the port keeps the same single sample state per engine. I wrote a comment instead of "fixing" it,
because the point of the port is that it behaves like the original.

## What I'd do differently in the C

Porting is a very good code review. Reading my own C through TypeScript's type checker, two things stood out:

- Every object carries an acceleration, but the only acceleration that ever exists is gravity. One of the
  two fields could go.
- `BOUNCE_THRESHOLD` and `BOUNCE_THRESHOLD_GROUND` are 80 and 120 with no comment saying why. I remember
  tuning them by feel; the next person (me, in a year) won't.

Neither matters for a desktop toy, but I wouldn't have noticed either without writing the program twice.
