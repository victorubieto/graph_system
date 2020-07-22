
/** --- Víctor Ubieto 2020 ---
 *  Main file that controls the application
**/

"use strict"

// Global variables
var shader_atlas = [];
var shader;
var gl;

var camera = null;
var mouse = null;
var entity = null;

const options = {
    quality: 32.0,
    color_bg: [0.82, 0.91, 0.98, 1.0],
    color_mesh: [1.0, 0.0, 1.0, 1.0],
    brightness: 1.0
}

const time = {
    last: 0,
    now: null,
    dt: null
}

// Executes the app //
init();

function init()
{
    //  ----- INIT CANVAS FUNCTIONALITIES -----
    //GraphCanvas
    var root = document.getElementById("editor");
    initGraphCanvas(root);
    //WebGL View
    root = document.getElementById("view-area");
    initWebGLView(root);
    //Init Buttons
    initListeners();

    //  ----- LOAD MATERIAL NEEDED -----
    //Load the shaders from a file
    loadShaderAtlas();
    //Load the nodes created
    addNodes();

    //  ----- INIT BASIC SCENE -----
    //Creates some essential nodes on the initial canvas
    graphTemplate();
    //Inits the scene to render
    createScene();

    //  ----- MAIN LOOP -----
    onLoad();
}

// ---------------------------------------- INIT ----------------------------------------------- //

// Graph Canvas Creation
function initGraphCanvas(container_id)
{
    var canvas = container_id.querySelector(".Graph");
    canvas.height = container_id.offsetHeight;
    canvas.width = container_id.offsetWidth;

    var graph = new LGraph();
    var graphcanvas = new LGraphCanvas(canvas, graph);

    graphcanvas.background_image = "../../graph_system/img/migrid.png";

    graph.onAfterExecute = function() {
        graphcanvas.draw(true);
    };

    window.graphcanvas = graphcanvas;
    window.graph = graph;

    graphcanvas.onShowNodePanel = onShowNodePanel.bind(this);
}

// WebGL Canvas Creation
function initWebGLView(container_id)
{ 
    var canvas = container_id.querySelector(".View");
    canvas.height = container_id.offsetHeight;
    canvas.width = container_id.offsetWidth;
    gl = GL.create({canvas: canvas, version: 2}); //webgl2 for the 3d textures
	if( gl.webgl_version != 2 || !gl ){
	    alert("WebGL 2.0 not supported by your browser");
	}
    gl.animate();
}

// This function inits listeners (buttons, mouse, keys, ...)
function initListeners()
{
    // Set buttons
    var optButton = document.getElementById("options");
    var viewShader = document.getElementById("viewShader");
    var cleanGraph = document.getElementById("cleanGraph");
    var aboutButton = document.getElementById("about");

    optButton.addEventListener("click", function(){
        w2popup.open({
            width: 300, height: 300,
            url: 'readme.html',
            title: 'Visualization Options',
            body: `<div style="padding-left:30px;"> 
            <br /> <br />
            <p>Background Color</p> <input id="in_bgcolor" class="color" onchange="updateOptions(this.id)">
            <script>    
                var elem = document.getElementById('in_bgcolor');
                var color = new jscolor.color(elem, {rgb: options.color_bg});
            </script>

            <br /> <br />
            <p>Mesh Color (surface rendering)</p> <input id="in_objcolor" class="color" onchange="updateOptions(this.id)">
            <script>    
                var elem = document.getElementById('in_objcolor');
                var color = new jscolor.color(elem, {rgb: options.color_mesh});
            </script>

            <br /> <br />            
            <p>Quality: <span id="quality_val"></span></p>
            <input type="range" min="1" max="100" value="50" class="slider" id="in_quality" onchange="updateOptions(this.id)">
            <br /> <br />
            <script>
                var slider = document.getElementById("in_quality");
                slider.value = options.quality;
                var quality_out = document.getElementById("quality_val");
                quality_out.innerHTML = slider.value;
                slider.oninput = function() {
                    quality_out.innerHTML = this.value;
                }
            </script>
            <p>Brightness: <span id="brightness_val"></span></p>
            <input type="range" min="0" max="10" value="1" class="slider" id="in_brightness" onchange="updateOptions(this.id)">
            <script>
                var slider = document.getElementById("in_brightness");
                slider.value = options.brightness;
                var brightmess_out = document.getElementById("brightness_val");
                brightmess_out.innerHTML = slider.value;
                slider.oninput = function() {
                    brightmess_out.innerHTML = this.value;
                }
            </script>
            </div>`,
            onOpen  : function () {
                console.log('opened');
            }           
        });
    }, false);

    viewShader.addEventListener("click", function(){
        w2popup.open({
            width: 700, height: 500,
            title: 'Shaders in Use',
            body: '<br /> <h3>Vertex Shader</h3>' + 
                '<pre>' + Previous_VS + '</pre>' +
                '<br /> <h3>Fragment Shader</h3>' +
                '<pre>' + Previous_FS + '</pre>',
            buttons: '<button class="w2ui-btn" onclick="downloadFile()">Download</button>',
            onOpen  : function () {
                console.log('opened');
            }
        });
    }, false);

    cleanGraph.addEventListener("click", function(){
            if (confirm("Do you want to clean the editor?")) {
                var length = graph._nodes_in_order.length;
                for (var i = 0; i < (length - 2); i++){
                    var node = graph._nodes_in_order[0];
                    node.graph.remove(node);
                }
                console.log("Existing graph deleted.");
            } else {
                console.log("Cleaning operation canceled.");
            }
    }, false);

    aboutButton.addEventListener("click", function(){
        w2popup.load({ 
            url: 'readme.html',
            showMax: true,
            width: 600,
            height: 500});
    }, false);

    window.addEventListener("resize", resizeView.bind(this));

    // Get mouse actions
    mouse = new Mouse();
}

