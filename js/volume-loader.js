"use strict"

/***
 * VOLUME-LOADER.js
 * Parsers for dicom, nifti and vl files
 ***/

/***
 * ==VolumeLoader class==
 * Loads Volume objects from VL, Dicom or Nifti
 * Requires daikon.js for dicom files and nifti-reader.js for nifti files
 ***/
var VolumeLoader = {};

VolumeLoader.STARTING = 0;
VolumeLoader.LOADINGFILES = 1;
VolumeLoader.PARSINGFILES = 2;
VolumeLoader.CREATINGVOLUMES = 3;
VolumeLoader.DONE = 4;
VolumeLoader.ERROR = 5;

//Dicom utils
VolumeLoader.DicomUtils = {
	TAGS: {
		modality 			: "00080060",
		studyDescription 	: "00081030",
		MRAcquisitionType	: "00180023", //[1D, 2D, 3D]
		rows 				: "00280010", //# of rows
		columns 			: "00280011", //# of columns
		slices				: "00201002", //# of images AKA slices, not allways defined!
		pixelSpacing 		: "00280030", //mm between 2 centers of pixels. Value[0] is for pixels in 2 adjacent rows and value[1] is for pixels in 2 djacent columns
		sliceThickness		: "00180050", //mm between 2 centers of pixels in adjacent slices
		samplesPerPixel 	: "00280002", 		//[ 1			, 1				 , 3	, 3			, 3				, 3			, 3			, 3					]
		photometricInterpretation : "00280004", //[MONOCHROME2	, PALETTE COLOR	 , RGB	, YBR_FULL	, YBR_FULL_422	, YBR_RCT	, YBR_ICT	, YBR_PARTIAL_420	]
		bitsAllocated		: "00280100", //number of bits per value
		bitsStored			: "00280101", //number of bits actually used, must be equal or less than bits allocated
		pixelData			: "7FE00010", //if this tag exists the data is unsigned integer
		floatPixelData		: "7FE00008", //if this tag exists the data is float
		doublePixelData		: "7FE00009", //if this tag exists the data is double
	}
};

//Nifti utils
VolumeLoader.NiftiUtils = {
	DataTypes: {
		0: "unknown",
		1: "bool",
		2: "unsigned char",
		4: "signed short",
		8: "signed int",
		16: "float",
		32: "complex",
		64: "double",
		128: "RGB",
		255: "all",
		256: "signed char",
		512: "unsigned short",
		768: "unsigned int",
		1024: "long long",
		1280: "unsigned long long",
		1536: "long double",
		1792: "double pair",
		2048: "long double pair",
		2304: "RGBA"
	}
};

//Returns an array of values. Usually only contains 1 value inside the array. => Check Dicom Standard
VolumeLoader.DicomUtils.getValue = function(image, tag){
	if(image.tags[tag])
		return image.tags[tag].value;
	return null;
}

VolumeLoader.loadFile = function(file, callback){
	var reader = new FileReader();
	reader.onloadend = function(event){
		if(event.target.readyState === FileReader.DONE){
	        var buffer = event.target.result;
	        callback(buffer);
	    }
	}
	reader.readAsArrayBuffer(file);
}

VolumeLoader.loadVLFiles = async function(files, onend, oninfo){
	var response = {};	//Info like progress to provide to callback while is parsing and creating Volumes
	
	response.status = VolumeLoader.STARTING;
	if(oninfo) oninfo(response);	//Informative callback, it does not contain volumes yet

	var currentFile = 0;
	var totalFiles = files.length;

	var buffers = [];

	function readFile(){
		if(currentFile < totalFiles){
			VolumeLoader.loadFile(files[currentFile++], onFileLoaded);
		}else{
			VolumeLoader.parseVLBuffers(buffers, onend, oninfo);
		}
	}

	function onFileLoaded(buffer){
		buffers.push(buffer);
		readFile();
	}

	response.status = VolumeLoader.LOADINGFILES;
	if(oninfo) oninfo(response);	//Informative callback, it does not contain volumes yet
	readFile();
}

