var Previous_VS = null;
var Previous_FS = null;

addNewNodes = function()
{
    // ------------------------------------------ Number Node ------------------------------------------ //
    function NumberSelect() {
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

    NumberSelect.prototype.setValue = function(v) {
        this.properties.value = v;
    };

    NumberSelect.prototype.onExecute = function() {
        this.setOutputData(0, this.properties.value);
    };

    LiteGraph.registerNodeType("Input/Number", NumberSelect);


    // ------------------------------------------ Color Node ------------------------------------------ //
    function ColorSelect() {
        this.addOutput("Color", "color");
        this.properties = {
            color: [0.5,0.5,0.5,1.0],
        };
    }
    
    ColorSelect.title = "Color";
    ColorSelect.desc = "color selector";

    ColorSelect.prototype.onAddPropertyToPanel = function(i, panel) {
        var elem = document.createElement("input");
        elem.class = "color";
        var that = this;
        elem.onchange = function() {that.setValue(color.rgb)};
        panel.content.appendChild(elem);

        var color = new jscolor.color(elem, {rgb: this.properties.color});
        this.properties.color = color.rgb;

        return true;
    };

    ColorSelect.prototype.setValue = function(v) {
        v.push(1.0);
        this.properties.color = v;
    };

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

        this.setOutputData(0, color);
    };

    LiteGraph.registerNodeType("Input/Color", ColorSelect);


    // ------------------------------------------ TexCoord Node ------------------------------------------ //
    function TexCoord() {
        this.addOutput("Position","vector");
        this.addOutput("Normal","vector");
        this.addOutput("UV","vector");
    }

    TexCoord.title = "TexCoord";
    TexCoord.desc = "coordinate vectors selector";

    TexCoord.prototype.onExecute = function() {
        this.setOutputData(0, "Position");
        this.setOutputData(1, "Normal");
        this.setOutputData(2, "UV");
    };

    LiteGraph.registerNodeType("Input/TexCoord", TexCoord);


    // ------------------------------------------ Gradient Node ------------------------------------------ //
    function Gradient()
    {
        this.addInput("Vector", "vector");
        this.addOutput("Color", "color");
        this.addOutput("Fac", "value");
    }

    Gradient.title = "Gradient";
    Gradient.desc = "creates a gradient effect for a chosen vector";

    Gradient.prototype.onExecute = function()
    {
        var vector = this.getInputData(0);
        if(vector === undefined)
        {
            vector = "sample_pos";
        }

        var gradient_code = `` + vector + `.x`;
        var gradientRGB_code = `` + vector + `.xyz, 1.0`;

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

        this.widgetScale = this.addWidget(
            "number",
            "Scale",
            1.0,
            this.setValue.bind(this),
            {min: -100, max: 100}
        );
        this.widgetDetail = this.addWidget(
            "combo",
            "Detail",
            1,
            this.setValue.bind(this),
            {values: [1, 2, 3, 4, 5, 6, 7, 8]}
        );
    }
    
    Noise.title = "Noise";
    Noise.desc = "gives a random value using perlin noise algorithm";

    Noise.prototype.setValue = function(v) {
        this.widget.value = v;
    };

    Noise.prototype.onExecute = function()
    {
        var vector = this.getInputData(0);
        if(vector === undefined)
        {
            vector = "";
            vectorRGB = ""
        }

        var gradient_code = `` + vector + ``;
        var gradientRGB_code = `` + vectorRGB + ``;

        this.setOutputData(0, gradientRGB_code);
        this.setOutputData(1, gradient_code);
    }

    LiteGraph.registerNodeType("Texture/Noise", Noise);


    // ------------------------------------------ Dicom Node ------------------------------------------ //
    function Dicom()
    {
        this.addInput("Vector", "vector"); //possible input, vector (d'on llegim la textura)
        this.addOutput("Color", "vector");
        this.addOutput("Alpha", "float");

        this.properties = {
            texture: 1, 
        };
    }

    Dicom.title = "Dicom";
    Dicom.desc = "allows the user to load a dicom file";

    Dicom.prototype.onAddPropertyToPanel = function(i, panel) {
        var elem = document.createElement("button");
        elem.class = "button";
        elem.innerText = "Load Dicom";
        
        // var that = this;
        // elem.onchange = function() {that.setValue(color.rgb)};
        panel.content.appendChild(elem);

        // var color = new jscolor.color(elem, {rgb: this.properties.color});
        // this.properties.color = color.rgb;

        return true;
    };

    Dicom.prototype.onExecute = function()
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

    LiteGraph.registerNodeType("Texture/Dicom", Dicom);


    // ------------------------------------------ Node ------------------------------------------ //
    function ColorRamp(a,b)
    {
        return a+b;
    }

    LiteGraph.wrapFunctionAsNode("Operator/ColorRamp", ColorRamp, ["Number","Number"],"Number");


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
    MixColor.desc = "interpolates input colors usign a factor";

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

    LiteGraph.registerNodeType("Operator/MixRGB", MixColor);


    LiteGraph.wrapFunctionAsNode("Operator/Mapping", Mapping, ["Number","Number"],"Number");

    function TransferFunc(a,b)
    {
        return a+b;
    }

    LiteGraph.wrapFunctionAsNode("Operator/TransferFunc", TransferFunc, ["Number","Number"],"Number");


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

    Volume.prototype.setValue = function(v) {
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
            if(i > 1 && (abss.x > 1.0 || abss.y > 1.0 || abss.z > 1.0)) break;
        }
        `;

        this.setOutputData(0, volume_code);
    }

    LiteGraph.registerNodeType("Shader/Volume", Volume);


    // ------------------------------------------ Output Node ------------------------------------------ //
    Shader.Previous_VS = undefined;
    Shader.Previous_FS = undefined;

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

    LiteGraph.registerNodeType("Output/Final", Final);
}