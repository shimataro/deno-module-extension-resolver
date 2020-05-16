# deno-module-extension-resolver

Resolves module extensions in `import` / `export from`.

This is a **NPM package** for deno.

## Install

```bash
npm i deno-module-extension-resolver
```

## Usage

```bash
deno-module-extension-resolver SRC_DIR DST_DIR
```

* resolves module extensions in `.ts` / `.js` files
* directory structure is keeped
* destination directories will be created if not exist

### Example

```typescript
// will be resolved
import "/absolute/path/to/module";
import foo from "./relative/path";
import * as bar from "/named/export";
export * from "/export/aggregation";
export {baz, qux} from "/export/aggregation";

// will NOT be resolved
import "/already/resolved.ts";
import "/files/to/resolve/not/exists";
import "neither/absolute/nor/relative";
import "https://example.com/not/file/path";
require("/deno/does/not/support/require");
```

## Changelog

See [CHANGELOG.md](CHANGELOG.md).