VolumeLoader.parseVLBuffers = async function(buffers, onend, oninfo){
	var response = {};	//Info like progress to provide to callback while is parsing and creating Volumes

	response.status = VolumeLoader.PARSINGFILES;
	if(oninfo) oninfo(response);	//Informative callback, it does not contain volumes yet

	var vls = [];
	var volumes = [];

	for(var buffer of buffers){
		var vl = VolumeLoader.parseVL(buffer);

		if(vl.data){
			vl.buffer = buffer;
			vls.push(vl);
		}else{
			response.status = VolumeLoader.ERROR;
			response.explanation = "Could not parse VL file with version " + vl.version;
			if(oninfo) oninfo(response);
		}
	}

	if(vls.length == 0){
		response.status = VolumeLoader.ERROR;
		response.explanation = "There are no valid VLs.";
	    onend(response);
	    return;
	}

	//Create a volume for each volume
	response.status = VolumeLoader.CREATINGVOLUMES;
	if(oninfo) oninfo(response);	//Informative callback, it does not contain volumes yet

	for(var vl of vls){
		var volume = new Volume({
			width: vl.width,
			height: vl.height,
			depth: vl.depth,
			widthSpacing: vl.widthSpacing,
			heightSpacing: vl.heightSpacing,
			depthSpacing: vl.depthSpacing,
			voxelChannels: vl.voxelChannels,
			voxelBytes: vl.voxelBytes,
			buffer: vl.data
		});
		vl.volume = volume;
		volumes.push(volume);
	}

	response.status = VolumeLoader.DONE;
	response.vls = vls;
	response.volume = volumes[0];
	response.volumes = volumes;

	onend(response);	//Final callback, it does contain volumes (and also raw images and series from daikon)
}

VolumeLoader.parseVL = function(buffer){
	var view32 = new Uint32Array(buffer);
	var view32F = new Float32Array(buffer);
	var vl = {
		version: view32[0],
	};

	if(vl.version == 1){
		vl = VolumeLoader._parseVL1(buffer, view32, view32F);
	}else if(vl.version == 2){
		vl = VolumeLoader._parseVL2(buffer, view32, view32F);
	}

	return vl;
}

VolumeLoader._parseVL1 = function(buffer, view32, view32F){
	var headerElements = 9;
	var vl = {};
	vl.version = view32[0];
	vl.width = view32[1];
	vl.height = view32[2];
	vl.depth = view32[3];
	vl.widthSpacing = view32F[4];
	vl.heightSpacing = view32F[5];
	vl.depthSpacing = view32F[6];
	vl.voxelChannels = view32[7];
	vl.voxelBytes = view32[8] / 8;
	vl.voxelType = "UI";
	vl.data = buffer.slice(4*headerElements);
	return vl;
}

VolumeLoader._parseVL2 = function(buffer, view32, view32F){
	var headerElements = 10;
	var vl = {};
	vl.version = view32[0];
	vl.width = view32[1];
	vl.height = view32[2];
	vl.depth = view32[3];
	vl.widthSpacing = view32F[4];
	vl.heightSpacing = view32F[5];
	vl.depthSpacing = view32F[6];
	vl.voxelChannels = view32[7];
	vl.voxelBytes = view32[8] / 8;
	vl.voxelType = view32[9] == 0 ? "UI" : view32[9] == 1 ? "I" : view32[9] == 2 ? "F" : "O";
	vl.data = buffer.slice(4*headerElements);
	return vl;
}

VolumeLoader.loadDicomFiles = async function(files, onend, oninfo){
	var response = {};	//Info like progress to provide to callback while is parsing and creating Volumes
	
	if(daikon === undefined){
		console.warn("Library daikon.js is needed to perfom this action.");
		response.status = VolumeLoader.ERROR;
		response.explanation = "Library daikon.js is needed to perfom this action."
	    onend(response);
	    return;
	}

	response.status = VolumeLoader.STARTING;
	if(oninfo) oninfo(response);	//Informative callback, it does not contain volumes yet

	var currentFile = 0;
	var totalFiles = files.length;

	var buffers = [];

	function readFile(){
		if(currentFile < totalFiles){
			VolumeLoader.loadFile(files[currentFile++], onFileLoaded);
		}else{
			VolumeLoader.parseDicomBuffers(buffers, onend, oninfo);
		}
	}

	function onFileLoaded(buffer){
		buffers.push(buffer);
		readFile();
	}

	response.status = VolumeLoader.LOADINGFILES;
	if(oninfo) oninfo(response);	//Informative callback, it does not contain volumes yet
	readFile();
}

