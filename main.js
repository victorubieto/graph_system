//  -- Víctor Ubieto --
//  Basic graph shader editor using litegraph library and litegl to view the result in WebGL 1
//

var webgl_canvas = null;
var parsedFile = [];
var shader;
var gl;

var camera = null;

const options = {
    quality: 100.0,
    color_bg: [0.5,0.5,0.5,1.0],
    color_mesh: [1.0,0.0,0.0,1.0],
    brightness: 1.0
}

const time = {
    last: 0,
    now: null,
    dt: null
}

const mouse = {
    button: 0,
    pos_x: 0,
    pos_y: 0,
    delta_x: 0,
    delta_y: 0,
    drag_state: false,
    wheel_value: 0,
    wheel_state: false
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
    var root = document.getElementById("editor");
    initGraphCanvas(root);
    //WebGL View
    root = document.getElementById("view-area");
    initWebGLView(root);
    //Init Buttons
    initListeners();

    //  ----- LOAD MATERIAL NEEDED -----
    //Load the shaders from a file
    loadShaderTemplates();    
    //Load the new nodes created
    addNewNodes();

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

    graphcanvas.background_image = "../graph_system/img/migrid.png";

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
    gl = GL.create({canvas: canvas});
    gl.animate();
}

// This function inits the button functions
function initListeners(){
    // Buttons
    var optButton = document.getElementById("options");
    var viewShader = document.getElementById("viewShader");
    var aboutButton = document.getElementById("about");

    optButton.addEventListener("click", function(){
        w2popup.open({
            width: 300, height: 300,
            title: 'Visualization Options',
            body: `<div style="padding-left:30px;"> 
            <br /> <br />
            <p>Background Color</p> <input id="in_bgcolor" class="color" onchange="updateOptions(this.id)">
            <script>    
                var elem = document.getElementById('in_bgcolor');
                var color = new jscolor.color(elem, {rgb: options.color_bg});
            </script>
            <br /> <br />
            <p>Mesh Color (if no rendering algorithm)</p> <input id="in_objcolor" class="color" onchange="updateOptions(this.id)">
            <script>    
                var elem = document.getElementById('in_objcolor');
                var color = new jscolor.color(elem, {rgb: options.color_mesh});
            </script>
            <br /> <br />
            <p>Quality</p> <input id="in_quality" class="w2ui-btn" onchange="updateOptions(this.id)" style="height:20px;"></input>
            <script> document.getElementById('in_quality').value = options.quality; </script>
            <br /> <br />
            <p>Brightness</p> <input id="in_brightness" class="w2ui-btn" onchange="updateOptions(this.id)" style="height:20px;"></input>
            <script> document.getElementById('in_brightness').value = options.brightness; </script>
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

    aboutButton.addEventListener("click", function(){
        w2popup.load({ 
            url: 'readme.html',
            showMax: true,
            width: 600,
            height: 500});
    }, false);

    window.addEventListener("resize", this.resizeView.bind(this));

    // Get mouse actions
    gl.captureMouse(true);
    gl.onmousemove = function(e)
    {
        mouse.button = e.buttons; // 1 left, 2 right, 4 middle
        mouse.pos_x = e.canvasx;
        mouse.pos_y = e.canvasy;
        mouse.drag_state = e.dragging;
        mouse.delta_x = e.deltax; // - 1 left to 1 right
        mouse.delta_y = e.deltay; // - 1 top to 1 down
    }
    gl.onmouseup = function(e)
    {
        mouse.drag_state = false;
        mouse.delta_x = 0;
        mouse.delta_y = 0;
    }
    gl.onmousewheel = function(e)
    {
        mouse.wheel_value = e.wheel;
	    mouse.wheel_state = true;
    }
    //gl.captureKeys(true); not used
}

function updateOptions(id)
{ 
    if (id == "in_bgcolor") options.color_bg = hexToRgb(document.getElementById('in_bgcolor').value);
    if (id == "in_objcolor") options.color_mesh = hexToRgb(document.getElementById('in_objcolor').value);
    if (id == "in_quality") options.quality = document.getElementById('in_quality').value;
    if (id == "in_brightness") options.brightness = document.getElementById('in_brightness').value;
}

function hexToRgb(hex) {
    var conversion = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    var result = [0,0,0]; //init
    result[0] = parseInt(conversion[1], 16)/128;
    result[1] = parseInt(conversion[2], 16)/128;
    result[2] = parseInt(conversion[3], 16)/128;
    return result;
  }

function resizeView()
{
    var root = document.getElementById("editor");
    var canvas = root.querySelector(".Graph");
    canvas.height = root.offsetHeight;
    canvas.width = root.offsetWidth;

    root = document.getElementById("view-area");
    canvas = root.querySelector(".View");
    canvas.height = root.offsetHeight;
    canvas.width = root.offsetWidth;
    var rect = canvas.getBoundingClientRect();
    gl.viewport(0, 0, rect.width, rect.height);
}

// This function reads the file that contains the shaders and store them
function loadShaderTemplates()
{
    GL.loadFileAtlas("shaders.glsl", function(files){
		parsedFile = files;
	});
}

// Basic Template that inits the web with the essential nodes
function graphTemplate()
{
    var node_color = LiteGraph.createNode("Input/Color");
    node_color.pos = [100,100];
    graph.add(node_color);

    var node_math = LiteGraph.createNode("Operator/Math");
    node_math.pos = [150,200];
    node_math.properties.OP = "*";
    graph.add(node_math);

    var node_noise = LiteGraph.createNode("Texture/Noise");
    node_noise.pos = [50,330];
    node_noise.properties.scale = 2.0;
    node_noise.properties.detail = 3;
    graph.add(node_noise);
    if(node_noise.properties.detail > 1) options.quality -= 70;

    var node_rot = LiteGraph.createNode("Operator/Rotate");
    node_rot.pos = [400,500];
    node_rot.properties._Z = -90.0;
    graph.add(node_rot);

    var node_tra = LiteGraph.createNode("Operator/Translate");
    node_tra.pos = [100,530];
    node_tra.properties._Y = 1.0;
    graph.add(node_tra);

    var node_grad = LiteGraph.createNode("Texture/Gradient");
    node_grad.pos = [350,350];
    graph.add(node_grad);

    var node_volume = LiteGraph.createNode("Shader/Volume");
    node_volume.pos = [350,150];
    graph.add(node_volume);

    var node_out = LiteGraph.createNode("Output/Final");
    node_out.pos = [600,200];
    graph.add(node_out);

    //Connections
    node_color.connect(0, node_volume, 0);
    node_math.connect(0, node_volume, 1);
    node_noise.connect(1, node_math, 0);
    node_tra.connect(0, node_rot, 0);
    node_rot.connect(0, node_grad, 0);
    node_grad.connect(1, node_math, 1);
    node_volume.connect(0, node_out, 1);   
}

function createScene()
{
    //camera settings
    camera = new RD.Camera({position: [0,50,10], aspect: gl.canvas.width / gl.canvas.height});

    //create default mesh
    obj.mesh = GL.Mesh.cube({size: 3});

    //adjust camera to mesh bounding
    if( obj.mesh != null )
    {
        camera._target = BBox.getCenter( obj.mesh.bounding );
        var r = BBox.getRadius( obj.mesh.bounding );
        camera._position = vec3.add( camera._position, camera._target, [0,r*0.5, r*3] );
    }

    //Basic shader while the parser hasn't read the other shaders yet
    var VS = `
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
    var FS = `
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
    shader = new Shader( VS, FS );
}

// ---------------------------------------- RENDER ----------------------------------------------- //

// Main Loop
function onLoad()
{
    window.graph.runStep(); //falta mirar el callback

    time.last = time.now || 0;
	time.now = getTime();
	time.dt = (time.now - time.last) * 0.001;
	update(time.dt);
    render();

    requestAnimationFrame(this.onLoad.bind(this));    
}

function render()
{
    //clear
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.clearColor(options.color_bg[0], options.color_bg[1], options.color_bg[2], options.color_bg[3]);

    //generic gl flags and settings
    gl.disable(gl.DEPTH_TEST);
    //gl.disable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    var inv_model = mat4.create();
    mat4.invert(inv_model, obj.model);

    //get local camera position (makes it easier in the shader)
    var aux_vec4 = vec4.fromValues(camera._position[0], camera._position[1], camera._position[2], 1);
    vec4.transformMat4(aux_vec4, aux_vec4, inv_model);
    var local_cam_pos = vec3.fromValues(aux_vec4[0]/aux_vec4[3], aux_vec4[1]/aux_vec4[3], aux_vec4[2]/aux_vec4[3]);

    if (shader != null)
    {
        //render mesh using the shader
        if(obj.mesh)
        shader.uniforms({
            u_camera_position: camera._position,
            u_local_camera_position: local_cam_pos,
            u_model: obj.model,
            u_obj_size: obj.mesh.size/2.0,
            u_mvp: camera._viewprojection_matrix,
            u_color: options.color_mesh,
            u_quality: options.quality,
            u_brightness: options.brightness
        }).draw(obj.mesh);
    }
}

function update(dt)
{
    updateCamera(dt);
}

function updateCamera(dt)
{

    if (gl.mouse.left_button || gl.mouse.right_button) //orbit
    {
        if (mouse.drag_state)
        {
            var yaw = -mouse.delta_x * dt * 0.7;
            var pitch = -mouse.delta_y * dt * 0.7;
            orbitCamera(yaw, pitch);
            
            mouse.drag_state = false;
        } 
    }
    if (mouse.wheel_state) //zoom
    {
        zoomCamera(dt);
        mouse.wheel_state = false;
    }
    
    //update camera
    mat4.lookAt(camera._view_matrix, camera._position, camera._target, [0,1,0]);
    mat4.perspective(camera._projection_matrix, camera._fov * DEG2RAD, camera._aspect, 0.1, 1000);

    //update modelview and projection matrices
    mat4.multiply(obj.temp, camera._view_matrix, obj.model);
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
    camera._fov += -mouse.wheel_value * dt;
}

// ---------------------------------------- PANEL ----------------------------------------------- //

function onShowNodePanel(node)
{
	window.SELECTED_NODE = node;
	var panel = document.querySelector("#node-panel");
	if(panel)
		panel.close();
    var ref_window = this.graphcanvas.getCanvasWindow();
	panel = this.createPanel(node.title || "",{closable: true, window: ref_window });
	panel.id = "node-panel";
	panel.classList.add("settings");
	var that = this;
	var graphcanvas = this.graphcanvas;

	function inner_refresh()
	{
		panel.content.innerHTML = ""; //clear
		panel.addHTML("<span class='node_type'>"+node.type+"</span><span class='node_desc'>"+(node.constructor.desc || "")+"</span><span class='separator'></span>");

		panel.addHTML("<h3>Properties</h3>");

		for(var i in node.properties)
		{
			var value = node.properties[i];
			var info = node.getPropertyInfo(i);
            var type = info.type || "string";
        
			//in case the user wants control over the side panel widget
            if( node.onAddPropertyToPanel && node.onAddPropertyToPanel(i,panel) )
                continue;

			panel.addWidget( info.widget || info.type, i, value, info, function(name,value){
				node.setProperty(name,value);
				graphcanvas.dirty_canvas = true;
			});
		}

		panel.addSeparator();

		panel.addButton("Delete",function(){
            node.graph.remove(node);
			panel.close();
		}).classList.add("delete");
	}

	function inner_showCodePad( node, propname )
	{
		panel.style.top = "calc( 50% - 250px)";
		panel.style.left = "calc( 50% - 400px)";
		panel.style.width = "800px";
		panel.style.height = "500px";

		if(window.CodeFlask) //disabled for now
		{
			panel.content.innerHTML = "<div class='code'></div>";
			var flask = new CodeFlask( "div.code", { language: 'js' });
			flask.updateCode(node.properties[propname]);
			flask.onUpdate( function(code) {
				node.setProperty(propname, code);
			});
		}
		else
		{
			panel.content.innerHTML = "<textarea class='code'></textarea>";
			var textarea = panel.content.querySelector("textarea");
			textarea.value = node.properties[propname];
			textarea.addEventListener("keydown", function(e){
				//console.log(e);
				if(e.code == "Enter" && e.ctrlKey )
				{
					console.log("Assigned");
					node.setProperty(propname, textarea.value);
				}
			});
			textarea.style.height = "calc(100% - 40px)";
		}
		var assign = that.createButton( "Assign", null, function(){
			node.setProperty(propname, textarea.value);
		});
		panel.content.appendChild(assign);
		var button = that.createButton( "Close", null, function(){
			panel.style.height = "";
			inner_refresh();
		});
		button.style.float = "right";
		panel.content.appendChild(button);
	}

    inner_refresh();

    // get the content
    var content = document.getElementById("graph-area");

	content.appendChild( panel );
}

function createPanel(title, options) 
{
	options = options || {};

    var ref_window = options.window || window;
    var root = document.createElement("div");
    root.className = "dialog";
    root.innerHTML = "<div class='dialog-header'><span class='dialog-title'></span></div><div class='dialog-content'></div><div class='dialog-footer'></div>";
    root.header = root.querySelector(".dialog-header");
	if(options.closable)
	{
	    var close = document.createElement("span");
		close.innerHTML = "&#10005;";
		close.classList.add("close");
		close.addEventListener("click",function(){
			root.close();
		});
		root.header.appendChild(close);
	}
    root.title_element = root.querySelector(".dialog-title");
	root.title_element.innerText = title;
    root.content = root.querySelector(".dialog-content");
    root.footer = root.querySelector(".dialog-footer");
	root.close = function()
	{
		this.parentNode.removeChild(this);
	}

	root.addHTML = function(code, classname)
	{
		var elem = document.createElement("div");
		if(classname)
			elem.className = classname;
		elem.innerHTML = code;
		root.content.appendChild(elem);
		return elem;
	}

	root.addButton = function( name, callback, options )
	{
		var elem = document.createElement("button");
		elem.innerText = name;
		elem.options = options;
		elem.addEventListener("click",callback);
		root.footer.appendChild(elem);
		return elem;
	}

	root.addSeparator = function()
	{
		var elem = document.createElement("div");
		elem.className = "separator";
		root.content.appendChild(elem);
	}

	root.addWidget = function( type, name, value, options, callback )
	{
		options = options || {};
		var str_value = String(value);
		if(type == "number")
			str_value = value.toFixed(3);

		var elem = document.createElement("div");
		elem.className = "property";
		elem.innerHTML = "<span class='property_name'></span><span class='property_value'></span>";
		elem.querySelector(".property_name").innerText = name;
		var value_element = elem.querySelector(".property_value");
		value_element.innerText = str_value;
		elem.dataset["property"] = name;
		elem.dataset["type"] = options.type || type;
		elem.options = options;
		elem.value = value;

		//if( type == "code" )
		//	elem.addEventListener("click", function(){ inner_showCodePad( node, this.dataset["property"] ); });
		if (type == "boolean")
		{
			elem.classList.add("boolean");
			if(value)
				elem.classList.add("bool-on");
			elem.addEventListener("click", function(){ 
				//var v = node.properties[this.dataset["property"]]; 
				//node.setProperty(this.dataset["property"],!v); this.innerText = v ? "true" : "false"; 
				var propname = this.dataset["property"];
				this.value = !this.value;
				this.classList.toggle("bool-on");
				this.querySelector(".property_value").innerText = this.value ? "true" : "false";
				innerChange(propname, this.value );
			});
		}
		else if (type == "string" || type == "number")
		{
			value_element.setAttribute("contenteditable",true);
			value_element.addEventListener("keydown", function(e){ 
				if(e.code == "Enter")
				{
					e.preventDefault();
					this.blur();
				}
			});
			value_element.addEventListener("blur", function(){ 
				var v = this.innerText;
				var propname = this.parentNode.dataset["property"];
				var proptype = this.parentNode.dataset["type"];
				if( proptype == "number")
					v = Number(v);
				innerChange(propname, v);
			});
		}
		else if (type == "enum")
			value_element.addEventListener("click", function(event){ 
				var values = options.values || [];
				var propname = this.parentNode.dataset["property"];
				var elem_that = this;
				var menu = new LiteGraph.ContextMenu(values,{
						event: event,
						className: "dark",
						callback: inner_clicked
					},
					ref_window);
				function inner_clicked(v, option, event) {
					//node.setProperty(propname,v); 
					//graphcanvas.dirty_canvas = true;
					elem_that.innerText = v;
					innerChange(propname,v);
					return false;
				}
			});

		root.content.appendChild(elem);

		function innerChange(name, value)
		{
			console.log("change",name,value);
			//that.dirty_canvas = true;
			if(options.callback)
				options.callback(name,value);
			if(callback)
				callback(name,value);
		}

		return elem;
	}

    return root;
};


// ---------------------------------------- DOWNLOAD ----------------------------------------------- //

function downloadFile()
{
    var body = `\\volume.vs
` + Previous_VS + `
        
\\volume.fs
` + Previous_FS;
    downloadString(body, "text/glsl", "shader_atlas.glsl");
}

function downloadString(text, fileType, fileName) 
{
    var blob = new Blob([text], { type: fileType });
  
    var a = document.createElement('a');
    a.download = fileName;
    a.href = URL.createObjectURL(blob);
    a.dataset.downloadurl = [fileType, a.download, a.href].join(':');
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function() { URL.revokeObjectURL(a.href); }, 1500);
  }