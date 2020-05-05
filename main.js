//  -- Víctor Ubieto --
//  Basic web template using litegraph library and a WebGL view canvas
//

var webgl_canvas = null;
var parsedFile = [];
var shader;
var gl;

const camera = {
    cam_pos: mat4.create(),
    cam_center: mat4.create(),

    proj: mat4.create(),
    view: mat4.create(),
    mvp: mat4.create() //viewprojection
}

const obj = {
    mesh: null,
    model: mat4.create(),
    temp: mat4.create() //model_view
}

init();

function init()
{
    //  ----- INIT CANVAS FUNCTIONALITIES -----
    //GraphCanvas
    var root = document.getElementById("graph-area");
    initGraphCanvas(root);
    //WebGL View
    root = document.getElementById("view-area");
    initWebGLView(root)

    //  ----- LOAD MATERIAL NEEDED -----
    //Load the shaders from a file
    loadShaderTemplates();    
    //Load the new nodes created
    addNewNodes();

    //  ----- INIT BASIC SCENE -----
    //Creates some essential nodes on the initial canvas
    basicTemplate();
    //Inits the scene to render
    createScene();

    //  ----- MAIN LOOP -----
    onLoad();
}


// Graph Canvas Creation
function initGraphCanvas(container_id)
{
    //como es de uso personal asumo que ya he creado un canvas en el html
    var canvas = container_id.querySelector(".Graph");
    var graph = new LGraph();
    var graphcanvas = new LGraphCanvas(canvas, graph);

    graphcanvas.background_image = "img/migrid.png";

    graph.onAfterExecute = function() {
        graphcanvas.draw(true);
    };

    window.graphcanvas = graphcanvas;
    window.graph = graph;
}


// WebGL Canvas Creation
function initWebGLView(container_id)
{ 
    //como es de uso personal asumo que ya he creado un canvas en el html
    var canvas = container_id.querySelector(".View");
    gl = GL.create({canvas: canvas});
    gl.animate();
}


// This function reads the file that contains the shaders and store them
function loadShaderTemplates()
{
    GL.loadFileAtlas("shaders.glsl", function(files){
		parsedFile = files;
	});
}


// Basic Template that inits the web with the essential nodes
function basicTemplate()
{
    var node_color = LiteGraph.createNode("VICTOR/Color");
    node_color.pos = [50,300];
    graph.add(node_color);
    node_color.setValue([0.0,1.0,1.0,1.0]);

    var node_num = LiteGraph.createNode("VICTOR/Number");
    node_num.pos = [50,200];
    graph.add(node_num);
    //node_num.prototype.setValue(5);

    var node_volume = LiteGraph.createNode("VICTOR/Volume");
    node_volume.pos = [300,200];
    graph.add(node_volume);

    var node_out = LiteGraph.createNode("VICTOR/Final");
    node_out.pos = [550,200];
    graph.add(node_out);

    //Connections
    node_num.connect(0, node_volume, 0);
    node_color.connect(0, node_volume, 1);
    node_volume.connect(0, node_out, 1);   
}


function createScene()
{
    //camera settings
    camera.cam_pos = new Float32Array([0,50,10]);
    camera.cam_center = new Float32Array([0,0,0]);

    //get mouse actions
    gl.captureMouse(true);
    gl.onmousemove = function(e) // ME FALTA EL ORBIT
    {
        if(!e.dragging)
            return;
        vec3.rotateY(camera.cam_pos,camera.cam_pos,e.deltax * 0.01);
        camera.cam_pos[1] += e.deltay * 0.05;
    }
    gl.onmousewheel = function(e) // AUN NO VA COMO QUIERO
    {
        if(!e.wheel)
            return;
        var dir = new Float32Array(3);
        vec3.subtract(dir, camera.cam_pos, camera.cam_center);
        dir[2] += e.delta * -0.1;
        vec3.add(camera.cam_pos, dir, camera.cam_center);
    
        mat4.lookAt(camera.view, camera.cam_pos, camera.cam_center, [0,1,0]);
	    mat4.multiply(camera.mvp, camera.view, camera.proj);
    }

    //set the camera position
    mat4.perspective(camera.proj, 45 * DEG2RAD, gl.canvas.width / gl.canvas.height, 0.1, 1000);
    mat4.lookAt(camera.view, camera.cam_pos, camera.cam_center, [0,1,0]);

    gl.captureKeys();

    //create default mesh
    // ha de ser size = 2 porque ira de 1 a -1 y ha de coordinar con la condicion de salida del shader (falta poner automatico)
    obj.mesh = GL.Mesh.cube({size: 2});

    //adjust camera to mesh bounding
    if( obj.mesh != null )
    {
        camera.cam_center = BBox.getCenter( obj.mesh.bounding );
        var r = BBox.getRadius( obj.mesh.bounding );
        camera.cam_pos = vec3.add( camera.cam_pos, camera.cam_center, [0,r*0.5, r*3] );
    }

    //Basic shader while the parser hasn't read the other shaders yet
    VS = `
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
    FS = `
        precision highp float;
        varying vec3 v_normal;
        uniform vec4 u_camera_position;
        uniform vec4 u_color;
        void main() {
            vec4 final_color = u_color;
            gl_FragColor = vec4( final_color.xyz, 1.0 );
        }
        `;
        
    //shader
    shader = new Shader( VS, FS );
}

// Main Loop
function onLoad()
{
    window.graph.runStep(); //falta mirar el callback

	//update(dt);
    render();

    requestAnimationFrame( this.onLoad.bind(this) );    
}


function render()
{
    //clear
    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
    gl.clearColor(0.1,0.1,0.1,1);

    //generic gl flags and settings
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);

    mat4.lookAt(camera.view, camera.cam_pos, camera.cam_center, [0,1,0]);

    //create modelview and projection matrices
    mat4.multiply(obj.temp, camera.view, obj.model);
    mat4.multiply(camera.mvp, camera.proj, camera.view);

    var inv_model = mat4.create();
    mat4.invert(inv_model, obj.model);

    //get local camera position (makes it easier in the shader)
    var aux_vec4 = vec4.fromValues(camera.cam_pos[0], camera.cam_pos[1], camera.cam_pos[2], 1);
    vec4.transformMat4(aux_vec4, aux_vec4, inv_model);
    var local_cam_pos = vec3.fromValues(aux_vec4[0]/aux_vec4[3], aux_vec4[1]/aux_vec4[3], aux_vec4[2]/aux_vec4[3]);

    if (shader != null)
    {
        //render mesh using the shader
        if(obj.mesh)
        shader.uniforms({
            u_color: [1,0,0,1],
            u_camera_position: camera.cam_pos,
            u_local_camera_position: local_cam_pos,
            u_model: obj.model,
            u_mvp: camera.mvp,
            u_quality: 100.0,
        }).draw(obj.mesh);
    }
}