// This function reads the file that contains the shaders and store them
function loadShaderAtlas()
{
    GL.loadFileAtlas("../shaders.glsl", function(files){
		shader_atlas = files; //parsed file
	});
}

// Basic Template that inits the web with the essential nodes
function graphTemplate()
{
    var node_color = LiteGraph.createNode("Input/Color");
    node_color.pos = [350,75];
    node_color.setValue([1.0,1.0,1.0]);
    graph.add(node_color);

    var node_math = LiteGraph.createNode("Operator/Math");
    node_math.pos = [150,75];
    node_math.properties.OP = "*";
    graph.add(node_math);

    var node_tra1 = LiteGraph.createNode("Operator/Translate");
    node_tra1.pos = [50,530];
    graph.add(node_tra1);

    var node_noise = LiteGraph.createNode("Texture/Noise");
    node_noise.pos = [50,350];
    node_noise.setScale(2.0);
    node_noise.setDetail(3.0);
    graph.add(node_noise);

    var node_ramp = LiteGraph.createNode("Operator/ColorRamp");
    node_ramp.pos = [50,200];
    graph.add(node_ramp);

    var node_rot = LiteGraph.createNode("Operator/Rotate");
    node_rot.pos = [550,575];
    node_rot.setZ(-90.0);
    graph.add(node_rot);

    var node_tra2 = LiteGraph.createNode("Operator/Translate");
    node_tra2.pos = [300,575];
    node_tra2.setY(-0.5);
    graph.add(node_tra2);

    var node_grad = LiteGraph.createNode("Texture/Gradient");
    node_grad.pos = [520,420];
    graph.add(node_grad);

    var node_volume = LiteGraph.createNode("Shader/Volume");
    node_volume.pos = [500,175];
    graph.add(node_volume);

    var node_out = LiteGraph.createNode("Output/Material Output");
    node_out.pos = [600,80];
    graph.add(node_out);

    //Connections
    node_color.connect(0, node_volume, 0);
    node_tra1.connect(0, node_noise, 0);
    node_noise.connect(1, node_ramp, 0);
    node_ramp.connect(1, node_math, 0);
    node_tra2.connect(0, node_rot, 0);
    node_rot.connect(0, node_grad, 0);
    node_volume.connect(0, node_out, 0);
}

