---
title: WinGravity
kind: Desktop physics engine
summary: A small physics engine that makes every window on a Windows desktop fall, bounce and get thrown around.
year: 2026
tech: [C, Win32 API]
repo: https://github.com/AlbusAlbatron/WinGravity
order: 1
# Drop a screenshot into src/assets/projects/wingravity/ and uncomment:
# cover: ../../assets/projects/wingravity/cover.png
---

## The idea

I wanted to know whether I could make Windows itself feel physical: not a game in a window, but the actual
windows on my desktop falling to the bottom of the screen and bouncing when they landed. It turned out the
Win32 API gives you everything you need: a list of every window, events when the user drags one, and a way
to move any window you like.

## How it works

### Finding the windows

On start-up, `EnumWindows` walks every top-level window. Anything that's visible and has a title becomes an
`EngineObject` with a position, velocity and size, stored in an array that grows with `realloc`.

### Listening for the user

`SetWinEventHook` registers for `EVENT_SYSTEM_MOVESIZESTART`, `EVENT_SYSTEM_MOVESIZEEND` and
`EVENT_OBJECT_LOCATIONCHANGE`. When you grab a window, it's marked as grabbed and the physics stops fighting
you. While you drag, its position is sampled every 20 frames; when you let go, the distance travelled over
that time becomes the throw velocity.

### The physics loop

Every frame, the engine measures elapsed time with `QueryPerformanceCounter`, adds gravity to each window's
vertical velocity, and checks it against the edges of the virtual screen (all monitors combined). Hitting the
floor bounces the window back up with 60% of its speed, unless it's moving too slowly, in which case it
settles and friction takes over. Finally, `SetWindowPos` moves every real window to its new position.

```c
//Check if object is on floor
if (objectBottom >= boundary->bottom){
    engine->objects[i].pos.y = (float)(boundary->bottom - engine->objects[i].height);
    if (fabs(engine->objects[i].vel.y) > BOUNCE_THRESHOLD_GROUND){
        engine->objects[i].vel.y *= -BOUNCE;
    }
    else{
        engine->objects[i].vel.y = 0.0f;
    }
    //Apply friction
    if (fabs(engine->objects[i].vel.x) <= FRICTION){
        engine->objects[i].vel.x = 0.0f;
    }
    else {
        engine->objects[i].vel.x -= fsign(engine->objects[i].vel.x) * FRICTION;
    }
}
```

## What I learned

- **Callbacks and the Windows message loop.** Nothing happens unless you keep pumping messages with
  `PeekMessage`, so the physics and the event handling have to share one loop.
- **Fixed timesteps.** Running physics in fixed steps with an accumulator keeps the simulation stable no
  matter how fast or slow the frames come in.
- **Manual memory.** Growing the window list with `realloc`, and checking it didn't fail before using it.
