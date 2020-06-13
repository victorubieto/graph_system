"use strict"

/***
 * VOLUME-BASE.js
 * Basic class types definition
 ***/

/***
 * ==Volume class==
 * Describes a 3D dataset
 ***/
var Volume = function Volume(o){
	//Dimensions size
	this.width = 0;
	this.height = 0;
	this.depth = 0;

	//Distance between voxels (some scans use different distances in each dimension)
	this.widthSpacing = 1;
	this.heightSpacing = 1;
	this.depthSpacing = 1;

	//Voxel info
	this.voxelBytes = 1;	//Bytes per channel (1, 2 or 4)
	this.voxelChannels = 1;	//Channels (1, 2, 3 or 4)
	this.voxelType = "UI"	//Options: Unsigned integer: "UI", Integer: "I", Float: "F", Other: "O"

	//Arraybuffer with all voxels. Dimensions increase in this order: width, height, depth
	this._size = 0;
	this._data = null;
	this._texture = null;

	//Auxiliar
	this._min = null;
	this._max = null;
	this._minmax = false;

	if(o) this.configure(o);
}

Volume.prototype.configure = function(o){
	this.width = o.width || this.width;
	this.height = o.height || this.height;
	this.depth = o.depth || this.depth;

	this.widthSpacing	= o.widthSpacing	|| this.widthSpacing;
	this.heightSpacing	= o.heightSpacing	|| this.heightSpacing;
	this.depthSpacing	= o.depthSpacing	|| this.depthSpacing;
	this.voxelBytes		= o.voxelBytes		|| this.voxelBytes;
	this.voxelType		= o.voxelType		|| this.voxelType;
	this.voxelChannels	= o.voxelChannels	|| this.voxelChannels;

	if(this.voxelChannels < 1 || this.voxelChannels > 4){
		console.warn("There should be at least 1 channel and at most 4.");
	}
	this._computeSize();
	this._data = o.data || this._data;

	if(!this._data){
		this._createArrayView(o.buffer);
	}

	this._minmax = false;
}

//Computes theoretical size of data in bytes
Volume.prototype._computeSize = function(){
	this._size = this.width * this.height * this.depth * this.voxelBytes * this.voxelChannels;
	if(this._size == 0 || this._size % (this.voxelBytes*this.voxelChannels) != 0){
		console.warn("Size does not seem correct.");
		return false;
	}
	return true;
}

//Creates an unsigned int arrayview based on the attribute values
//Other types must be created manually
Volume.prototype._createArrayView = function(aBuffer){
	if(!this._computeSize()){
		return;
	}
	aBuffer = aBuffer || new ArrayBuffer(this._size);
	var aView = null;
	
	if(this.voxelType == "I"){
		if(this.voxelBytes == 1){
			aView = new Int8Array(aBuffer);
		}else if(this.voxelBytes == 2){
			aView = new Int16Array(aBuffer);
		}else if(this.voxelBytes == 4){
			aView = new Int32Array(aBuffer);
		}
	}else if(this.voxelType == "F"){
		if(this.voxelBytes == 2){
			aView = new Uint16Array(aBuffer);
		}else if(this.voxelBytes == 4){
			aView = new Float32Array(aBuffer);
		}else if(this.voxelBytes == 8){
			aView = new Float64Array(aBuffer);
		}
	}else{
		if(this.voxelBytes == 1){
			aView = new Uint8Array(aBuffer);
		}else if(this.voxelBytes == 2){
			aView = new Uint16Array(aBuffer);
		}else if(this.voxelBytes == 4){
			aView = new Uint32Array(aBuffer);
		}
	}
	this._data = aView;
}

Volume.prototype.isValid = function(){
	return this._computeSize();
}

Volume.prototype.computeMinMax = function(){
	var m = Infinity;
	var M = -Infinity;

	for(var i=0; i<this._data.length; i++){
		var v = this._data[i];
		if(v < m) m = v;
		if(v > M) M = v;
	}

	this._max = M;
	this._min = m;
}

