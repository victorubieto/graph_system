var Previous_VS = null;
var Previous_FS = null;

addNewNodes = function()
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
        if (!isConnected(this, "Output"))
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
        if (!isConnected(this, "Output"))
            return;

        var color = this.properties.color;

        this.setOutputData(0, color);
    };

    LiteGraph.registerNodeType("Input/Color", ColorSelect);


    // ------------------------------------------ TexCoord Node ------------------------------------------ //
    function TexCoord() 
    {
        this.addOutput("Generated","vector");
        this.addOutput("Normal","vector");
        this.addOutput("UV","vector");
        this.addOutput("Object","vector");
        this.addOutput("Camera","vector");
    }

    TexCoord.title = "TexCoord";
    TexCoord.desc = "coordinate vectors selector";

    TexCoord.prototype.onExecute = function() 
    {
        if (!isConnected(this, "Output"))
            return;

        this.setOutputData(0, "sample_pos"); // de -1 a 1
        this.setOutputData(1, "v_normal"); // de -1 a 1
        this.setOutputData(2, "vec3(v_uv, 1.0)"); // de 0 a 1
        this.setOutputData(3, "v_pos"); // de -1 a 1
        this.setOutputData(4, "u_camera_position"); // uniform del shader
    };

    LiteGraph.registerNodeType("Input/TexCoord", TexCoord);


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
    }

    Gradient.title = "Gradient";
    Gradient.desc = "creates a gradient effect for a chosen vector";

    Gradient.prototype.setValue = function(v)
    {
        this.properties.type = v;
        this.widget.value = v;
    };

    Gradient.prototype.onExecute = function()
    {
        if (!isConnected(this, "Output"))
            return;

        var vector = this.getInputData(0);
        if (vector === undefined)
            vector = "sample_pos";

        if (this.properties.type == "Linear")
            var gradient_code = "clamp(" + vector + ".x, 0.0, 1.0)";
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
    }
    
    Noise.title = "Noise";
    Noise.desc = "gives a random value using perlin noise algorithm";

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
        if (!isConnected(this, "Output"))
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

        // noise en 2D
        //return vec4(fract(sin(dot(local_pos.xy, vec2(12.9898,78.233)))* 43758.5453123));

        this.setOutputData(0, noiseRGB_code);
        this.setOutputData(1, noise_code);
    }

    LiteGraph.registerNodeType("Texture/Noise", Noise);


    // ------------------------------------------ Dicom Node ------------------------------------------ //
    function Dicom()
    {
        this.addInput("Vector", "vector");
        this.addOutput("Color", "color");
        this.addOutput("Alpha", "value");

        this.properties = {
            volume: null,
        };
    }

    Dicom.title = "Dicom";
    Dicom.desc = "allows the user to load a dicom file";

    Dicom.prototype.onAddPropertyToPanel = function(i, panel) 
    {
        var that = this;

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

        return true;
    };

    Dicom.prototype.handleInput = function(files)
    {
        if(files.length == 0) return;
    
        VolumeLoader.loadDicomFiles(files, this.onVolume.bind(this), this.onVolume.bind(this));
    };

    Dicom.prototype.onVolume = function(response)
    {
        if(response.status == VolumeLoader.DONE){
            console.log("Volume loaded.");
            this.properties.volume = response.volume;

            var panel = document.querySelector("#node-panel");
            var elem = document.createElement("span");
            elem.class = "text";
            elem.innerText = "Loaded!";
            elem.style.paddingLeft = "10px";
            panel.content.appendChild(elem);
            
            // CREAR EL VOLUM COMPATIBLE EN WEBGL 1 (unsigned, ordre, ...) a partir del response.volume

            // UPDATES (creare textures, etc...), canviar la funcio createTexture de VOLUME per que utilitzi texturas 2D
            var texture = this.createTexture(); // create texture 2d
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

    Dicom.prototype.createTexture = function(options){
        options = options || {};
        var volume = this.properties.volume;
    
        var width = parseInt(volume.width);
        var height = parseInt(volume.height);
        var depth = parseInt(volume.depth);
        var channels = parseInt(volume.voxelChannels);
        var data = volume._data;
    
        //Check dimensions and data
        if(width < 1 || height < 1 || depth < 1){
            console.warn("Volume dimensions must be positive");
            return null;
        }
    
        if(data == null){
            console.warn("Creating texture without data");
        }else if(data.length != width*height*depth*channels){
            console.warn("Volume size does not match with data size");
            return null;
        }
    
        //Cannot be overrided from outside volume info
        options.depth = depth;
        options.pixel_data = data;
        options.texture_type = gl.TEXTURE_2D;
        
        //Check https://www.khronos.org/registry/webgl/specs/latest/2.0/#3.7.6 texImage2D to see possible combinations for format, type and internalFormat
        //For example for pre-computed gradients {format: gl.RGB, type: gl.UNSIGNED_BYTE, internalFormat: gl.RGB8}
        var guessParams = this.guessTextureParams();
    
        options.format = options.format || guessParams.format;
        options.type = options.type || guessParams.type;
        options.internalFormat = options.internalFormat || guessParams.internalFormat;
        options.minFilter = options.minFilter || gl.NEAREST;
        options.magFilter = options.magFilter || gl.NEAREST;
        options.wrap = options.wrap || gl.CLAMP_TO_EDGE;
    
        var max_tex_dim = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        if (width * depth > max_tex_dim)
        {
            var width_images = Math.floor(max_tex_dim / width);
            var tex_width = width_images * width; //final width size of the 2d texture
            var heigth_images = Math.ceil(depth / width_images)
            var tex_height = heigth_images * height; //final height size of the 2d texture
        }
        else
        {
            var width_images = depth;
            var tex_width = depth * width;
            var heigth_images = 1.0;
            var tex_height = height;
        }

       var texture = new GL.Texture(tex_width, tex_height, options);

        //guardar la data a la textura 2d
        for (var k = 0; k < heigth_images; k += height)
            for (var j = 0; j < width_images; j += width)
                for (var i = 0; i < height; i++)
                    //texture.data[j, [k, i + width]] = volume._data.slice(i * width, i * width + width); //uploadData()???

        return texture;
    }

    Dicom.prototype.guessTextureParams = function(){
        var volume = this.properties.volume;
        var bytes = volume.voxelBytes;
        var channels = volume.voxelChannels;
        var type = volume.voxelType;
    
        var guess = {
            typeString: "",
            formatString: "",
            internalFormatString: "",
            type: null,
            format: null,
            internalFormat: null
        };
    
        guess.formatString = (channels == 1 ? "RED" : channels == 2 ? "RG" : channels == 3 ? "RGB" : "RGBA");
        guess.internalFormatString = (channels == 1 ? "R" : channels == 2 ? "RG" : channels == 3 ? "RGB" : "RGBA") + (bytes == 1 ? "8" : bytes == 2 ? "16" : "32");
    
        switch(type){
            case "UI":
                guess.typeString = "UNSIGNED_";
                guess.internalFormatString += "U";
            case "I":
                guess.typeString += (bytes == 1 ? "BYTE" : bytes == 2 ? "SHORT" : "INT");
                guess.formatString += "_INTEGER";
                guess.internalFormatString += "I";
                break;
            case "F":
                guess.typeString = "FLOAT";	//1byte can't be float, 2 and 4 bytes can pass a FloatArray (there aren't HalfFloatArrays in JS)
                break;
            default:
                guess.typeString = "UNSIGNED_BYTE";
                break;
        }
    
        guess.type = gl[guess.typeString];
        guess.format = gl[guess.formatString];
        guess.internalFormat = gl[guess.internalFormatString];
    
        return guess;
    }

    Dicom.prototype.onExecute = function()
    {
        if (!isConnected(this, "Output"))
            return;

        if (this.properties.volume === null)
            return;

        var vec = this.getInputData(0);
        if(vec === undefined)
            vec = "v_uv";

        var CODIGO = "getVoxel(" + vec + ")";

        this.setOutputData(0, "texture2D( u_texture, " + vec + " )"); //cuidado si en algun momento necesito mas de una imagen
        this.setOutputData(1, "texture2D( u_texture, " + vec + " ).a");
    }

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
        if (!isConnected(this, "Output"))
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
        if (!isConnected(this, "Output"))
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
        if (!isConnected(this, "Output"))
            return;

        var input = this.getInputData(0);
        if(input === undefined)
            input = "0.0";

        var rampRGB_code = "colorRamp("+ input + "," + this.toString(this.properties.min_value) + "," + this.toString(this.properties.max_value) + ")";
        var ramp_code = rampRGB_code + ".x";

        this.setOutputData(0, rampRGB_code);
        this.setOutputData(1, ramp_code);
    }

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
        if (!isConnected(this, "Output"))
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
        if (!isConnected(this, "Output"))
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
        if (!isConnected(this, "Output"))
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

    LiteGraph.registerNodeType("Operator/Rotate", Rotate);


    // ------------------------------------------ TransferFunc Node ------------------------------------------ //
    function TransferFunc()
    {
        this.addInput("Fac", "value");
        this.addOutput("Color", "color");
        this.addOutput("Fac", "value");
    }

    TransferFunc.title = "TransferFunc";
    TransferFunc.desc = "";

    TransferFunc.prototype.onExecute = function()
    {
        if (!isConnected(this, "Output"))
            return;

        var vector = this.getInputData(0);
        if(vector === undefined)
            vector = "sample_pos";

        if (vector == "v_uv")
            var gradientRGB_code = `` + vector + `.xy, 1.0, 1.0`;
        else var gradientRGB_code = `` + vector + `.xyz, 1.0`;
        var gradient_code = `` + vector + `.x`;

        this.setOutputData(0, gradientRGB_code);
        this.setOutputData(1, gradient_code);
    }

    LiteGraph.registerNodeType("Operator/TransferFunc", TransferFunc);


    // ------------------------------------------ Volume Node ------------------------------------------ //
    function Volume()
    {
        this.addInput("Color", "color");

        this.addInput("Density", "value");
        this.widget = this.addWidget(
            "number",
            "Density",
            1.0,
            this.setValue.bind(this),
            {min: 0, max: 10}
        );

        this.addOutput("Volume", "volume");
    }

    Volume.title = "Volume";
    Volume.desc = "volume render algorithm";

    Volume.prototype.setValue = function(v) 
    {
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
        if (!isConnected(this, "Output"))
            return;

        var color = this.getInputData(0);
        if(color === undefined)
            color = "0.5,0.5,0.5,1.0";
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
        
        var volume_code = `
    vec3 ray_origin = v_pos;
    vec3 ray_direction = normalize(ray_origin - u_local_camera_position);
    vec3 sample_pos = ray_origin;
    vec3 ray_step = ray_direction / u_quality;
    float d = length(ray_step);
    vec4 sample_color;

    for(int i=0; i<100000; i++){     

        float v = ` + density + `; // Density

        sample_color = v * vec4(` + color + `);
        //transparency, applied this way to avoid color bleeding
        sample_color = vec4(sample_color.xyz * sample_color.w, sample_color.w); 
           
        final_color = d * sample_color * (1.0 - final_color.w) + final_color; //compositing with previous value
        if(final_color.w >= 1.0) break;

        sample_pos = sample_pos + ray_step;

        vec3 abss = abs(sample_pos);
        if(i > 1 && (abss.x > u_obj_size || abss.y > u_obj_size || abss.z > u_obj_size)) break;
    }
    `;

        this.setOutputData(0, volume_code);
    }

    LiteGraph.registerNodeType("Shader/Volume", Volume);


    // ------------------------------------------ Output Node ------------------------------------------ //
    function Final()
    {
        this.addInput("Surface", "surface");
        this.addInput("Volume", "volume");
        this.addInput("Displacement", "displacenent");
    }

    Final.title = "Output";
    Final.desc = "material output, assmebles the final shader";

    Final.prototype.onExecute = function()
    {
        // Chech that is not repeated
        for (var i = 1; i < this.id; i++)
        {
            if (this.graph._nodes_by_id[i] === undefined)
                continue;
            if (this.graph._nodes_by_id[i].title == "Output")
                return;
        }
        this.color = "#233"; //use color to remark the usefull output node

        // Check if it has inputs linked
        var inputs = this.inputs;
        if (inputs[0].link == null && inputs[1].link == null && inputs[2].link == null)
        {
            if (parsedFile.length != 0)
            {
                gl.disable(gl.BLEND);
                var Node_VS_code = parsedFile["basicVS"];
                var Node_FS_code = parsedFile["basicFS"];

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
        
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

        var surface = this.getInputData(0);
        if(surface === undefined)
            surface = ``;

        var volume = this.getInputData(1);
        var volume_uniforms = ``;
        if(volume === undefined)
            volume = ``;
        else {
            volume_uniforms = `
uniform float u_obj_size;
uniform float u_cutvalue;
uniform float scale;
uniform float detail;
uniform float distortion;
`;

            if (hasConnection(this, "Rotate"))
                volume_uniforms += parsedFile["Rotate"];
            if (hasConnection(this, "Translate"))
                volume_uniforms += parsedFile["Translate"];
            if (hasConnection(this, "Scale"))
                volume_uniforms += parsedFile["Scale"];
            if (hasConnection(this, "Noise"))
                volume_uniforms += parsedFile["Noise"];
            if (hasConnection(this, "ColorRamp"))
                volume_uniforms += parsedFile["ColorRamp"];
        }	

        var displacement = this.getInputData(2);
        if(displacement === undefined)
            displacement = ``;

        if (parsedFile.length != 0)
        {
            //Create the final shader from the templates and the nodes
            //VS
            var Node_VS_code = parsedFile["volumeVS"];
            //FS
            var Node_FS_code = parsedFile["FSUniforms"] + volume_uniforms + parsedFile["FSVoxelFunc"] +
                parsedFile["FSMain"] + volume + parsedFile["FSReturn"];

            if (Previous_VS !== Node_VS_code || Previous_FS !== Node_FS_code)
            {
                //Load the new shader
                shader = new Shader( Node_VS_code, Node_FS_code );
                Previous_VS = Node_VS_code;
                Previous_FS = Node_FS_code;
            }
        }
    }

    LiteGraph.registerNodeType("Output/Final", Final);
}

// ------------------------------------------ Usefull Functions ------------------------------------------ //

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
function hasConnection(node, destination_node)
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
        if (hasConnection(curr_node, destination_node))
            return true;
    }
    return false;
}