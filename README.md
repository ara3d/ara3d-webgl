# Ara 3D WebGL Viewer

A **WebGL viewer** for large 3D models of buildings and infrastructure built on [Three.JS](https://threejs.org) and forked from [VIM-WebGL-Viewer](https://github.com/vimaec/vim-webgl-viewer).

👉 Try a [live demo](https://ara3d.github.io/ara3d-webgl), watch a short [video on YouTube](https://www.youtube.com/watch?v=WUq6oUP684Y), or [browse the docs](https://ara3d.github.io/ara3d-webgl/api).

[![Ara 3D WebGL Viewer Demo](https://img.youtube.com/vi/WUq6oUP684Y/0.jpg)](https://www.youtube.com/watch?v=WUq6oUP684Y)

💬 We also welcome you to [join the conversation on Discord](https://discord.gg/gr7UV9Mat8).

## Motivation

At [Ara 3D](https://ara3d.com) along with our partners and customers who develop technology for AECO (Architecture Engineering Construction and Owners) professionals needed 
a simple open-source library to efficiently load and display large 3D BIM (Building Information Modeling) models in WebGL.

> "It's incredibly enjoyable to work with—strikes the perfect balance between built-in functionality like highlighting and zoom-to-extent features, without feeling overly prescriptive. Outstanding work 🙌" - [Louis Trümpler](https://www.linkedin.com/posts/louistrue_open-source-to-the-moon-just-created-activity-7311734789227638784-Lfrf). 
 
We needed the viewer to be easy to customize for different use cases while providing support for large numbers of similar objects, which is common in BIM models.

## Why This Viewer and not Another?

There are many excellent WebGL viewers (see the Appendix below). 
Three.JS makes writing a simple one easy, at least at first. 
Adding common features quickly turns into a lot of work, especially if you have 
large architectural or BIM models with lots of objects. 

This library is a good starting point for your own 3D viewing needs if you want:

1.  a commercially friendly open-source library (MIT)
2.  to build from a widely used Web GL library (Three.JS)
3.  to efficiently display data with a lot of instanced geometry (i.e., repeated meshes in different positions and orientations) 
4.  features like section boxes, hit-testing, outlining, and camera controls 
5.  good quality and easy to understand TypeScript code. 
6.  to integrate into your own branded front-end code 
7.  minimal dependencies 

## Features 

- Mouse, keyboard, and touch input 
- Orbit and first person camera controls  
- Highlighting
- Outlining 
- Transparency
- Isolation with ghosting 
- Zoom to extents 
- Section boxes
- Hit testing

## History 

At Ara3D we created a simple 3D web-viewer in March 2019 which had support for multiple file formats. 

The [VIM](https://vimaec.com) team took over the project in July 2021 and the team, mostly [Simon Roberge](https://github.com/vim-sroberge), 
added many features and enhancements. They also customized the project to meet the needs of their 
PowerBI offering.  

On December 17, 2024, the VIM team archived the project, and merged it with their React-based viewer 
project into a new repository https://github.com/vimaec/vim-web. Today the VIM viewer is very powerful, 
but has become very specialized to their use-cases.

This project revives the spirit of the original viewer, while leveraging many of the excellent
contributions made by VIM. This repository was created on March 26th 2025 from a snapshot of the VIM repository 
from 2022, but with some significant refactoring.

We also took the excellent examples that were created by Simon and compiled them in a single easy to view demo.

### What has Changed from VIMAEC Web 

There are a number of differences between this project and the one currently [maintained by VIM](https://github.com/vimaec/vim-web):

- Removed all code related to:
  - The React UI framework 
  - Support for pixel-streaming, their "ultra-viewer"
- Removed dead and unused code and files  
- Added examples that can be easily tested from the Vite dev server
- Restructured the files and folders 

## Building and Running 

The project uses [vite](https://vite.dev/) for bundling and development. 

Some of the common tasks, which can be found in the `package.json`.

- `npm run dev` - Running the vite dev server with "hot reloading" 
- `npm run build:docs` - Building the examples and API documentation. 
- `npm run serve:docs` - Testing the built examples and API documentation locally 
- `npm run build:lib` - Building the library as a JavaScript module (`.mjs`) file

## Camera Controls

### Keyboard

- `W`, `Up` - Move camera forward  
- `A`, `Left` - Move camera to the left  
- `S`, `Down` - Move camera backward  
- `D`, `Right` - Move camera to the right  
- `E` -  Move camera up  
- `Q` - Move camera down  
- `Shift` - faster camera movement while pressed  
- `+` - Increase camera speed  
- `-` - Decrease camera speed

- `Space` - Toggle orbit mode  
- `Home` - Frame model  
- `Escape` - Clear selection  
- `F` Frame selection

### Mouse

- `Hold left click + Move mouse` - Rotate camera in current mode  
- `Hold right click + Move mouse` - Pan/tilt camera
- `Hold middle click + Move mouse` - Truck/pedestal camera
- `Mouse wheel` - Dolly Camera  
- `Left click` - Select object  
- `Ctrl + Mouse wheel` - Increase/decrease camera speed

### Touch

- `One Finger swipe` - Tilt/Pan camera  
- `Two Finger swipe` - Truck/Pedestal camera  
- `Two Finger pinch/spread` - Dolly Camera

# Roadmap

What is on the horizon:

- Inline the VIM, G3D, and BFAST code in this project (and clean it up)
- Support for more file formats
- More demos
- Improved scene management
- Performance tests and benchmarks
- Improved performance
- Streaming and LOD (Level of Detail) support

## Requesting Features, Improvements, or Changes

Feel free to log issues or submit pull requests.  

We also offer very affordable custom software development services if you are using this project in a 
commercial context. For more information reach out to us at [info@ara3d.com](mailto:info@ara3d.com).

# Appendix

## Related Projects: WebGL Viewers

* [Autodesk Viewer](https://viewer.autodesk.com/)
* [Bentley iTwin](https://www.itwinjs.org/)
* [Babylon.JS](https://www.babylonjs.com/)
* [Bldrs.AI](https://bldrs.ai/)
* [Cesium](https://sandcastle.cesium.com/?src=Cesium%20OSM%20Buildings.html)
* [glTF Sample Viewer](https://github.com/KhronosGroup/glTF-Sample-Viewer)
* [That Open Engine - Web IFC](https://github.com/ThatOpen/engine_web-ifc)
* [Revit 3JS](https://github.com/McCulloughRT/Rvt3js)
* [Speckle](https://github.com/specklesystems/speckle-server)
* [vA3C](https://va3c.github.io/)
* [VIMAEC Web](https://github.com/vimaec/vim-web)
* [XBim Web UI](https://github.com/xBimTeam/XbimWebUI)
* [Xeokit](https://github.com/xeokit/xeokit-sdk)
