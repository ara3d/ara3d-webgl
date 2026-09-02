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
| `--devtools` | | Open developer tools in a separate window. |

## Files

| File | Role |
| --- | --- |
| `main.js` | Entry point: applies switches, starts the server, opens the window. |
| `gpuSwitches.js` | The Chromium switches, per platform. |
| `appTarget.js` | Turns arguments and environment into a URL to load. |
| `staticServer.js` | Read-only file server on localhost. |
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

On Windows 11 with an Intel Xe-LPG integrated GPU: the multi-draw feature is
present, and the Snowdon Towers sample renders 29,666 draw commands in a single
`multiDrawIndexedIndirect` call at roughly 175 frames per second.