VolumeLoader.parseDicomBuffers = async function(buffers, onend, oninfo){
	var response = {};	//Info like progress to provide to callback while is parsing and creating Volumes

	if(daikon === undefined){
		console.warn("Library daikon.js is needed to perfom this action.");
		response.status = VolumeLoader.ERROR;
		response.explanation = "Library daikon.js is needed to perfom this action."
	    onend(response);
	    return;
	}

	response.status = VolumeLoader.PARSINGFILES;
	if(oninfo) oninfo(response);	//Informative callback, it does not contain volumes yet

	var series = {};	//Map seriesId of image with a serie
	var volumes = [];	//Contains a volume for each serie

	//Extract images from dicoms and assign each to a serie
	for(var buffer of buffers){
		var image = daikon.Series.parseImage(new DataView(buffer))

		if(image !== null && image.hasPixelData()){
			var seriesId = image.getSeriesId();
			if(!series[seriesId]){
				series[seriesId] = new daikon.Series();
				series[seriesId].buffers = [];
				series[seriesId].volume = null;
			}

			series[seriesId].addImage(image);
			series[seriesId].buffers.push(buffer);
		}
	}

	if(Object.keys(series).length == 0){
		response.status = VolumeLoader.ERROR;
		response.explanation = "There are no valid Dicoms.";
	    onend(response);
	    return;
	}

	//Create a volume for each serie
	response.status = VolumeLoader.CREATINGVOLUMES;
	if(oninfo) oninfo(response);	//Informative callback, it does not contain volumes yet
	for(var seriesId in series){
		var serie = series[seriesId];

		serie.buildSeries();

		var width  = VolumeLoader.DicomUtils.getValue(serie.images[0], VolumeLoader.DicomUtils.TAGS.columns)[0];
		var height = VolumeLoader.DicomUtils.getValue(serie.images[0], VolumeLoader.DicomUtils.TAGS.rows)[0];
		var depth  = serie.images.length;

		var widthSpacing  = VolumeLoader.DicomUtils.getValue(serie.images[0], VolumeLoader.DicomUtils.TAGS.pixelSpacing)[0] || 1;
		var heightSpacing = VolumeLoader.DicomUtils.getValue(serie.images[0], VolumeLoader.DicomUtils.TAGS.pixelSpacing)[1] || 1;
		var depthSpacing  = VolumeLoader.DicomUtils.getValue(serie.images[0], VolumeLoader.DicomUtils.TAGS.sliceThickness)[0] || 1;

		var voxelChannels = VolumeLoader.DicomUtils.getValue(serie.images[0], VolumeLoader.DicomUtils.TAGS.samplesPerPixel)[0] || 1;
		var voxelBytes	  = VolumeLoader.DicomUtils.getValue(serie.images[0], VolumeLoader.DicomUtils.TAGS.bitsAllocated)[0]/8 || 1;
		if(voxelBytes == 1/8){ //binary data
			//TODO
			voxelBytes = 1;
		}

		var totalVoxels = width * height * depth;
		var totalBytes = totalVoxels * voxelBytes * voxelChannels;
		var sliceValues = width * height * voxelChannels;

		var buffer = new ArrayBuffer(totalBytes);
		var view;

		var voxelType = "O";
		if(VolumeLoader.DicomUtils.getValue(serie.images[0], VolumeLoader.DicomUtils.TAGS.pixelData) != null){	//INTEGER DATA
			if(serie.images[0].getPixelRepresentation()){	//SIGNED
				voxelType = "I";
				if(voxelBytes == 1){
					view = new Int8Array(buffer);
				}else if(voxelBytes == 2){
					view = new Int16Array(buffer);
				}else{
					view = new Int32Array(buffer);
				}
			}else{	//UNSIGNED
				voxelType = "UI";
				if(voxelBytes == 1){
					view = new Uint8Array(buffer);
				}else if(voxelBytes == 2){
					view = new Uint16Array(buffer);
				}else{
					view = new Uint32Array(buffer);
				}
			}
		}else if(VolumeLoader.DicomUtils.getValue(serie.images[0], VolumeLoader.DicomUtils.TAGS.floatPixelData) != null ||	//FLOAT DATA
				 VolumeLoader.DicomUtils.getValue(serie.images[0], VolumeLoader.DicomUtils.TAGS.doublePixelData) != null){
			voxelType = "F";
			if(voxelBytes == 4){
				view = new Float32Array(buffer);
			}else{
				view = new Float64Array(buffer);
			}
		}

		var min = Infinity;
		var max = -Infinity;

		for(var i=0; i<depth; i++){
			var image = serie.images[i];
			var imageDataObject = image.getInterpretedData(true, true);
			if(imageDataObject.min < min) min = imageDataObject.min;
			if(imageDataObject.max > max) max = imageDataObject.max;
			var imageData = imageDataObject.data;
			view.set(imageData, i * sliceValues);
		}

		var volume = new Volume({
			width: width,
			height: height,
			depth: depth,
			widthSpacing: widthSpacing,
			heightSpacing: heightSpacing,
			depthSpacing: depthSpacing,
			voxelChannels: voxelChannels,
			voxelBytes: voxelBytes,
			voxelType: voxelType,
			data: view
		});
		serie.volume = volume;
		volumes.push(volume);
	}

	response.status = VolumeLoader.DONE;
	response.series = series;
	response.volume = volumes[0];
	response.volumes = volumes;

	onend(response);	//Final callback, it does contain volumes (and also raw images and series from daikon)
}