function createScene()
{
    //create camera
    camera = new RD.Camera({position: [0,10,10], aspect: gl.canvas.width / gl.canvas.height});

    //create default mesh
    entity = new Entity({type: "cube", size: 2});

    //adjust camera to mesh bounding
    entity.centerInView(camera);

    //Basic shader while the parser hasn't read the other shaders yet
    var fastVS = `
        precision highp float;
        attribute vec3 a_vertex;
        attribute vec3 a_normal;
        attribute vec4 a_color;
        uniform mat4 u_mvp;
        uniform mat4 u_model;
        varying vec3 v_normal;
        varying vec4 v_color;
        void main() {
            v_normal = (u_model * vec4(a_normal,0.0)).xyz;
            gl_Position = u_mvp * vec4(a_vertex,1.0);
        }
        `;
    var fastFS = `
        precision highp float;
        varying vec3 v_normal;
        uniform vec4 u_camera_position;
        uniform vec4 u_color;

        uniform vec3 u_vertex;
        void main() {
            vec4 final_color = u_color;
            gl_FragColor = vec4( final_color.xyz, 1.0 );
        }
        `;
        
    //Basic shader
    shader = new Shader( fastVS, fastFS );
}

// ---------------------------------------- RENDER ----------------------------------------------- //

// Main Loop
function onLoad()
{
    window.graph.runStep(); 

    time.last = time.now || 0;
	time.now = getTime();
	time.dt = (time.now - time.last) * 0.001;
	update(time.dt);
    render();

    requestAnimationFrame( onLoad.bind(this) );
}

function render()
{
    //clear
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.clearColor(options.color_bg[0], options.color_bg[1], options.color_bg[2], options.color_bg[3]);

    //generic gl flags and settings
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    
    var inv_model = mat4.create();
    mat4.invert(inv_model, entity._model_matrix);

    //get local camera position (makes it easier in the shader)
    var aux_vec4 = vec4.fromValues(camera._position[0], camera._position[1], camera._position[2], 1);
    vec4.transformMat4(aux_vec4, aux_vec4, inv_model);
    var local_cam_pos = vec3.fromValues(aux_vec4[0]/aux_vec4[3], aux_vec4[1]/aux_vec4[3], aux_vec4[2]/aux_vec4[3]);

    if (shader != null)
    {
        //render mesh using the shader
        if(entity._mesh)
        shader.uniforms({
            u_camera_position: camera._position,
            u_local_camera_position: local_cam_pos,
            u_model: entity._model_matrix,
            u_obj_size: entity._mesh.size/2.0 || entity._mesh.radius, //divided by 2 because it is centered in 0
            u_mvp: camera._viewprojection_matrix,
            u_color: options.color_mesh,
            u_quality: options.quality,
            u_brightness: options.brightness
        }).draw(entity._mesh);
    }
}

function update(dt)
{
    updateCamera(dt);
}

function updateCamera(dt)
{
    if (mouse._button == 1 || mouse._button == 4) //left,center: orbit
    {
        if (mouse._drag_state)
        {
            var yaw = -mouse._delta_x * dt * 0.7;
            var pitch = -mouse._delta_y * dt * 0.7;
            orbitCamera(yaw, pitch);
            
            mouse._drag_state = false;
        } 
    }
    if (mouse._button == 2) //right: pan
    {
        if (mouse._drag_state)
        {
            camera.moveLocal([-mouse._delta_x * dt * 0.3, mouse._delta_y * dt * 0.3, 0], camera._fov/45);
            mouse._drag_state = false;
        }
    }
    if (mouse._wheel_state) //wheel: zoom
    {
        zoomCamera(dt);
        mouse._wheel_state = false;
    }
    
    //update camera
    mat4.lookAt(camera._view_matrix, camera._position, camera._target, [0,1,0]);
    mat4.perspective(camera._projection_matrix, camera._fov * DEG2RAD, camera._aspect, 0.1, 1000);

    //update modelview and projection matrices
    mat4.multiply(entity._modelview_matrix, camera._view_matrix, entity._model_matrix);
    mat4.multiply(camera._viewprojection_matrix, camera._projection_matrix, camera._view_matrix);
}

function orbitCamera(yaw, pitch)
{
    camera.orbit(yaw, camera._up);

    var front = vec3.create();
    vec3.subtract(front, camera._target, camera._position)
    vec3.normalize(front, front);
    var up = vec3.clone(camera._up);
    vec3.normalize(up, up);
    var problem_angle = vec3.dot(front, up);
    if(!((problem_angle > 0.99 && pitch > 0) || (problem_angle < -0.99 && pitch < 0)))
    {
        var right = vec3.create();
        camera.getLocalVector([1.0, 0, 0], right);
        camera.orbit(pitch, right);
    }
}

function zoomCamera(dt)
{
    camera._fov += -mouse._wheel_value * dt;
    camera._fov = Math.max(0.0, camera._fov);
}