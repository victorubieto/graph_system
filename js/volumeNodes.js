
/** --- Víctor Ubieto 2020 ---
 *  This file adds all the nodes implemented for the graph editor
**/

var Previous_VS = null;
var Previous_FS = null;

const macros = {
    TEXTURE_TYPE: 1,
    NORMALIZE_VOXEL_VALUE: 1,
}

addNodes = function()
{
    // ------------------------------------------ Number Node ------------------------------------------ //
    function NumberSelect() 
    {
        this.addOutput("Number","value");
        this.properties = {
            value: 1.0
        }
        this.widget = this.addWidget(
            "number",
            "Number",
            this.properties.value,
            this.setValue.bind(this),
            {min: 0, max: 10}
        );
        this.widgets_up = true;
        this.color = "#7c2a31";
    }

    NumberSelect.title = "Number";
    NumberSelect.desc = "number selector";

    NumberSelect.prototype.setValue = function(v) 
    {
        this.properties.value = v;
        this.widget.value = v;
    };

    NumberSelect.prototype.onExecute = function() 
    {
        if (!isConnected(this, "Material Output"))
            return;

        this.setOutputData(0, this.properties.value);
    };

    LiteGraph.registerNodeType("Input/Number", NumberSelect);


    // ------------------------------------------ Color Node ------------------------------------------ //
    function ColorSelect() 
    {
        this.addOutput("Color", "color");
        this.properties = {
            color: [0.5,0.5,0.5,1.0],
        };
        this.color = "#7c2a31";
    }
    
    ColorSelect.title = "Color";
    ColorSelect.desc = "color selector";

    ColorSelect.prototype.onAddPropertyToPanel = function(i, panel) 
    {
        var elem = document.createElement("input");
        elem.class = "color";
        var that = this;
        elem.onchange = function() {that.setValue(color.rgb)};
        panel.content.appendChild(elem);

        var color = new jscolor.color(elem, {rgb: this.properties.color});
        this.properties.color = color.rgb;

        return true;
    };

    ColorSelect.prototype.setValue = function(v) 
    {
        v.push(1.0);
        this.properties.color = v;
    };

    ColorSelect.prototype.onDrawBackground = function(ctx) 
    {
        var c = JSON.parse("[" + this.properties.color + "]");
        ctx.fillStyle =
            "rgb(" +
            Math.floor(Math.clamp(c[0], 0, 1) * 255) +
            "," +
            Math.floor(Math.clamp(c[1], 0, 1) * 255) +
            "," +
            Math.floor(Math.clamp(c[2], 0, 1) * 255) +
            ")";
        if (this.flags.collapsed) {
            this.boxcolor = ctx.fillStyle;
        } else {
            ctx.fillRect(0, 0, this.size[0], this.size[1]);
        }
    };

    ColorSelect.prototype.onExecute = function() 
    {
        if (!isConnected(this, "Material Output"))
            return;

        var color = this.properties.color;

        this.setOutputData(0, color);
    };

    LiteGraph.registerNodeType("Input/Color", ColorSelect);


    // ------------------------------------------ Coord Node ------------------------------------------ //
    function CoordSelect() 
    {
        this.addOutput("Generated","vector");
        this.addOutput("Normal","vector");
        this.addOutput("UV","vector");
        this.addOutput("Object","vector");
        this.addOutput("Camera","vector");
        this.color = "#7c2a31";
    }

    CoordSelect.title = "Coordinates";
    CoordSelect.desc = "coordinate vectors selector";

    CoordSelect.prototype.onExecute = function() 
    {
        if (!isConnected(this, "Material Output"))
            return;

        this.setOutputData(0, "sample_pos"); // from -obj_size/2 to obj_size/2
        this.setOutputData(1, "v_normal"); // from -1 to 1
        this.setOutputData(2, "vec3(v_coord, 1.0)"); // from 0 to 1
        this.setOutputData(3, "v_pos"); // from -1 to 1 (because is in local)
        this.setOutputData(4, "u_camera_position"); // 
    };

    LiteGraph.registerNodeType("Input/CoordSelect", CoordSelect);


    // ------------------------------------------ TransferFunc Node ------------------------------------------ //
    function TransferFunc() {
        this.addOutput("Color", "color");
		this.properties = { split_channels: false };
		this._values = new Uint8Array(256*4);
		this._values.fill(255);
		this._curve_texture = null;
		this._must_update = true;
		this._points = {
			RGBA: [[0,0],[1,1]],
			R: [[0,0],[1,1]],
			G: [[0,0],[1,1]],
            B: [[0,0],[1,1]],
            A: [[0,0],[1,1]]
		};
		this.curve_editor = null;
		this.addWidget("toggle","Split Channels",false,"split_channels");
		this.addWidget("combo","Channel","RGBA",{ values:["RGBA","R","G","B","A"]});
		this.curve_offset = 68;
        this.size = [ 240, 170 ];
        this.color = "#7c2a31";
	}

    TransferFunc.title = "Transfer Function";
    TransferFunc.desc = "control the RGBA for each density value";

	TransferFunc.prototype.onExecute = function() {
        
		if (!isConnected(this, "Material Output"))
        return;

		//if(this._must_update || !this._curve_texture )
            this.updateCurve();
        this._must_update = false;

		var curve_texture = this._curve_texture;

        shader.setUniform("u_tf", curve_texture.bind(1)); 

        var color_tf = "texture(u_tf, vec2(clamp(v, 0.0, 1.0),0.5))";

        this.setOutputData(0, color_tf);
	};

	TransferFunc.prototype.sampleCurve = function(f,points)
	{
		var points = points || this._points.RGBA;
		if(!points)
			return;
		for(var i = 0; i < points.length - 1; ++i)
		{
			var p = points[i];
			var pn = points[i+1];
			if(pn[0] < f)
				continue;
			var r = (pn[0] - p[0]);
			if( Math.abs(r) < 0.00001 )
				return p[1];
			var local_f = (f - p[0]) / r;
			return p[1] * (1.0 - local_f) + pn[1] * local_f;
		}
		return 0;
	}

	TransferFunc.prototype.updateCurve = function()
	{
		var values = this._values;
		var num = values.length / 4;
		var split = this.properties.split_channels;
		for(var i = 0; i < num; ++i)
		{
			if(split)
			{
				values[i*4] = Math.clamp( this.sampleCurve(i/num,this._points.R)*255,0,255);
				values[i*4+1] = Math.clamp( this.sampleCurve(i/num,this._points.G)*255,0,255);
                values[i*4+2] = Math.clamp( this.sampleCurve(i/num,this._points.B)*255,0,255);
                values[i*4+3] = Math.clamp( this.sampleCurve(i/num,this._points.A)*255,0,255);
			}
			else
			{
				var v = this.sampleCurve(i/num);//sample curve
				values[i*4] = values[i*4+1] = values[i*4+2] = values[i*4+3] = Math.clamp(v*255,0,255);
			}
		}
		if(!this._curve_texture)
			this._curve_texture = new GL.Texture(256,1,{ format: gl.RGBA, magFilter: gl.LINEAR, wrap: gl.CLAMP_TO_EDGE });
		this._curve_texture.uploadData(values,null,true);
	}

	TransferFunc.prototype.onSerialize = function(o)
	{
		var curves = {};
		for(var i in this._points)
			curves[i] = this._points[i].concat();
		o.curves = curves;
	}

	TransferFunc.prototype.onConfigure = function(o)
	{
		this._points = o.curves;
		if(this.curve_editor)
			curve_editor.points = this._points;
		this._must_update = true;
	}

	TransferFunc.prototype.onMouseDown = function(e, localpos, graphcanvas)
	{
		if(this.curve_editor)
		{
            var r = this.curve_editor.onMouseDown([localpos[0],localpos[1]-this.curve_offset], graphcanvas);
			if(r)
				this.captureInput(true);
			return r;
        }
	}

	TransferFunc.prototype.onMouseMove = function(e, localpos, graphcanvas)
	{
		if(this.curve_editor)
            return this.curve_editor.onMouseMove([localpos[0],localpos[1]-this.curve_offset], graphcanvas);
	}

	TransferFunc.prototype.onMouseUp = function(e, localpos, graphcanvas)
	{
		if(this.curve_editor)
			return this.curve_editor.onMouseUp([localpos[0],localpos[1]-this.curve_offset], graphcanvas);
		this.captureInput(false);
	}

	TransferFunc.channel_line_colors = { "RGBA":"#666","R":"#F33","G":"#3F3","B":"#33F","A":"#FF0" };

	TransferFunc.prototype.onDrawBackground = function(ctx, graphcanvas)
	{
		if(this.flags.collapsed)
			return;

		if(!this.curve_editor)
			this.curve_editor = new LiteGraph.CurveEditor(this._points.R);
		ctx.save();
		ctx.translate(0,this.curve_offset);
		var channel = this.widgets[1].value;

		if(this.properties.split_channels)
		{
			if(channel == "RGBA")
			{
				this.widgets[1].value = channel = "R";
				this.widgets[1].disabled = false;
			}
			this.curve_editor.points = this._points.R;
			this.curve_editor.draw( ctx, [this.size[0],this.size[1] - this.curve_offset], graphcanvas, "#111", TransferFunc.channel_line_colors.R, true );
			ctx.globalCompositeOperation = "lighten";
			this.curve_editor.points = this._points.G;
			this.curve_editor.draw( ctx, [this.size[0],this.size[1] - this.curve_offset], graphcanvas, null, TransferFunc.channel_line_colors.G, true );
			this.curve_editor.points = this._points.B;
			this.curve_editor.draw( ctx, [this.size[0],this.size[1] - this.curve_offset], graphcanvas, null, TransferFunc.channel_line_colors.B, true );
            this.curve_editor.points = this._points.A;
			this.curve_editor.draw( ctx, [this.size[0],this.size[1] - this.curve_offset], graphcanvas, null, TransferFunc.channel_line_colors.A, true );
            ctx.globalCompositeOperation = "source-over";
		}
		else
		{
			this.widgets[1].value = channel = "RGBA";
			this.widgets[1].disabled = true;
		}

		this.curve_editor.points = this._points[channel];
		this.curve_editor.draw( ctx, [this.size[0],this.size[1] - this.curve_offset], graphcanvas, this.properties.split_channels ? null : "#111", TransferFunc.channel_line_colors[channel]  );
		ctx.restore();
	}

    TransferFunc.prototype.uniforms = `
uniform sampler2D u_tf;`;

	LiteGraph.registerNodeType("Input/Transfer Function", TransferFunc);


    // ------------------------------------------ Gradient Node ------------------------------------------ //
    function Gradient()
    {
        this.addInput("Vector", "vector");
        this.addOutput("Color", "color");
        this.addOutput("Fac", "value");

        this.properties = {
            type: "Linear"
        }
        this.widget = this.addWidget(
            "combo",
            "Type",
            this.properties.type,
            this.setValue.bind(this),
            {values: ["Linear", "Quadratic", "Diagonal", "Spherical"]}
        );
        this.color = "#a06236";
    }

    Gradient.title = "Gradient";
    Gradient.desc = "creates a gradient effect for a chosen vector";

    Gradient.prototype.setValue = function(v)
    {
        this.properties.type = v;
        this.widget.value = v;
    };

    Gradient.prototype.toString = function(input)
    {
        if (input == null) {
            return "null";
        } else if (input.constructor === Number) {
            return input.toFixed(1);
        } else if (input.constructor === Array) {
            var str = "";
            for (var i = 0; i < (input.length - 1); ++i) {
                if (input[i] % 1 != 0) //check if is decimal or not
                    str += input[i].toFixed(1) + ",";
                else
                    str += input[i] + ".0,";
            }
            str += input[i] + ".0";
            return str;
        } else {
            return String(input);
        }
    }

    Gradient.prototype.onExecute = function()
    {
        if (!isConnected(this, "Material Output"))
            return;

        var vector = this.getInputData(0);
        if (vector === undefined)
            vector = "sample_pos";

        if (this.properties.type == "Linear")
            var gradient_code = "clamp((" + vector + ".x + " + this.toString(entity._mesh.size/2.0) + ")/" + this.toString(entity._mesh.size) + ", 0.0, 1.0)";
        else if (this.properties.type == "Quadratic")
            var gradient_code = "clamp(max(" + vector + ".x, 0.0) * max(" + vector + ".x, 0.0), 0.0, 1.0)";
        else if (this.properties.type == "Diagonal")
            var gradient_code = "clamp((" + vector + ".x +" + vector + ".y) * 0.5, 0.0, 1.0)";
        else if (this.properties.type == "Spherical")
            var gradient_code = "clamp(max(1.0 - sqrt(" + vector + ".x * " + vector + ".x + " + vector + ".y * " + vector + ".y + " + vector + ".z * " + vector + ".z), 0.0), 0.0, 1.0)";

        var gradientRGB_code = "vec4(vec3(" + gradient_code + "), 1.0)";

        this.setOutputData(0, gradientRGB_code);
        this.setOutputData(1, gradient_code);
    }

    LiteGraph.registerNodeType("Texture/Gradient", Gradient);


    // ------------------------------------------ Noise Node ------------------------------------------ //
    function Noise()
    {
        this.addInput("Vector", "vector");
        this.addOutput("Color", "color");
        this.addOutput("Fac", "value");

        this.properties = {
            scale: 1.0,
            detail: 0.0,
        };
        this.widgetScale = this.addWidget(
            "number",
            "Scale",
            this.properties.scale,
            this.setScale.bind(this),
            {min: -100, max: 100}
        );
        this.widgetDetail = this.addWidget(
            "combo",
            "Detail",
            this.properties.detail,
            this.setDetail.bind(this),
            {values: [0.0, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0]}
        );
        this.toggle = this.addWidget("toggle","Movement", false, function(v){}, { on: "enabled", off:"disabled"} );
        this.color = "#a06236";
    }
    
    Noise.title = "Noise";
    Noise.desc = "gives a random value using Value Noise algorithm";

    Noise.prototype.setScale = function(v)
    {
        this.properties.scale = v;
        this.widgetScale.value = v;
    };

    Noise.prototype.setDetail = function(v)
    {
        this.properties.detail = v;
        this.widgetDetail.value = v;
    };

    Noise.prototype.onExecute = function()
    {
        if (!isConnected(this, "Material Output"))
            return;

        shader.setUniform("scale", this.properties.scale);
        shader.setUniform("detail", this.properties.detail);
        shader.setUniform("distortion", 0.0); // en mi pc si uso esto me va a 1 fps como mucho
        if (this.toggle.value) shader.setUniform("u_time", time.now/1000);
        else shader.setUniform("u_time", 0.0);

        var vector = this.getInputData(0);
        if(vector === undefined) 
            vector = "sample_pos";

        var noise_code = "cnoise(" + vector + ")";
        var noiseRGB_code = "vec4(vec3(" + noise_code + "), 1.0)";

        this.setOutputData(0, noiseRGB_code);
        this.setOutputData(1, noise_code);
    }

    Noise.prototype.uniforms = `
uniform float scale;
uniform float detail;
uniform float distortion;`;

    Noise.prototype.pixel_shader = `

// Noise functions
float hash1( float n )
{
    return fract( n*17.0*fract( n*0.3183099 ) );
}

float noise( vec3 x )
{
    vec3 p = floor(x);
    vec3 w = fract(x);
    
    vec3 u = w*w*w*(w*(w*6.0-15.0)+10.0);
    
    float n = p.x + 317.0*p.y + 157.0*p.z;
    
    float a = hash1(n+0.0);
    float b = hash1(n+1.0);
    float c = hash1(n+317.0);
    float d = hash1(n+318.0);
    float e = hash1(n+157.0);
    float f = hash1(n+158.0);
    float g = hash1(n+474.0);
    float h = hash1(n+475.0);

    float k0 =   a;
    float k1 =   b - a;
    float k2 =   c - a;
    float k3 =   e - a;
    float k4 =   a - b - c + d;
    float k5 =   a - c - e + g;
    float k6 =   a - b - e + f;
    float k7 = - a + b + c - d + e - f - g + h;

    return -1.0+2.0*(k0 + k1*u.x + k2*u.y + k3*u.z + k4*u.x*u.y + k5*u.y*u.z + k6*u.z*u.x + k7*u.x*u.y*u.z);
}

#define MAX_OCTAVES 16

float fractal_noise(vec3 P)
{
    float fscale = 1.0;
    float amp = 1.0;
    float sum = 0.0;
    float octaves = clamp(detail, 0.0, 16.0);
    int n = int(octaves);

    for (int i = 0; i <= MAX_OCTAVES; i++) {
        if (i > n) continue;
        float t = noise(fscale * P);
        sum += t * amp;
        amp *= 0.5;
        fscale *= 2.0;
    }

    return sum;
}

float cnoise( vec3 P )
{
    P *= scale;

    if (u_time != 0.0) //controlled with a flag
        P += u_time;

    return fractal_noise(P);
}`;

    LiteGraph.registerNodeType("Texture/Noise", Noise);


    // ------------------------------------------ Dicom Node ------------------------------------------ //
    function Dicom()
    {
        this.addOutput("Density", "value");

        this.properties = {
            _volume: null,
            _texture: null,
            state: "Empty"
        };
    }

    Dicom.title = "Dicom";
    Dicom.desc = "allows the user to load a dicom file";

    Dicom.prototype.onAddPropertyToPanel = function(i, panel) 
    {
        var that = this;

        switch (i) {
            case "_volume":
                var elem_input = document.createElement("input");
                elem_input.id = "dicomInput" + this.id;
                elem_input.style.display = "none";
                elem_input.type = "file";
                elem_input.multiple = true;
                elem_input.webkitdirectory = true;
                elem_input.addEventListener("change", function(event){
                    that.handleInput(event.target.files);
                }, false);
                panel.content.appendChild(elem_input);

                var elem_button = document.createElement("button");
                elem_button.class = "button";
                elem_button.innerText = "Select Folder";
                elem_button.addEventListener("click", function(){
                    document.getElementById(elem_input.id).click();
                }, false);
                panel.content.appendChild(elem_button);
                break;

            case "state":
                var elem = document.createElement("span");
                elem.id = "state";
                elem.class = "text";
                elem.innerText = this.properties.state;
                elem.style.paddingLeft = "10px";
                panel.content.appendChild(elem);
                break;
        }

        return true;
    };

    Dicom.prototype.handleInput = function(files)
    {
        if(files.length == 0) return;
    
        VolumeLoader.loadDicomFiles(files, this.onVolume.bind(this), this.onVolume.bind(this));
    };

    Dicom.prototype.onVolume = function(response)
    {
        this.properties.state = "Loading...";
        var elem = document.getElementById("state");
        elem.innerText = this.properties.state;

        if(response.status == VolumeLoader.DONE){
            console.log("Volume loaded.");
            this.properties._volume = response.volume;
            this.color = "#a06236"; //use color to remark the usefull output node
            
            this.properties.state = "Loaded!";
            var elem = document.getElementById("state");
            elem.innerText = this.properties.state;

            this.properties._volume.computeMinMax();
            switch(this.properties._volume.voxelType){
                case "UI":
                    macros.TEXTURE_TYPE = 2;
                    break;
                case "I":
                    macros.TEXTURE_TYPE = 1;
                    break;
                case "F":
                    macros.TEXTURE_TYPE = 0;
                    break;
            }

            this.properties._texture = response.volume.createTexture();
        }
        else if(response.status == VolumeLoader.ERROR){
            console.log("Error: ", response.explanation);
        }else if(response.status == VolumeLoader.STARTING){
            console.log("Starting...");
        }else if(response.status == VolumeLoader.LOADINGFILES){
            console.log("Loading Files...");
        }else if(response.status == VolumeLoader.PARSINGFILES){
            console.log("Parsing Volumes...");
        }else if(response.status == VolumeLoader.CREATINGVOLUMES){
            console.log("Creating Volumes...");
        }
    };

    Dicom.prototype.onExecute = function()
    {
        if (!isConnected(this, "Material Output"))
            return;

        if (this.properties._volume === null)
            return;

        entity._model_matrix[0] = this.properties._volume.width*this.properties._volume.widthSpacing;
        entity._model_matrix[5] = this.properties._volume.height*this.properties._volume.heightSpacing;
        entity._model_matrix[10] = this.properties._volume.depth*this.properties._volume.depthSpacing;

        var aux = Math.max(entity._model_matrix[0], entity._model_matrix[5], entity._model_matrix[10]);

        entity._model_matrix[0] /= aux;
        entity._model_matrix[5] /= aux;
        entity._model_matrix[10] /= aux;

        var dicom_code = "getVoxel((sample_pos + vec3(1.0))/2.0).x";

        shader.setUniform("u_volume_texture", this.properties._texture.bind(0));
        shader.setUniform("u_resolution", [this.properties._texture.width, this.properties._texture.height, this.properties._texture.depth]);
        shader.setUniform("u_min_value", this.properties._volume._min);
        shader.setUniform("u_max_value", this.properties._volume._max);

        this.setOutputData(0, dicom_code);
    }

    Dicom.prototype.uniforms = `
uniform vec3 u_resolution;
uniform float u_min_value;
uniform float u_max_value;
    
#if TEXTURE_TYPE == 0
uniform sampler3D u_volume_texture;
#elif TEXTURE_TYPE == 1
uniform isampler3D u_volume_texture;
#else
uniform usampler3D u_volume_texture;
#endif
`;

    Dicom.prototype.pixel_shader = `

// Dicom function
vec4 getVoxel(vec3 p)
{
    p = p*u_resolution + 0.5;
    
    // Better voxel interpolation from iquilezles.org/www/articles/texture/texture.htm
    vec3 i = floor(p);
    vec3 f = p - i;
    f = f*f*f*(f*(f*6.0-15.0)+10.0);
    p = i + f;
    
    p = (p - 0.5)/u_resolution;
    vec4 v = vec4(texture( u_volume_texture, p ));

    #if NORMALIZE_VOXEL_VALUE == 1
    v = (v - vec4(u_min_value)) / (u_max_value - u_min_value);
    #endif
    
    return v;
}`;

    LiteGraph.registerNodeType("Texture/Dicom", Dicom);


    // ------------------------------------------ Math Node ------------------------------------------ //
    function MathOperation() 
    {
        this.addInput("A", "value");
        this.addInput("B", "value");
        this.addOutput("=", "value");
        this.addProperty("A", 1);
        this.addProperty("B", 1);
        this.addProperty("OP", "+", "enum", { values: MathOperation.values });
        this.color = "#4987af";
    }

    MathOperation.values = ["+", "-", "*", "/", "%", "^", "max", "min"];

    MathOperation.title = "Math";
    MathOperation.desc = "easy math operators";
    MathOperation["@OP"] = {
        type: "enum",
        title: "operation",
        values: MathOperation.values
    };
    MathOperation.size = [100, 60];

    MathOperation.prototype.getTitle = function() 
    {
        if(this.properties.OP == "max" || this.properties.OP == "min")
            return this.properties.OP + "(A,B)";
        return "A " + this.properties.OP + " B";
    };

    MathOperation.prototype.setValue = function(v) 
    {
        if (typeof v == "string") {
            v = parseFloat(v);
        }
        this.properties["value"] = v;
    };

    MathOperation.prototype.toString = function(input)
    {
        if (input == null) {
            return "null";
        } else if (input.constructor === Number) {
            return input.toFixed(1);
        } else if (input.constructor === Array) {
            var str = "";
            for (var i = 0; i < (input.length - 1); ++i) {
                if (input[i] % 1 != 0) //check if is decimal or not
                    str += input[i].toFixed(1) + ",";
                else
                    str += input[i] + ".0,";
            }
            str += input[i] + ".0";
            return str;
        } else {
            return String(input);
        }
    }

    MathOperation.prototype.onExecute = function() 
    {
        if (!isConnected(this, "Material Output"))
            return;

        var A = this.getInputData(0);
        if (A == null)
            A = this.properties["A"];
        A = this.toString(A);

        var B = this.getInputData(1);
        if (B == null) 
            B = this.toString(this.properties["B"]);
        B = this.toString(B);

        var result = "";
        switch (this.properties.OP) {
            case "+":
                result = A + " + " +  B;
                break;
            case "-":
                result = A + " - " + B;
                break;
            case "*":
                result = A + " * " + B;
                break;
            case "/":
                result = A + " / " + B;
                break;
            case "%":
                result = A % B;
                break;
            case "^":
                result = "pow(" + A + "," + B + ")";
                break;
            case "max":
                result = "max(" + A + "," + B + ")";
                break;
            case "min":
                result = "min(" + A + "," + B + ")";
                break;
            default:
                console.warn("Unknown operation: " + this.properties.OP);
        }
        this.setOutputData(0, result);
    };

    MathOperation.prototype.onDrawBackground = function(ctx) 
    {
        if (this.flags.collapsed) {
            return;
        }

        ctx.font = "40px Arial";
        ctx.fillStyle = "#666";
        ctx.textAlign = "center";
        ctx.fillText(
            this.properties.OP,
            this.size[0] * 0.5,
            (this.size[1] + LiteGraph.NODE_TITLE_HEIGHT) * 0.5
        );
        ctx.textAlign = "left";
    };

    LiteGraph.registerNodeType("Operator/Math", MathOperation);


    // ------------------------------------------ MixRGB Node ------------------------------------------ //
    function MixColor()
    {
        this.addInput("Factor", "value");
        this.properties = {
            value: 0.5
        }
        this.widget = this.addWidget(
            "number",
            "Factor",
            this.properties.value,
            this.setValue.bind(this),
            {min: 0.0, max: 1.0}
        );

        this.addInput("Color", "color");
        this.addInput("Color", "color");
        this.addOutput("Color", "color");
        this.addOutput("Fac", "value");
        this.color = "#4987af";
    }

    MixColor.title = "MixRGB";
    MixColor.desc = "interpolates input colors usign a factor";

    MixColor.prototype.setValue = function(v) 
    {
        this.properties.value = v;
        this.widget.value = v;
    };

    MixColor.prototype.toString = function(input)
    {
        if (input == null) {
            return "null";
        } else if (input.constructor === Number) {
            return input.toFixed(1);
        } else if (input.constructor === Array) {
            var str = "";
            for (var i = 0; i < (input.length - 1); ++i) {
                if (input[i] % 1 != 0) //check if is decimal or not
                    str += input[i].toFixed(1) + ",";
                else
                    str += input[i] + ".0,";
            }
            str += input[i] + ".0";
            return str;
        } else {
            return String(input);
        }
    }

    MixColor.prototype.onExecute = function()
    {
        if (!isConnected(this, "Material Output"))
            return;

        var fac = this.getInputData(0);
        if (fac === undefined) {
            this.widget.disabled = false;
            fac = this.widget.value;
        } else {
            this.widget.disabled = true;
            fac = Math.min(Math.max(0.0, fac), 1.0);
        }
        fac = this.toString(fac);

        var color1 = this.getInputData(1);
        if (color1 === undefined)
            color1 = "1.0, 1.0, 1.0, 1.0";
        else 
            if (color1.constructor === Array)
                color1 = this.toString(color1);
        
        var color2 = this.getInputData(2);
        if (color2 === undefined)
            color2 = "1.0, 1.0, 1.0, 1.0";
        else 
            if (color2.constructor === Array)
                color2 = this.toString(color2);

        var mixRGB_result = "mix(vec4(" + color1 + "), vec4(" + color2 + "), " + fac + ")";
        var mix_result = mixRGB_result + ".x";

        this.setOutputData(0, mixRGB_result);
        this.setOutputData(1, mix_result);
    }

    LiteGraph.registerNodeType("Operator/MixRGB", MixColor);

    
    // ------------------------------------------ ColorRamp Node ------------------------------------------ //
    function ColorRamp()
    {
        this.addInput("Value", "value");
        this.addOutput("Color", "color");
        this.addOutput("Fac", "value");

        this.properties = {
            min_value: 0.5,
            max_value: 0.5
        }
        this.widgetMin = this.addWidget(
            "number",
            "Min_Value",
            this.properties.min_value,
            this.setMinValue.bind(this),
            {min: 0.0, max: 0.5}
        );
        this.widgetMax = this.addWidget(
            "number",
            "Max_value",
            this.properties.max_value,
            this.setMaxValue.bind(this),
            {min: 0.5, max: 1.0}
        );
        this.color = "#4987af";
    }

    ColorRamp.title = "ColorRamp";
    ColorRamp.desc = "discriminates values between limits";

    ColorRamp.prototype.setMinValue = function(v) 
    {
        this.properties.min_value = v;
        this.widgetMin.value = v;
    };

    ColorRamp.prototype.setMaxValue = function(v) 
    {
        this.properties.max_value = v;
        this.widgetMax.value = v;
    };

    ColorRamp.prototype.toString = function(input)
    {
        if (input == null) {
            return "null";
        } else if (input.constructor === Number) {
            return input.toFixed(1);
        } else if (input.constructor === Array) {
            var str = "";
            for (var i = 0; i < (input.length - 1); ++i) {
                if (input[i] % 1 != 0) //check if is decimal or not
                    str += input[i].toFixed(1) + ",";
                else
                    str += input[i] + ".0,";
            }
            str += input[i] + ".0";
            return str;
        } else {
            return String(input);
        }
    }

    ColorRamp.prototype.onExecute = function()
    {
        if (!isConnected(this, "Material Output"))
            return;

        var input = this.getInputData(0);
        if(input === undefined)
            input = "0.0";

        var rampRGB_code = "colorRamp("+ input + "," + this.toString(this.properties.min_value) + "," + this.toString(this.properties.max_value) + ")";
        var ramp_code = rampRGB_code + ".x";

        this.setOutputData(0, rampRGB_code);
        this.setOutputData(1, ramp_code);
    }

    ColorRamp.prototype.pixel_shader = `

// ColorRamp function    
vec4 colorRamp(float fac, float clamp_min, float clamp_max){
    float value;
    if ( fac < 0.5 ){
        value = clamp(fac, 0.0, clamp_min);
    }
    else{
        value =  clamp(fac, clamp_max, 1.0);
    }
    return vec4(vec3(value), 1.0);
}`;

    LiteGraph.registerNodeType("Operator/ColorRamp", ColorRamp);


    // ------------------------------------------ Translate Node ------------------------------------------ //
    function Translate()
    {
        this.addInput("Vector", "vector");
        this.addOutput("Vector", "vector");

        this.properties = {
            _X: 0.0,
            _Y: 0.0,
            _Z: 0.0
        };
        this.widgetX = this.addWidget(
            "number",
            "X",
            this.properties._X,
            this.setX.bind(this),
            {min: -100, max: 100}
        );
        this.widgetY = this.addWidget(
            "number",
            "Y",
            this.properties._Y,
            this.setY.bind(this),
            {min: -100, max: 100}
        );
        this.widgetZ = this.addWidget(
            "number",
            "Z",
            this.properties._Z,
            this.setZ.bind(this),
            {min: -100, max: 100}
        );
        this.color = "#4987af";
    }

    Translate.title = "Translate";
    Translate.desc = "basic operations for vectors";

    Translate.prototype.setX = function(v) 
    {
        this.properties._X = v;
        this.widgetX.value = v;
    };

    Translate.prototype.setY = function(v) 
    {
        this.properties._Y = v;
        this.widgetY.value = v;
    };

    Translate.prototype.setZ = function(v) 
    {
        this.properties._Z = v;
        this.widgetZ.value = v;
    };

    Translate.prototype.toString = function(input)
    {
        if (input == null) {
            return "null";
        } else if (input.constructor === Number) {
            return input.toFixed(1);
        } else if (input.constructor === Array) {
            var str = "";
            for (var i = 0; i < (input.length - 1); ++i) {
                if (input[i] % 1 != 0) //check if is decimal or not
                    str += input[i].toFixed(1) + ",";
                else
                    str += input[i] + ".0,";
            }
            str += input[i] + ".0";
            return str;
        } else {
            return String(input);
        }
    }

    Translate.prototype.onExecute = function()
    {
        if (!isConnected(this, "Material Output"))
            return;

        var vector = this.getInputData(0);
        if(vector === undefined)
            vector = "sample_pos";

        var x = this.toString(this.properties._X);
        var y = this.toString(this.properties._Y);
        var z = this.toString(this.properties._Z);

        var translation_code = "setTranslation(" + vector + "," + x + "," + y + "," + z + ")";

        this.setOutputData(0, translation_code);
    }

    Translate.prototype.pixel_shader = `

// Translate function
vec3 setTranslation(vec3 vector, float x, float y, float z){
    return vector + vec3(x, y, z);
}`;

    LiteGraph.registerNodeType("Operator/Translate", Translate);


    // ------------------------------------------ Scale Node ------------------------------------------ //
    function Scale()
    {
        this.addInput("Vector", "vector");
        this.addOutput("Vector", "vector");

        this.properties = {
            _X: 1.0,
            _Y: 1.0,
            _Z: 1.0
        };
        this.widgetX = this.addWidget(
            "number",
            "X",
            this.properties._X,
            this.setX.bind(this),
            {min: 0, max: 100}
        );
        this.widgetY = this.addWidget(
            "number",
            "Y",
            this.properties._Y,
            this.setY.bind(this),
            {min: 0, max: 100}
        );
        this.widgetZ = this.addWidget(
            "number",
            "Z",
            this.properties._Z,
            this.setZ.bind(this),
            {min: 0, max: 100}
        );
        this.color = "#4987af";
    }

    Scale.title = "Scale";
    Scale.desc = "basic operations for vectors";

    Scale.prototype.setX = function(v) 
    {
        this.properties._X = v;
        this.widgetX.value = v;
    };

    Scale.prototype.setY = function(v) 
    {
        this.properties._Y = v;
        this.widgetY.value = v;
    };

    Scale.prototype.setZ = function(v) 
    {
        this.properties._Z = v;
        this.widgetZ.value = v;
    };

    Scale.prototype.toString = function(input)
    {
        if (input == null) {
            return "null";
        } else if (input.constructor === Number) {
            return input.toFixed(1);
        } else if (input.constructor === Array) {
            var str = "";
            for (var i = 0; i < (input.length - 1); ++i) {
                if (input[i] % 1 != 0) //check if is decimal or not
                    str += input[i].toFixed(1) + ",";
                else
                    str += input[i] + ".0,";
            }
            str += input[i] + ".0";
            return str;
        } else {
            return String(input);
        }
    }

    Scale.prototype.onExecute = function()
    {
        if (!isConnected(this, "Material Output"))
            return;

        var vector = this.getInputData(0);
        if(vector === undefined)
            vector = "sample_pos";

        var x = this.toString(this.properties._X);
        var y = this.toString(this.properties._Y);
        var z = this.toString(this.properties._Z);

        var  scale_code = "setScale(" + vector + "," + x + "," + y + "," + z + ")";

        this.setOutputData(0, scale_code);
    }

    Scale.prototype.pixel_shader = `

// Scale function
vec3 setScale(vec3 vector, float x, float y, float z){
    return vector * vec3(x, y, z);
}`;

    LiteGraph.registerNodeType("Operator/Scale", Scale);


    // ------------------------------------------ Rotate Node ------------------------------------------ //
    function Rotate()
    {
        this.addInput("Vector", "vector");
        this.addOutput("Vector", "vector");

        this.properties = {
            _X: 0.0,
            _Y: 0.0,
            _Z: 0.0
        };
        this.widgetX = this.addWidget(
            "number",
            "X",
            this.properties._X,
            this.setX.bind(this),
            {min: -360, max: 360}
        );
        this.widgetY = this.addWidget(
            "number",
            "Y",
            this.properties._Y,
            this.setY.bind(this),
            {min: -360, max: 360}
        );
        this.widgetZ = this.addWidget(
            "number",
            "Z",
            this.properties._Z,
            this.setZ.bind(this),
            {min: -360, max: 360}
        );
        this.color = "#4987af";
    }

    Rotate.title = "Rotate";
    Rotate.desc = "basic operations for vectors (degrees)";

    Rotate.prototype.setX = function(v) 
    {
        this.properties._X = v;
        this.widgetX.value = v;
    };

    Rotate.prototype.setY = function(v) 
    {
        this.properties._Y = v;
        this.widgetY.value = v;
    };

    Rotate.prototype.setZ = function(v) 
    {
        this.properties._Z = v;
        this.widgetZ.value = v;
    };

    Rotate.prototype.toString = function(input)
    {
        if (input == null) {
            return "null";
        } else if (input.constructor === Number) {
            return input.toFixed(1);
        } else if (input.constructor === Array) {
            var str = "";
            for (var i = 0; i < (input.length - 1); ++i) {
                if (input[i] % 1 != 0) //check if is decimal or not
                    str += input[i].toFixed(1) + ",";
                else
                    str += input[i] + ".0,";
            }
            str += input[i] + ".0";
            return str;
        } else {
            return String(input);
        }
    }

    Rotate.prototype.onExecute = function()
    {
        if (!isConnected(this, "Material Output"))
            return;

        var vector = this.getInputData(0);
        if(vector === undefined)
            vector = "sample_pos";

        var x = this.toString(this.properties._X);
        var y = this.toString(this.properties._Y);
        var z = this.toString(this.properties._Z);

        var  rotate_code = "setRotation(" + vector + "," + x + "," + y + "," + z + ")";

        this.setOutputData(0, rotate_code);
    }

    Rotate.prototype.pixel_shader = `

// Rotate functions
#define M_PI 3.1415926535897932384626433832795        

vec3 setRotation(vec3 vector, float x, float y, float z){
    vec3 rad = vec3(x, y, z) * (M_PI / 180.0);

    //around X
    vec3 result1;
    result1.x = vector.x;
    result1.y = vector.y * cos(rad.x) - vector.z * sin(rad.x);
    result1.z = vector.y * sin(rad.x) + vector.z * cos(rad.x);
    //around Y
    vec3 result2;
    result2.x = result1.x * cos(rad.y) + result1.z * sin(rad.y);
    result2.y = result1.y;
    result2.z = result1.z * cos(rad.y) - result1.x * sin(rad.y);
    //around Z
    vec3 result3;
    result3.x = result2.x * cos(rad.z) - result2.y * sin(rad.z);
    result3.y = result2.x * sin(rad.z) + result2.y * cos(rad.z);
    result3.z = result2.z;
    
    return result3;
}`;

    LiteGraph.registerNodeType("Operator/Rotate", Rotate);


    // ------------------------------------------ Volume Node ------------------------------------------ //
    function Volume()
    {
        this.addInput("Color", "color");
        this.addInput("Density", "value");
        this.addOutput("Volume", "Fragcolor");
        
        this.properties = {
            density: 1.0,
        }
        this.widget = this.addWidget(
            "number",
            "Density",
            this.properties.density,
            this.setValue.bind(this),
            {min: 0, max: 10}
        )
        this.modifiers = {
            _density: null,
            _color: null,
            _jitter: null
        }
        this.color = "#2c8a5d";
    }

    Volume.title = "Volume";
    Volume.desc = "volume render algorithm";

    Volume.prototype.setValue = function(v) 
    {
        this.properties.density = v;
        this.widget.value = v;
    };

    Volume.prototype.toString = function(input)
    {
        if (input == null) {
            return "null";
        } else if (input.constructor === Number) {
            return input.toFixed(1);
        } else if (input.constructor === Array) {
            var str = "";
            for (var i = 0; i < (input.length - 1); ++i) {
                if (input[i] % 1 != 0) //check if is decimal or not
                    str += input[i].toFixed(1) + ",";
                else
                    str += input[i] + ".0,";
            }
            str += input[i] + ".0";
            return str;
        } else {
            return String(input);
        }
    }

    Volume.prototype.onExecute = function()
    {
        if (!isConnected(this, "Material Output"))
            return;

        var color = this.getInputData(0);
        if(color === undefined)
            color = `0.5,0.5,0.5,1.0`;
        else color = this.toString(color);
  
        var density = this.getInputData(1);
        if(density === undefined) {
            this.widget.disabled = false;
            density = this.toString(this.widget.value);
        }
        else {
            this.widget.disabled = true; 
            density = this.toString(density);
        }

        this.modifiers._density = density;
        this.modifiers._color = color;
        this.modifiers._jitter = wasConnected(this, "Dicom");

        var volume_code = this.completeShader(this.modifiers);

        this.setOutputData(0, volume_code);
    }  

    Volume.prototype.completeShader = function(modifiers)
    {
        var volume_code = `
    vec3 ray_origin = v_pos;
    vec3 ray_direction = normalize(ray_origin - u_local_camera_position);
    vec3 sample_pos = ray_origin;
    vec3 ray_step = ray_direction / u_quality;
    float d = length(ray_step);
    vec4 sample_color;
    `;

        if (modifiers._jitter) volume_code += `
    sample_pos = sample_pos - (ray_step * random());
    `;
    
    volume_code += `
    for(int i=0; i<100000; i++)
    {
        float v = ` +  modifiers._density + `;
        sample_color = vec4(` +  modifiers._color + `);
        sample_color = vec4(sample_color.xyz, v * sample_color.w);

        //transparency, applied this way to avoid color bleeding
        sample_color.xyz = sample_color.xyz * sample_color.w; 
               
        final_color = d * sample_color * (1.0 - final_color.w) + final_color; //compositing with previous value
        if (final_color.w >= 1.0) break;
        
        sample_pos = sample_pos + ray_step;

        vec3 abss = abs(sample_pos);
        if (i > 1 && (abss.x > u_obj_size || abss.y > u_obj_size || abss.z > u_obj_size)) break;
    }

    `;

        return volume_code;
    }
  
    Volume.prototype.uniforms = `
uniform float u_jitter_factor;`;

    Volume.prototype.pixel_shader = `

float random(){
    return fract(sin(dot(v_pos.xy, vec2(12.9898,78.233))) * 43758.5453123);
}
`;

    LiteGraph.registerNodeType("Shader/Volume", Volume);


    // ------------------------------------------ Output Node ------------------------------------------ //
    function MatOutput()
    {
        this.addInput("Frag Color", "Fragcolor");

        this.nodes_info;
    }

    MatOutput.title = "Material Output";
    MatOutput.desc = "material output, assmebles the final shader";

    MatOutput.prototype.onExecute = function()
    {
        // Chech that is not repeated
        for (var i = 1; i < this.id; i++)
        {
            if (this.graph._nodes_by_id[i] === undefined)
                continue;
            if (this.graph._nodes_by_id[i].title == "Material Output")
                return;
        }
        this.color = "#83109C"; //use color to remark the usefull output node   
        this.strokeStyle = "black";

        // Check if it has inputs linked
        if (this.inputs[0].link == null)
        {
            if (shader_atlas.length != 0)
            {
                gl.disable(gl.BLEND);
                var Node_VS_code = shader_atlas["basicVS"];
                var Node_FS_code = shader_atlas["basicFS"];

                if (Previous_VS !== Node_VS_code || Previous_FS !== Node_FS_code)
                {
                    //Load the new shader
                    shader = new Shader( Node_VS_code, Node_FS_code );
                    Previous_VS = Node_VS_code;
                    Previous_FS = Node_FS_code;
                }
            }
            return;
        }

        //set flags for volumetric render
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

	    // Fill the string of uniforms and methods from the nodes in use
        this.nodes_info = this.generateNodesCode();
        if (!this.nodes_info.list.includes("Dicom"))
            entity._model_matrix[0] = 1.0; entity._model_matrix[5] = 1.0; entity._model_matrix[10] = 1.0;

        var volume = this.getInputData(0);
        if(volume === undefined)
            volume = "";

        if (shader_atlas.length != 0)
        {
            //Create the final shader from the templates and the nodes
            var Node_VS_code = shader_atlas["volumeVS"];                                                    //VS
            var Node_FS_code = shader_atlas["FSUniforms"] + this.nodes_info.nodes_uniforms + 
            this.nodes_info.nodes_code + "\n" + shader_atlas["FSMain"] + volume + shader_atlas["FSReturn"]; //FS

            if (Previous_VS !== Node_VS_code || Previous_FS !== Node_FS_code)
            {
                //Load the new shader
                shader = new Shader( Node_VS_code, Node_FS_code, macros );
                Previous_VS = Node_VS_code;
                Previous_FS = Node_FS_code;
            }
        }
    }

    MatOutput.prototype.generateNodesCode = function()
    {
        var nodes_info = {
            list: null,
            nodes_uniforms: "",
            nodes_code: ""
        };
        nodes_info.list = checkConnections(this);
        for (var i = (nodes_info.list.length - 1); i >= 0; i--)
        {
            var node = this.graph.findNodeByTitle(nodes_info.list[i]);
            if (node.uniforms) nodes_info.nodes_uniforms += node.uniforms;
            if (node.pixel_shader) nodes_info.nodes_code += node.pixel_shader;
        }
        return nodes_info; 
    }

    LiteGraph.registerNodeType("Output/Material Output", MatOutput);
}


