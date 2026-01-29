# Ara 3D WebGL - BIM Open Schema Viewer

[![NPM Version](https://img.shields.io/npm/v/%40ara3d%2Fara3d-webgl)](https://www.npmjs.com/package/@ara3d/ara3d-webgl)

## [Live Demo](https://ara3d.github.io/ara3d-webgl/)

<img
  src="https://github.com/user-attachments/assets/99407018-c5d2-46b2-b602-7e4671c87860"
  alt="BIM Open Schema Viewer"
  width="200"
  height="157"
  align="right"
/>

A **WebGL viewer** for extremely large 3D models of buildings and infrastructure 
represented as [BIM Open Schema .BOS files](https://github.com/ara3d/bim-open-schema).

BIM Open Schema is an ultra-compressed and portable BIM data format, which 
is easily extended, built on top [Parquet](https://parquet.apache.org/) format.
A .BOS file is a ZIP archive that contains multiple Parquet files, which contain
geometry, parameters, and other BIM data. 

## Show me the code! 

We've tried to keep the code as straightforward and legible as possible:

- The Three.JS file loader: [`bimOpenSchemaLoader.ts`](https://github.com/ara3d/ara3d-webgl/blob/main/src/loader/bimOpenSchemaLoader.ts)
- The BIM Geometry type definition: [`bimGeometry.ts`](https://github.com/ara3d/ara3d-webgl/blob/main/src/loader/bimGeometry.ts)
- The conversion to Three.JS geometry: [`buildGeometryGroup.ts`](https://github.com/ara3d/ara3d-webgl/blob/main/src/loader/buildGeometryGroup.ts)

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

## History

At Ara 3D we created a simple 3D web-viewer in March 2019 which had support for multiple file formats. 
The goal was to minimize the amount of code required to create and host a Three.JS viewer in a web-page. 

The VIM team took over the project in July 2021 and the team, mostly Simon Roberge, 
added many features and enhancements. They also customized the project to meet the needs of their Power BI offering.

On December 17, 2024, the VIM team archived the project, and merged it with their React-based viewer project into a 
new repository https://github.com/vimaec/vim-web. Today the VIM viewer is very powerful, but has become very specialized 
to their use-cases.

In early 2025 the Ara 3D WebGL project was forked from an earlier snapshot of the repo to revive the spirit of the original viewer, 
while leveraging many of the excellent contributions made by VIM.

Today in December 2026, we are focusing on using this viewer as a showcase of the [BIM Open Schema](https://github.com/ara3d/bim-open-schema)
data format. 

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
* [e-verse GLTF viewer](https://gltfviewer.e-verse.com/)
* [glTF Sample Viewer](https://github.com/KhronosGroup/glTF-Sample-Viewer)
* [That Open Engine - Web IFC](https://github.com/ThatOpen/engine_web-ifc)
* [Revit 3JS](https://github.com/McCulloughRT/Rvt3js)
* [Speckle](https://github.com/specklesystems/speckle-server)
* [vA3C](https://va3c.github.io/)
* [VIMAEC Web](https://github.com/vimaec/vim-web)
* [XBim Web UI](https://github.com/xBimTeam/XbimWebUI)
* [Xeokit](https://github.com/xeokit/xeokit-sdk)