VolumeLoader.loadNiftiFiles = function(files, onend, oninfo){
	var response = {};	//Info like progress to provide to callback while is parsing and creating Volumes
	
	if(nifti === undefined){
		console.warn("Library nifti-reader.js is needed to perfom this action.");
		response.status = VolumeLoader.ERROR;
		response.explanation = "Library nifti-reader.js is needed to perfom this action."
	    onend(response);
	    return;
	}

	response.status = VolumeLoader.STARTING;
	if(oninfo) oninfo(response);	//Informative callback, it does not contain volumes yet

	var currentFile = 0;
	var totalFiles = files.length;

	var buffers = [];

	function readFile(){
		if(currentFile < totalFiles){
			VolumeLoader.loadFile(files[currentFile++], onFileLoaded);
		}else{
			VolumeLoader.parseNiftiBuffers(buffers, onend, oninfo);
		}
	}

	function onFileLoaded(buffer){
		buffers.push(buffer);
		readFile();
	}

	response.status = VolumeLoader.LOADINGFILES;
	if(oninfo) oninfo(response);	//Informative callback, it does not contain volumes yet
	readFile();
}

VolumeLoader.parseNiftiBuffers = function(buffers, onend, oninfo){
	var response = {};	//Info like progress to provide to callback while is parsing and creating Volumes
	
	if(nifti === undefined){
		console.warn("Library nifti-reader.js is needed to perfom this action.");
		response.status = VolumeLoader.ERROR;
		response.explanation = "Library nifti-reader.js is needed to perfom this action."
	    onend(response);
	    return;
	}

	response.status = VolumeLoader.PARSINGFILES;
	if(oninfo) oninfo(response);	//Informative callback, it does not contain volumes yet

	var niftis = [];	//Contains all nifti objects
	var volumes = [];	//Contains a volume for each serie

	for(var buffer of buffers){
		var niftiData = buffer;
		var niftiHeader = null;

    	if (nifti.isCompressed(niftiData)) {
    		niftiData = nifti.decompress(niftiData);
		}

		if (nifti.isNIFTI(niftiData)) {
		    niftiHeader = nifti.readHeader(niftiData);

		    niftis.push({
		    	niftiHeader: niftiHeader,
		    	buffer: buffer,
		    	volume: null,
		    });
		}else{
			response.status = VolumeLoader.ERROR;
			response.explanation = "Nifti file does not contain data."
	    	onend(response);
		}
	}

	if(niftis.length == 0){
		response.status = VolumeLoader.ERROR;
		response.explanation = "There are no valid Niftis.";
	    onend(response);
	    return;
	}

	response.status = VolumeLoader.CREATINGVOLUMES;
	if(oninfo) oninfo(response);	//Informative callback, it does not contain volumes yet

	for(var nii of niftis){
		var niftiHeader = nii.niftiHeader;
		var niftiData = nii.buffer;

		if(niftiHeader.dims[0] > 3){
		    console.log("Nifti data has more dimensions than 3, using only 3 first dimensions.");
		}

		var width 	= niftiHeader.dims[1];
		var height 	= niftiHeader.dims[2];
		var depth 	= niftiHeader.dims[3];

		var widthSpacing 	= niftiHeader.pixDims[1];
		var heightSpacing 	= niftiHeader.pixDims[2];
		var depthSpacing 	= niftiHeader.pixDims[3];

		var voxelBytes = niftiHeader.numBitsPerVoxel / 8;
		var voxelBuffer = nifti.readImage(niftiHeader, niftiData);
		var voxelView = null;
		var voxelType = "O";
		switch(niftiHeader.datatypeCode){
			case 2:		//unsigned char (byte)
			case 128:	//RGB bytes
			case 2304:	//RGBA bytes
				voxelType = "UI";
				voxelView = new Uint8Array(voxelBuffer);
				break;
			case 512:	//unsigned short
				voxelType = "UI";
				voxelView = new Uint16Array(voxelBuffer);
				break;
			case 768:	//unsigned int
				voxelType = "UI";
				voxelView = new Uint32Array(voxelBuffer);
				break;

			case 256:	//signed byte
				voxelType = "I";
				voxelView = new Int8Array(voxelBuffer);
				break;
			case 4:		//signed short
				voxelType = "I";
				voxelView = new Int16Array(voxelBuffer);
				break;
			case 8:		//signed int
				voxelType = "I";
				voxelView = new Int32Array(voxelBuffer);
				break;

			default:
				console.warn("Data type not covered, returning empty volume. Check dataTypeName for more info to manually create adequate view of voxelBuffer.");
		}

		var volume = new Volume({
			width: width,
			height: height,
			depth: depth,
			widthSpacing: widthSpacing,
			heightSpacing: heightSpacing,
			depthSpacing: depthSpacing,
			voxelBytes: voxelBytes,
			voxelType: voxelType,
			data: voxelView
		});
		nii.dataTypeName = VolumeLoader.NiftiUtils.DataTypes[niftiHeader.datatypeCode];
		nii.volume = volume;
		volumes.push(volume);
	}

	response.status = VolumeLoader.DONE;
	response.niftis = niftis;
	response.volume = volumes[0];
	response.volumes = volumes;

	onend(response);	//Final callback, it does contain volumes (and also raw nifti)
}