/*************************************************
 * Functions to Control the links in the graph *
*************************************************/

// Says if a node is linked with another (distant check) forward
function isConnected(node, destination_node)
{
    var curr_node;
    for (var i = 0; i < node.outputs.length; i++)
    {
        curr_node = node.getOutputNodes(i);
        if (curr_node == null)
            continue;
        curr_node = curr_node[0];
        if (curr_node.title == destination_node)
            return true;
        if (curr_node.outputs == undefined)
            continue;
        if (isConnected(curr_node, destination_node))
            return true;
    }
    return false;
}

// Says if a node has been linked with another (distant check) bakcward
function wasConnected(node, destination_node)
{
    var curr_node;
    for (var i = 0; i < node.inputs.length; i++)
    {
        curr_node = node.getInputNode(i);
        if (curr_node == null)
            continue;
        if (curr_node.title == destination_node)
            return true;
        if (curr_node.inputs == undefined)
            continue;
        if (wasConnected(curr_node, destination_node))
            return true;
    }
    return false;
}

// Returns the list of the nodes connected (titles)
function checkConnections(node, list, dir) // dir: 1 = both, 2 = inputs, 3 = outputs
{
	var _list = list || []; //continue or init the list
	var direction = dir || 1; //specify the direction

	var curr_node;
	if (direction != 3 && node.inputs != undefined) // it will not enter if we are only checking the outputs
		for (var i = 0; i < node.inputs.length; i++)
		{
			curr_node = node.getInputNode(i);
			if (curr_node == null)
				continue;
			if (_list.includes(curr_node.title))
				continue;
			_list.push(curr_node.title);
			if (curr_node.inputs == undefined)
				continue;
			checkConnections(curr_node, _list, 2);
		}

	if (direction != 2 && node.outputs != undefined) // it will not enter if we are only checking the inputs
		for (var i = 0; i < node.outputs.length; i++)
		{
			curr_node = node.getOutputNodes(i);
			if (curr_node == null)
				continue;
			if (_list.includes(curr_node.title))
				continue;
			_list.push(curr_node.title);
			if (curr_node.outputs == undefined)
				continue;
			checkConnections(curr_node, _list, 3);
		}

	return _list;
}