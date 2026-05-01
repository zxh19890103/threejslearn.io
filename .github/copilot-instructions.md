You can only touch the code in `./cases/{{case name}}`. Do not touch any other files. You can create new files under `./cases/**` if needed.`

you can follow the case `./cases/ABC`, the entries files include:

- `_explain.md`: explain the case, including the background, the problem, and the expected solution.
- `index.md`: the main file for the case, which includes the problem statement and the code to be completed by the user.
- `run.ts`: the file to run the case, which includes the test cases and the expected output.

you should use skill `gen-case` to generate a new case if users ask you do so.

now, every time user will specify which case they are focusing on, you only need to edit files in that case.

## Goals

- Write cases around Three.js to help devs learn Three.js by doing.

## Strict Rules

- Only `Typescript`
- Follow the conventions in the project, such as naming conventions, code style, etc.
- Use the Apis provided by the project, do not use any third-party libraries unless necessary.

## Third-party Libraries

If you need to use any third-party libraries, you must get approval from the user first. You should provide a justification for why the library is needed and how it will be used in the case.