//Returns a 3D Texture from a Volume data
Volume.prototype.createTexture = function(options){
	options = options || {};

	var width = parseInt(this.width);
	var height = parseInt(this.height);
	var depth = parseInt(this.depth);
	var channels = parseInt(this.voxelChannels);
	var data = this._data;

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
	options.texture_type = gl.TEXTURE_3D;
	
	//Check https://www.khronos.org/registry/webgl/specs/latest/2.0/#3.7.6 texImage2D to see possible combinations for format, type and internalFormat
	//For example for pre-computed gradients {format: gl.RGB, type: gl.UNSIGNED_BYTE, internalFormat: gl.RGB8}
	var guessParams = this.guessTextureParams();

	options.format = options.format || guessParams.format;
	options.type = options.type || guessParams.type;
	options.internalFormat = options.internalFormat || guessParams.internalFormat;
	options.minFilter = options.minFilter || gl.NEAREST;
	options.magFilter = options.magFilter || gl.NEAREST;
	options.wrap = options.wrap || gl.CLAMP_TO_EDGE;

	this._texture = new GL.Texture(width, height, options);
	this._texture._volume = this;
	return this._texture;
}

//Uploads data to an already created 3D texture
Volume.prototype.updateTexture = function(){
	var width = parseInt(this.width);
	var height = parseInt(this.height);
	var depth = parseInt(this.depth);
	var data = this._data;
	var texture = this._texture;

	if(texture.texture_type != gl.TEXTURE_3D){
		console.warn("Texture type is not TEXTURE_3D");
		return false;
	}

	if(data == null){
		console.warn("There must be data to upload");
		return false;
	}
	if(width != texture.width || height != texture.height || depth != texture.depth || data.length != texture.data.length){
		console.warn("Texture and volume dimensions do not match");
		return false;
	}

	texture.uploadData(data, {}, false);
	return true;
}

//Returns best texture parameters for volume data
Volume.prototype.guessTextureParams = function(){
	var bytes = this.voxelBytes;
	var channels = this.voxelChannels;
	var type = this.voxelType;

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

/***
 * ==TransferFunction class==
 * Represents a RGBA TransferFunction (1 byte per value)
 ***/
var TransferFunction = function TransferFunction(){
	this.width = 256;

	this._view = null;
	this._texture = null;
	this._needUpload = false;

	this.init();
}

TransferFunction.prototype.init = function(values){
	//Create arraybuffer with addecuate size (deletes previous data)
	this._view = new Uint8Array(this.width * 4);
	if(values)
		this._view.set(values, 0);

}

TransferFunction.prototype.fromPoints = function(points){
	//Fill buffer data
	var i, t, r, g, b, a;
	i = t = r = g = b = a = 0;

	for(var pos=0; pos<4*this.width; pos+=4){
		var pos_01 = pos / (this.width-1) / 4;

		if(i < points.length && pos_01 > points[i].x) i++;
		if(points.length == 0){
			r = g = b = a = 0;
		}else if(i == 0){
			r = points[i].r;
			g = points[i].g;
			b = points[i].b;
			a = points[i].a;
		}else if(i == points.length){
			r = points[i-1].r;
			g = points[i-1].g;
			b = points[i-1].b;
			a = points[i-1].a;
		}else{
			if(points[i-1].x == points[i].x){
				r = points[i].r;
				g = points[i].g;
				b = points[i].b;
				a = points[i].a;
			}else{
				t = (pos_01-points[i-1].x)/(points[i].x-points[i-1].x);
				r = (1-t)*points[i-1].r + t*points[i].r;
				g = (1-t)*points[i-1].g + t*points[i].g;
				b = (1-t)*points[i-1].b + t*points[i].b;
				a = (1-t)*points[i-1].a + t*points[i].a;
			}
		}

		this._view[pos  ] = Math.round(r * (this.width-1));
		this._view[pos+1] = Math.round(g * (this.width-1));
		this._view[pos+2] = Math.round(b * (this.width-1));
		this._view[pos+3] = Math.round(a * (this.width-1));
	}

	this._needUpload = true;
}

TransferFunction.prototype.update = function(){
	if(this._needUpload){
		this.updateTexture();
	}
}

TransferFunction.prototype.updateTexture = function(){
	if(this._texture != null){
		//Update texture data in GPU
		this._texture.uploadData(this._view, {}, false);
		this._needUpload = false;
	}
}

TransferFunction.prototype.getTransferFunction = function(){
	return this._view;
}

TransferFunction.prototype.getTexture = function(){
	if(this._texture == null){
		//Create GLTexture using that arraybuffer
		this._texture = new GL.Texture(this.width, 1, {texture_type: GL.TEXTURE_2D, format: gl.RGBA, magFilter: gl.NEAREST, pixel_data: this._view});
		this._needUpload = false;
	}

	if(this._needUpload){
		this.updateTexture();
	}

	return this._texture;
}

TransferFunction.create = function(width, values){
	var tf = new TransferFunction();

	tf.width = width || tf.width;
	tf.init();

	return tf;
}

TransferFunction.clone = function(tf){
	return TransferFunction.create(tf.width, tf._view);
}
