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
    mvp: mat4.create(), //viewprojection
}

const obj = {
    mesh: null,
    model: mat4.create(),
    temp: mat4.create(), //model_view
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
    var optButton = document.getElementById("options");
    var viewShader = document.getElementById("viewShader");
    var helpButton = document.getElementById("help");

    optButton.addEventListener("click", function(){
    }, false);

    viewShader.addEventListener("click", function(){
        w2popup.open({
            width: 700, height: 500,
            title: 'Shaders in Use',
            body: '<br /> <h3>Vertex Shader</h3>' + 
                '<pre>' + Previous_VS + '</pre>' +
                '<br /> <h3>Fragment Shader</h3>' +
                '<pre>' + Previous_FS + '</pre>',
            onOpen  : function () {
                console.log('opened');
            }           
        });
    }, false);

    helpButton.addEventListener("click", function(){
        w2popup.load({ 
            url: 'help.html',
            showMax: true,
            width: 800,
            height: 600});
    }, false);
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
    // Al final lo ordenare para dejar los que se van a quedar predeterminados!!!
    var node_color = LiteGraph.createNode("Input/Color");
    node_color.pos = [50,200];
    graph.add(node_color);

    var node_num = LiteGraph.createNode("Input/Number");
    node_num.pos = [50,300];
    graph.add(node_num);

    var node_volume = LiteGraph.createNode("Shader/Volume");
    node_volume.pos = [300,200];
    graph.add(node_volume);

    var node_out = LiteGraph.createNode("Output/Final");
    node_out.pos = [550,200];
    graph.add(node_out);

    var node_dicom = LiteGraph.createNode("Texture/Dicom");
    node_dicom.pos = [350,400];
    graph.add(node_dicom);

    //Connections
    node_color.connect(0, node_volume, 0);
    node_num.connect(0, node_volume, 1);
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
        void main() {
            vec4 final_color = u_color;
            gl_FragColor = vec4( final_color.xyz, 1.0 );
        }
        `;
        
    //shader
    shader = new Shader( VS, FS );
}

// ---------------------------------------- RENDER ----------------------------------------------- //

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
            u_color: [0,0,1,1],
            u_camera_position: camera.cam_pos,
            u_local_camera_position: local_cam_pos,
            u_model: obj.model,
            u_mvp: camera.mvp,
            u_quality: 100.0,
        }).draw(obj.mesh);
    }
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