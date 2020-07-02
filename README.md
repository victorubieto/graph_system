# Node-Based Shader Editor
 
This is the result of my final degree project, which consist on a node-based shader editor implemented on web. The framework is based mainly on the usage of this libraries:

 * [Litegl.js](https://github.com/jagenjo/litegl.js) - It helps simplifying working with WebGL.
 * [Litegraph.js](https://github.com/jagenjo/litegraph.js) - A library in Javascript to create graphs in the browser.

## Functionalities

This is the list of the most important functionalities of the application.

 * Manipulation of the Volume Render algorithm via nodes.
 * Load and visualization of Dicom datasets. In the case you don't have any but you want to try it, I uploaded an anonymized dataset in the repository. More info [here](https://www.dicomlibrary.com/).
 * Manipulation of the datasets by editing the transfer function.
 * Download of the Vertex Shader and Fragment Shader createds by the graph editor.
 * Try an online demo [here](https://victorubieto.github.io/graph_system/).

## List of Nodes

This is the list of the nodes currently available. There are more comming soon, so stay tunned.

 * **Input:** Number, Color, Coordinates, Transfer Function.
 * **Texture:** Gradient, Noise, Dicom.
 * **Operator:** Math, MixRGB, ColorRamp, Translate, Scale, Rotate.
 * **Shader:** Volume.
 * **Output:** Material Output.

## Other libraries used

 * [W2ui.js](https://github.com/vitmalina/w2ui)
 * [JsColor.js](https://github.com/EastDesire/jscolor)
 * [Rendeer.js](https://github.com/jagenjo/rendeer.js)
 * [Volume-base.js](https://github.com/upf-gti/Volumetrics/blob/master/src/volume-base.js)
 * [Volume-loader.js](https://github.com/upf-gti/Volumetrics/blob/master/src/volume-loader.js)
 * [JQuery.js](https://github.com/jquery/jquery)
 * [Gl-Matrix.js](https://github.com/toji/gl-matrix)
 * [Daikon.js](https://github.com/rii-mango/Daikon)