VolumeLoader.getVolumeAsVL1Buffer = function(volume){
	var vl1HeaderElements = 9;
	var headerSize = 4*vl1HeaderElements; //4 bytes per number in header

	var buffer = new ArrayBuffer(volume._data.byteLength + headerSize);

	var view32 = new Uint32Array(buffer);
	var view32F = new Float32Array(buffer);
	view32[0] = 1;
	view32[1] = volume.width;
	view32[2] = volume.height;
	view32[3] = volume.depth;
	view32F[4] = volume.widthSpacing;
	view32F[5] = volume.heightSpacing;
	view32F[6] = volume.depthSpacing;
	view32[7] = volume.voxelChannels;
	view32[8] = volume.voxelBytes * 8;

	var view8 = new Uint8Array(buffer);
	var dataview8 = new Uint8Array(volume._data.buffer);
    view8.set(dataview8, headerSize);

    return view8;
}

VolumeLoader.getVolumeAsVL2Buffer = function(volume){
	var vl1HeaderElements = 10;
	var headerSize = 4*vl1HeaderElements; //4 bytes per number in header

	var buffer = new ArrayBuffer(volume._data.byteLength + headerSize);

	var view32 = new Uint32Array(buffer);
	var view32F = new Float32Array(buffer);
	view32[0] = 2;
	view32[1] = volume.width;
	view32[2] = volume.height;
	view32[3] = volume.depth;
	view32F[4] = volume.widthSpacing;
	view32F[5] = volume.heightSpacing;
	view32F[6] = volume.depthSpacing;
	view32[7] = volume.voxelChannels;
	view32[8] = volume.voxelBytes * 8;
	view32[9] = volume.voxelType == "UI" ? 0 : volume.voxelType == "I" ? 1 : volume.voxelType == "F" ? 2 : 3;

	var view8 = new Uint8Array(buffer);
	var dataview8 = new Uint8Array(volume._data.buffer);
    view8.set(dataview8, headerSize);

    return view8;
}

VolumeLoader.downloadVL = function(volume){
	var view8 = VolumeLoader.getVolumeAsVL2Buffer(volume);
	var blob = new Blob([view8]);
    var fakeUrl = URL.createObjectURL(blob);
	var element = document.createElement("a");
	element.setAttribute('href', fakeUrl);
	element.setAttribute('download', "texture3d.vl" );
	element.style.display = 'none';
	document.body.appendChild(element);
	element.click();
	document.body.removeChild(element);
};