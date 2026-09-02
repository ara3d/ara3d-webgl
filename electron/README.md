# Electron shell for the WebGPU examples

The WebGPU examples use `chromium-experimental-multi-draw-indirect`, which
Chrome only exposes when `chrome://flags/#enable-unsafe-webgpu` is on. This
folder wraps the same pages in an Electron window that sets the switches for
itself, so nothing has to be turned on by hand.

## Running

```
npm run electron
```

That serves the checked-in build in `docs/` on a local port and opens
`example-webgpu-multidraw.html`.

## Opening models

**File > Sample Models** lists every `.bfast` and `.bos` found in `docs/` and
`examples/public/`, with its size. **File > Open Model...** (Ctrl+O, Cmd+O on a
Mac) opens any other file.

Neither path copies or reads the file in the main process. The chosen path is
registered with the local server, and the page is reloaded with
`?model=<local url>` -- the same query parameter the examples already accept in
a browser. Only files picked from the menu are reachable over the server, so
opening a model does not expose the folder it came from.

Large `.bfast` render models are the reason this exists: they are too big to
commit, so they are not in `docs/`, and dragging a multi-gigabyte file onto the
window is awkward.

Against the Vite dev server instead, with `npm run dev` already running:

```
npm run electron:dev
```

To check what the GPU actually offers under these switches:

```
npm run electron:check
```

It prints the adapter name and its full feature list, and exits non-zero if
`chromium-experimental-multi-draw-indirect` or `indirect-first-instance` is
missing.

## Options

| Argument | Environment variable | Meaning |
| --- | --- | --- |
| `--url=` | `ARA3D_URL` | Load this URL instead of serving a directory. A URL ending in `.html` is used as given; anything else is treated as an origin and the page is appended. |
| `--dir=` | `ARA3D_DIR` | Directory to serve. Default `docs/`. |
| `--base=` | `ARA3D_BASE` | Path prefix the build was made with. Default `/ara3d-webgl/`. |
| `--page=` | `ARA3D_PAGE` | Page to open. Default `example-webgpu-multidraw.html`. |
| `--models=` | `ARA3D_MODELS` | Directories listed in the Sample Models menu, separated by `;` on Windows and `:` elsewhere. Default: the served directory and `examples/public/`. |
| `--devtools` | | Open developer tools in a separate window. |

## Files

| File | Role |
| --- | --- |
| `main.js` | Entry point: applies switches, starts the server, opens the window. |
| `gpuSwitches.js` | The Chromium switches, per platform. |
| `appTarget.js` | Turns arguments and environment into a URL to load. |
| `staticServer.js` | Read-only file server on localhost. |
| `routes.js` | The two ways a request path becomes a file: a served directory, and opened files. |
| `modelFiles.js` | Finds model files on disk for the menu. |
| `menu.js` | The application menu. |
| `mimeTypes.js` | Content types by file extension. |
| `window.js` | The browser window and its security settings. |
| `checkFeatures.js` | Prints the adapter's WebGPU feature list and exits. |

The pages are served over http rather than opened as files because the build
uses a `/ara3d-webgl/` base and fetches models by absolute path. Both break
under `file://`.

## macOS

Nothing here is Windows-specific: paths are built with `path.join`, the server
binds `127.0.0.1`, and the two macOS lifecycle rules (keep running with no
windows, reopen from the dock) are already in `main.js`. `npm run electron`
should work on a Mac as-is.

The one thing to confirm on the Mac is the GPU side. Chromium uses Metal there
instead of D3D12, and Dawn's Metal backend may not implement the multi-draw
extension. Run `npm run electron:check` on the machine to find out. If the
feature is absent the example still runs — it falls back to one
`drawIndexedIndirect` per instance and says so in its status panel — but the
draw-call savings are gone. If a Mac-only switch turns out to be needed, add it
to the `darwin` list in `gpuSwitches.js`; that is the only place platform
differences live.

## Packaging

Not set up. To ship an installer, add `electron-builder` or `electron-forge`,
bundle `docs/` as an extra resource, and point `ARA3D_DIR` at it. On macOS a
distributable build also needs code signing and notarization.

## Verified

On Windows 11 with an Intel Xe-LPG integrated GPU the multi-draw feature is
present, and models opened from the menu render through it:

| Model | Size | Draw commands | Triangles | FPS |
| --- | --- | --- | --- | --- |
| Snowdon Towers Sample Architectural.bos | 9 MB | 29,666 | 6.2M | 177 |
| snowdon.bfast | 54 MB | 29,666 | 6.2M | 128 |
| skyscraper-mep.bfast | 1.8 GB | 840,668 | 234M | 122 |
| nbk-test.bfast | 3.2 GB | 1,615,358 | 301M | 0.6 |

The last one loads and draws but is not interactive on this GPU. At 2.2 ms
of CPU per frame the draw calls are not the limit; the integrated GPU is.
