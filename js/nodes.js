var Previous_VS = null;
var Previous_FS = null;

addNewNodes = function()
{
    // ----------------------- Volume Node --------------------------------
    function Volume()
    {
        this.addInput("Density", "number");
        this.addInput("Color", "color");
        this.addOutput("Volume", "string");
    }

    Volume.prototype.toString = function(input)
    {
        if (input == null) {
            return "null";
        } else if (input.constructor === Number) {
            return input.toFixed(1);
        } else if (input.constructor === Array) {
            var str = "";
            for (var i = 0; i < (input.length - 1); ++i) {
                str += input[i] + ".0,";
            }
            str += input[i] + ".0";
            return str;
        } else {
            return String(input);
        }
    }

    Volume.title = "Volume";

    Volume.prototype.onExecute = function()
    {
        var density = this.getInputData(0);
        if(density === undefined)
            density = "1.0";
        else density = this.toString(density);
        var color = this.getInputData(1);
        if(color === undefined)
            color = "0.5,0.5,0.5,1.0";
        else color = this.toString(color);
        var volume_code = `
            vec3 ray_origin = v_pos;
            vec3 ray_direction = normalize(ray_origin - u_local_camera_position);
            vec3 sample_pos = ray_origin;
            vec3 ray_step = ray_direction / u_quality;
            float d = length(ray_step);
            vec4 sample_color;

            for(int i=0; i<100000; i++){     

                float v = ` + density + `; // De momento constante

                sample_color = v * vec4(` + color + `);
                sample_color = vec4(sample_color.xyz * sample_color.w, sample_color.w); //transparency, applied this way to avoid color bleeding
                
                final_color = d * sample_color * (1.0 - final_color.w) + final_color; //compositing with previous value
                if(final_color.w >= 1.0) break;

                sample_pos = sample_pos + ray_step;

                vec3 abss = abs(sample_pos);
                if(i > 1 && (abss.x > 1.0 || abss.y > 1.0 || abss.z > 1.0)) break;
            }
            `;

        this.setOutputData(0, volume_code);
    }

    LiteGraph.registerNodeType("VICTOR/Volume", Volume);


    // ------------------------ Gradient Node ----------------------------
    function Gradient()
    {
        this.addInput("Vector", "vector");
        this.addInput("Color", "color");
        this.addOutput("Volume", "string");
    }

    Gradient.title = "Gradient";

    Gradient.prototype.onExecute = function()
    {
        var density = this.getInputData(0);
        if(density === undefined)
            density = "0.1";
        var color = this.getInputData(1);
        if(color === undefined)
            color = "0.0,0.0,0.0,1.0";

        var gradient_code = `
            `;

        this.setOutputData(0, gradient_code);
    }

    LiteGraph.registerNodeType("VICTOR/Gradient", Gradient);


    //
    function Noise(a,b)
    {
        return a+b;
    }

    LiteGraph.wrapFunctionAsNode("VICTOR/Noise", Noise, ["Number","Number"],"Number");

    function TexCoord(a,b)
    {
        return a+b;
    }

    LiteGraph.wrapFunctionAsNode("VICTOR/TexCoord", TexCoord, ["Number","Number"],"Number");

    function ColorRamp(a,b)
    {
        return a+b;
    }

    LiteGraph.wrapFunctionAsNode("VICTOR/ColorRamp", ColorRamp, ["Number","Number"],"Number");

    function Mapping(a,b)
    {
        return a+b;
    }


    // ------------------------ MixRGB Node --------------------------------
    function MixColor()
    {
        this.addInput("Factor", "value");
        this.addInput("Color", "color");
        this.addInput("Color", "color");
        this.addOutput("Color", "color");
    }

    MixColor.title = "MixRGB";

    MixColor.prototype.onExecute = function()
    {
        var fac = this.getInputData(0);
        if (fac === undefined)
            fac = 0.5;
        else fac = Math.min(Math.max(0.0, fac), 1.0);
        var color1 = this.getInputData(1);
        if (color1 === undefined)
            color1 = [0.0, 0.0, 0.0, 1.0];
        else color1 = JSON.parse("[" + color1 + "]");
        var color2 = this.getInputData(2);
        if (color2 === undefined)
            color2 = [0.0, 0.0, 0.0, 1.0];
        else color2 = JSON.parse("[" + color2 + "]");
        
        vec4.scale(color1, color1, fac);
        vec4.scale(color2, color2, (1.0-fac));
        var color_result = vec4.create();
        vec4.add(color_result, color1, color2);

        this.setOutputData(0, "" + color_result + "");
    }

    LiteGraph.registerNodeType("VICTOR/MixRGB", MixColor);


    LiteGraph.wrapFunctionAsNode("VICTOR/Mapping", Mapping, ["Number","Number"],"Number");

    function TransferFunc(a,b)
    {
        return a+b;
    }

    LiteGraph.wrapFunctionAsNode("VICTOR/TransferFunc", TransferFunc, ["Number","Number"],"Number");


    // ---------------------- Texture Image Node -------------------------
    function ImageTex()
    {
        this.addInput("Vector", "vector"); //possible input, vector (d'on llegim la textura)
        this.addOutput("Color", "vector");
        this.addOutput("Alpha", "float");
    }

    ImageTex.title = "Image Texture";

    ImageTex.prototype.onExecute = function()
    {
        var vec = this.getInputData(0);
        if(vec === undefined)
            vec = "v_uv";

        // HE DE MIRAR ESTO!!!!!!!!!!!!!!!!!!!
        CODIGO = `\js
            //define exported uniforms from the shader (name, uniform, widget)
            this.createSampler("Texture","u_texture");
            `;
        shader.uniforms({u_texture: 0}); //revisar el 0

        this.setOutputData(0, "texture2D( u_texture, " + vec + " )"); //cuidado si en algun momento necesito mas de una imagen
        this.setOutputData(0, "texture2D( u_texture, " + vec + " ).a");
    }

    LiteGraph.registerNodeType("VICTOR/ImageTexture", ImageTex);


    // ----------------------- Number Node --------------------------
    function NumberSelect() {
        this.addOutput("Number", 0, { label: "" });
        this.properties = {
            value: 1.0
        }
        this.widget = this.addWidget(
            "number",
            "Value",
            this.properties.value,
            this.setValue.bind(this),
            { min: 0, max: 10}
        );
        this.widgets_up = true;
    }

    NumberSelect.prototype.setValue = function(v) {
        this.properties.value = v;
        this.widget.value = v;
    };

    NumberSelect.title = "Number";

    NumberSelect.prototype.onExecute = function() {
        this.setOutputData(0, this.properties.value);
    };

    NumberSelect.toString = function(o) {
        if (o == null) {
            return "null";
        } else if (o.constructor === Number) {
            return o.toFixed(1);
        } else if (o.constructor === Array) {
            var str = "[";
            for (var i = 0; i < o.length; ++i) {
                str += NumberSelect.toString(o[i]) + (i + 1 != o.length ? "," : "");
            }
            str += "]";
            return str;
        } else {
            return String(o);
        }
    };

    NumberSelect.prototype.onDrawBackground = function(ctx) {
        //show the current value
        this.outputs[0].label = this.properties.value;
    };

    LiteGraph.registerNodeType("VICTOR/Number", NumberSelect);


    //---------------------- Color Node ------------------------
    function ColorSelect() {
        this.addOutput("Color", "color");
        this.properties = {
            color: vec4.create()
        };
        this.properties.color = [0.0,0.0,0.0,1.0];

        this.widget = this.addWidget(
            "string",
            "Color",
            this.properties.color,
            this.setValue.bind(this)
        );
        this.widgets_up = true;
    }

    ColorSelect.prototype.setValue = function(v) {
        this.properties.color = v;
        this.widget.color = v;
    };

    ColorSelect.title = "Color";

    ColorSelect.prototype.onDrawBackground = function(ctx) {
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

    ColorSelect.prototype.onExecute = function() {

        var color = this.properties.color;

        if (this.inputs) {
            for (var i = 0; i < this.inputs.length; i++) {
                var input = this.inputs[i];
                var v = this.getInputData(i);
                if (v === undefined) {
                    continue;
                }
                switch (input.name) {
                    case "RGB":
                    case "RGBA":
                        color.set(v);
                        break;
                    case "R":
                        color[0] = v;
                        break;
                    case "G":
                        color[1] = v;
                        break;
                    case "B":
                        color[2] = v;
                        break;
                    case "A":
                        color[3] = v;
                        break;
                }
            }
        }
        
        //convert into string
        /*for (i = 0; i < color.length; i++)
        {	
            if (color[i] === 0)
                color[i] = "0.0";
            else if (color[i] === 1)
                color[i] = "1.0";
            else
                color[i] = color[i].toString();
        }*/
        //var str_color = color[0] + "," + color[1] + "," + color[2] + "," + color[3];

        this.setOutputData(0, color);
    };

    ColorSelect.prototype.onGetInputs = function() {
        
        return [
            ["RGB", "vec3"],
            ["RGBA", "vec4"],
            ["R", "number"],
            ["G", "number"],
            ["B", "number"],
            ["A", "number"]
        ];
    };

    LiteGraph.registerNodeType("VICTOR/Color", ColorSelect);


    //-------------------- Output Node -----------------------
    Shader.Previous_VS = undefined;
    Shader.Previous_FS = undefined;

    function Final()
    {
        this.addInput("Surface", "string");
        this.addInput("Volume", "string");
        this.addInput("Displacement", "string");
    }

    Final.title = "Output";

    Final.prototype.onExecute = function()
    {
        var surface = this.getInputData(0);
        if(surface === undefined)
            surface = ``;
        var volume = this.getInputData(1);
        var volume_uniforms = ``;
        if(volume === undefined)
            volume = ``;
        else 	
            volume_uniforms = `
                uniform float u_quality;
                uniform float u_cutvalue;
                `;
        var displacement = this.getInputData(2);
        if(displacement === undefined)
            displacement = ``;

            
        if (parsedFile.length != 0)
        {
            //Create the final shader from the templates and the nodes
            //VS
            var Node_VS_code = parsedFile["volume.vs"];
            //FS
            var Node_FS_code = parsedFile["volume1.fs"] + volume_uniforms + parsedFile["volume2.fs"] + volume + parsedFile["volume3.fs"];

            if (Previous_VS !== Node_VS_code || Previous_FS !== Node_FS_code)
            {
                //Load the new shader
                shader = new Shader( Node_VS_code, Node_FS_code );
                Previous_VS = Node_VS_code;
                Previous_FS = Node_FS_code;
            }
        }
    }

    LiteGraph.registerNodeType("VICTOR/Final", Final);
}