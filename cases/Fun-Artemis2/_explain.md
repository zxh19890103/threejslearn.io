<!--
  Generated Automatically At Mon Apr 06 2026 00:00:29 GMT+0800 (China Standard Time);
  Here You Explain What You want to Explain.
-->

# Artemis-Style Earth-Moon-Satellite Simulation: Project Introduction

## What This Project Is

This project is an interactive orbital simulation built with Three.js and TypeScript. It visualizes the Earth-Moon system and a controllable spacecraft, then combines that visualization with simplified but meaningful physics so users can explore orbital behavior in real time. Instead of being just a static 3D scene, it is a living model where gravity, velocity changes, and trajectory history are computed continuously and reflected immediately in the rendered world.

At a high level, the project has three central objects:

1. Earth, represented as a textured sphere and used as the primary gravitational body.
2. Moon, represented as another textured sphere and initialized from astronomical context.
3. Spacecraft, represented by a GLB model with maneuver controls and effects.

Around these objects, the project adds practical simulation features:

1. Numerical integration of motion using time-step iterations.
2. Trajectory trails with fading and bounded history.
3. Engine burn controls that alter orbital energy.
4. Exhaust particle effects linked to burns.
5. Runtime panel telemetry for position, velocity, distance, and simulation time.

So this is not a pure astronomy viewer and not a pure game. It sits in the middle as an educational and exploratory simulation: visual enough to be intuitive, physical enough to be informative.

## Why This Project Matters

Orbital mechanics can feel abstract because most explanations are purely equation-first or animation-first. Equation-first approaches can hide intuition. Animation-first approaches can hide correctness. This project tries to bridge that gap by keeping the physics loop explicit while making every result visible in 3D.

The educational value comes from cause-and-effect:

1. Increase velocity and see orbital shape change.
2. Decrease velocity and watch trajectory tighten or decay.
3. Observe how lunar gravity perturbs spacecraft motion.
4. Compare geometric intuition against telemetry readouts.
5. Track simulation speed versus wall-clock time.

By making these relationships immediate, the project helps users build mental models that are hard to develop from formulas alone.

## Core Goal

The core goal is to create a real-time sandbox where a user can understand and experiment with orbital dynamics in the Earth-Moon neighborhood.

A good way to summarize the target experience is:

1. See a physically plausible Earth-Moon system.
2. Place a spacecraft in orbit.
3. Apply meaningful maneuvers.
4. Read clear feedback from both visuals and numbers.
5. Learn by iteration.

The project does not try to be a mission-grade propagator. The goal is conceptual clarity, interactivity, and robust behavior under user actions.

## How the Simulation Works

The simulation uses state vectors for moving bodies. Each state holds six values:

1. Position components: x, y, z.
2. Velocity components: vx, vy, vz.

Every update cycle advances those states by integrating acceleration from gravity. Gravity is computed from Newtonian attraction using masses and distance. The Moon state is affected by Earth. The spacecraft state is affected by Earth and Moon.

The update loop effectively does this repeatedly:

1. Compute direction and distance to attracting body or bodies.
2. Compute gravitational force magnitude.
3. Convert force to acceleration.
4. Update velocity from acceleration over time step.
5. Update position from velocity over time step.

This gives continuous motion and naturally produces orbits when initial conditions are chosen appropriately.

## The Astronomical Framing

A key feature is that startup conditions are informed by astronomical context rather than arbitrary placeholders.

At initialization, solar and lunar observation data are sampled once for an observer location and time. From that:

1. The directional light is placed according to Sun direction.
2. The Moon initial direction is derived with Sun reference and lunar inclination considerations.
3. Moon initial position is scaled by Moon distance.
4. Moon initial velocity is set tangentially so dynamics can continue through the physics loop.

This creates a useful hybrid model:

1. Astronomical snapshot sets initial orientation.
2. Physics integrator handles evolution afterward.

The benefit is immediate realism in starting geometry without sacrificing simulation continuity and control.

## Orbital Plane, Tilt, and Orientation Choices

The project explicitly handles spatial orientation issues that commonly confuse users:

1. Orbit plane selection affects whether movement appears horizontal or tilted in scene coordinates.
2. Moon orbital inclination matters for realistic Earth-Moon geometry.
3. Earth axial tilt affects visual orientation and seasons-related intuition.
4. Camera placement strongly changes perceived correctness.

By exposing and adjusting these factors, the project helps users separate visual coordinate choices from physical behavior.

Earth axial tilt is implemented as a stable orientation offset on a parent transform, while Earth spin is applied to the Earth mesh itself. This separation is important because it preserves a clean tilt plus spin model.

## Trajectory Design Philosophy

Trajectory lines are one of the most useful learning aids in the simulation, and the project treats them as first-class behavior.

The trail system aims to be informative and stable:

1. It does not abruptly erase all history at arbitrary checkpoints.
2. It uses a bounded window so memory and visuals remain controlled.
3. It supports a one-orbit-style history cap when desired.
4. It emphasizes recency with alpha fading so users can read direction of motion at a glance.

This means the trail behaves more like an instrument than decoration. It answers practical questions:

1. Where has this object been recently.
2. Is orbit roughly circular or elliptical.
3. Is a maneuver raising or lowering orbital energy.
4. Is motion precessing or being perturbed.

## Maneuver Controls and User Intent

The spacecraft controls are intentionally simple but physically interpretable:

1. A prograde-like action increases speed.
2. A retrograde-like action decreases speed.
3. Burns are constrained to avoid obvious instability or instant escape in normal use.
4. Visual exhaust gives immediate feedback that an impulse happened.

This maps user input to real orbital ideas with minimal friction. A newcomer can press a button and see a meaningful consequence without reading a textbook first.

Renaming controls to action-meaning terms like boost and brake, or prograde burn and retrograde burn, improves this even more by aligning UI language with user mental models.

## Telemetry and Time Awareness

The simulation panel is critical because visuals alone can mislead. The panel reports:

1. Spacecraft position.
2. Spacecraft speed or velocity components.
3. Moon position.
4. Spacecraft-to-Moon distance.
5. Simulated screen time and real-to-sim rate.

Time rate is especially important in accelerated simulations. If each rendered frame advances large simulated intervals, users need explicit context. Showing a line like “1s = 3d” tells the truth about acceleration and helps users interpret apparent motion correctly.

This transforms the project from animation into measurement-backed simulation.

## Performance and Stability Strategy

A real-time browser simulation has practical constraints, so the project uses several stability strategies:

1. Fixed integration step and configurable iteration count.
2. Preallocated buffers for trajectory and particles where possible.
3. Controlled draw ranges for geometry updates.
4. Avoidance of repeated object churn in hot paths when feasible.
5. Bounded trail lengths and capped particle systems.

These decisions keep frame time predictable and reduce runtime surprises. It also makes the project easier to tune for different machines.

## Visual Design Goals

The visual side serves comprehension first:

1. Textured Earth and Moon provide recognizable context.
2. Directional and ambient light keep forms legible.
3. Orbit trails encode motion history.
4. Exhaust effects encode engine events.
5. Camera framing balances large-scale context with local detail.

The project tries to avoid two extremes:

1. Too abstract to feel connected to reality.
2. Too photorealistic to maintain interactive clarity.

The current style aims for readable scientific visualization with game-like responsiveness.

## Scope and Non-Goals

It is useful to define what this project is not trying to do right now:

1. It is not a high-fidelity N-body mission planner.
2. It is not using full perturbation models like J2, SRP, atmospheric drag, and tides.
3. It is not tied to precise inertial reference frames for official ephemerides.
4. It is not a navigation-grade numerical integrator benchmark.

Those are valid future directions, but they are outside the present educational-interactive scope.

## How to Read the Project as a User

A practical learning flow for users can be:

1. Observe baseline Moon and spacecraft trajectories for a minute.
2. Trigger a speed-up maneuver and watch trail shape and distance changes.
3. Trigger a slow-down maneuver and compare effects.
4. Monitor panel speed and distance while watching geometry.
5. Relate time acceleration line to perceived dynamics.
6. Repeat with different iteration values to see simulation-speed tradeoffs.

This progression turns passive viewing into active understanding.

## What Success Looks Like

A successful version of this project is one where:

1. Users can explain in plain language why an orbit changed after a maneuver.
2. Users can distinguish visual appearance from physical state using telemetry.
3. The simulation remains smooth and stable during normal interaction.
4. Initial scene orientation feels physically plausible and consistent.
5. UI control naming and panel data reduce ambiguity instead of adding it.

If users can predict outcomes before pressing controls, the project is doing its job.

## Future Expansion Directions

Natural next steps, if desired, include:

1. Observer latitude and longitude controls for initialization.
2. Optional inertial versus Earth-fixed frame toggle.
3. Separate prograde, radial, and normal burn controls.
4. Adjustable Moon inclination and node angle controls.
5. Event markers for periapsis, apoapsis, and closest approach.
6. Mission objective modes such as transfer experiments.
7. Better integrators like RK4 as an optional quality mode.

These can be added incrementally while preserving current clarity.

## Final Summary

This project is best described as a physically grounded, visually rich orbital learning sandbox. It combines astronomical startup context, Newtonian motion updates, interactive spacecraft maneuvers, bounded trajectory visualization, and live telemetry to help users connect intuition with mechanics.

The “what” is a real-time Earth-Moon-spacecraft simulator.  
The “how” is state-vector propagation plus thoughtful rendering and control design.  
The “goal” is understanding through interaction: seeing why orbital behavior changes, not just seeing that it changes.

That combination is what makes the project valuable.