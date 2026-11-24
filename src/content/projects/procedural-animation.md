---
title: Procedural animation
kind: Animation experiment
summary: A chain of circles that follows the cursor like a snake. My first try at procedural animation, written in C with raylib.
year: 2026
tech: [C, raylib]
repo: https://github.com/AlbusAlbatron/procedural_animation
order: 3
---

## The idea

I'd seen videos of procedurally animated creatures (snakes, fish, lizards) where nothing is keyframed and the
body just follows the head. I wanted to know how much code it took to get that effect. It came to about
a hundred lines of C.

## How it works

### One rule

The body is an array of circles. Every frame the head moves 3% of the way towards the mouse. Then, for each
circle after it: if it has drifted further from the one in front than that circle's radius, pull it 3% of the
way towards where the one in front *used to be*. Otherwise leave it alone. That lag, chasing the previous
position rather than the current one, is what makes the body swing round corners instead of snapping into a
straight line.

```c
int motion(Circle* circle_line, int circle_count, Vector2 head_pos){
    Vector2 prev_pos = head_pos;
    Vector2 temp_pos;

    for (int i = 1; i < circle_count; i++){
        //Check if distance between to centres are greater than radius
        if (Vector2Distance(circle_line[i - 1].center, circle_line[i].center) > circle_line[i - 1].radius){
            //Move circle i towards circle [i-1]'s last postion
            temp_pos = circle_line[i].center;
            circle_line[i].center = Vector2Lerp(circle_line[i].center, prev_pos, 0.03f);
            prev_pos = temp_pos;
        }
        else{
            prev_pos = circle_line[i].center;
        }
    }
    return 0;
}
```

### Shrinking radii

Each circle's radius is 80% of the one before it, stored as an `int`. Starting from 40 that gives 40, 32, 25,
20, 16, 12, 9, 7, 5, 4, 3, 2, 1, and then 0, because `(int)(1 * 0.8)` is 0. From segment 14 to 40 the circles
have no size at all, which is why the tail is a line of dots. I only noticed when I went back over the code.

### The loop

raylib runs the loop at a target of 600 frames a second, and the 3% lerp is applied once per frame. That ties
the feel of the animation to the frame rate: on a slower machine the snake is slower. I'd fix that now with a fixed
timestep.

## What I learned

- **Following the past, not the present.** The whole effect comes from one variable holding the previous
  circle's old position. Change it to the new position and the snake turns into a rigid rod.
- **Integer truncation is silent.** Nothing warned me that two thirds of my circles had a radius of zero.
  Drawing the data you're computing is the fastest way to find that out.
- **Frame-rate independence.** Multiplying by a lerp factor every frame is not the same as moving at a speed.

## What's next

- Give the body a skin: connect the circle edges into one outline instead of drawing rings.
- Add constraints on how sharply the chain can bend, so it stops folding back through itself.
- Add legs, so it can move more like a lizard.
