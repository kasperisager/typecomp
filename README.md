# Typecomp

> A multi project TypeScript language service abstraction

Typecomp was built with the purpose of making it easier and more efficient to work with large TypeScript projects, in particular when managed as monolithic repositories. Through a language service abstraction referred to as a "workspace", TypeScript files can be incrementally compiled and diagnosed without having to worry about which particular project each individual file might belong to. Behind the scenes, Typecomp keeps track of all the projects belonging to your workspace and shares a document registry between them in order to keep the memory footprint as small as possible.

## Contents

-   [Installation](#installation)
-   [Usage](#usage)
-   [License](#license)

## Installation

```sh
$ yarn add typecomp
```

## Usage

```ts
import { Workspace } from "typecomp";

const workspace = new Workspace();

// Compile a TypeScript file
const files = workspace.compile("src/foo.ts")

// Diagnose a TypeScript file
const diagnostics = workspace.diagnose("src/foo.ts")
```

Do note that Typecomp works entirely in-memory and therefore never writes anything to disk. What you do with compiled files and diagnostics is left up to you!

## License

Copyright &copy; 2018 [Kasper Kronborg Isager](https://github.com/kasperisager). Released under the terms of the [MIT license](LICENSE.md).
