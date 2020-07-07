
/** --- Víctor Ubieto 2020 ---
 *  This file contains useful functions that are used in the framework 
**/

// Pass to hexadecimal to rgb (in bright color the conversion gives some errors) 
// (https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb)
function hexToRgb(hex) {
    var conversion = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    var result = [0,0,0]; //init
    result[0] = parseInt(conversion[1], 16)/128;
    result[1] = parseInt(conversion[2], 16)/128;
    result[2] = parseInt(conversion[3], 16)/128;
    return result;
  }

// Controls the dimensions of the window and the elements when modifying the size
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

// Function that controls the values from the options panel
function updateOptions(id)
{ 
    switch (id) 
    {
        case "in_bgcolor":
            var bgcolor = document.getElementById('in_bgcolor');
            options.color_bg = hexToRgb(bgcolor.value);
            break;
        case "in_objcolor":
            var objcolor = document.getElementById('in_objcolor');
            options.color_mesh = hexToRgb(objcolor.value);
            break;
        case "in_quality":
			var quality = document.getElementById('in_quality').value;
			options.quality = quality;
            break;
        case "in_brightness":
			var brightness = document.getElementById('in_brightness').value;
			options.brightness = brightness;
            break;
    }
}

// Download a File
function downloadFile()
{
    var body = `\\volume.vs
` + Previous_VS + `
        
\\volume.fs
` + Previous_FS;
    downloadString(body, "text/glsl", "shader_atlas.glsl");
}

// Download a File (https://gist.github.com/danallison/3ec9d5314788b337b682)
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

// Panel Functions (https://github.com/jagenjo/litegraph.js/blob/master/src/litegraph-editor.js)
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

// Panel Functions (https://github.com/jagenjo/litegraph.js/blob/master/src/litegraph-editor.js)
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