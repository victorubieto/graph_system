
/** --- Víctor Ubieto 2020 --- 
 *  This file contains some useful classes used in the application, these file also uses litegl methods and classes
**/

"use strict"

/**
 * ----- Mouse Class -----
 * It controls the mouse state
**/

function Mouse()
{
    this._button = 0;
    this._pos_x = 0;
    this._pos_y = 0;
    this._delta_x = 0;
    this._delta_y = 0;
    this._drag_state = false;
    this._wheel_value = 0;
    this._wheel_state = false;

    this.initListeners();
}

Mouse.prototype.initListeners = function()
{
    var that = this; //to use in the callbacks

    gl.captureMouse(true);
    gl.onmousemove = function(e)
    {
        that._button = e.buttons; // 1 left, 2 right, 4 middle
        that._pos_x = e.canvasx;
        that._pos_y = e.canvasy;
        that._drag_state = e.dragging;
        that._delta_x = e.deltax; // - 1 left to 1 right
        that._delta_y = e.deltay; // - 1 top to 1 down
    }
    gl.onmouseup = function(e)
    {
        that._drag_state = false;
        that._delta_x = 0;
        that._delta_y = 0;
    }
    gl.onmousewheel = function(e)
    {
        that._wheel_value = e.wheel;
	    that._wheel_state = true;
    }

    //gl.captureKeys(true); not used
}

/**
 * ----- Entity Class -----
 * It controls the objects
**/

function Entity( options ) // options: type (name), size (width)
{
    this._model_matrix = mat4.create();
    this._modelview_matrix = mat4.create();

    this._mesh = null;
    this._mesh_type = options.type;
    if (options)
    {
        if (options.type)
            switch(this._mesh_type)
            {
                case "cube":
                    this._mesh = GL.Mesh.cube({size: options.size || 2});
                    break;
                case "sphere": // actually this won't work well on volume rendering
                    this._mesh = GL.Mesh.sphere({radius: options.size/2 || 1});
                    break;
            };
        if (options.size)
            mat4.scale( this._model_matrix, this._model_matrix, [options.size, options.size, options.size] );
    }

}

// Adjust camera to mesh bounding
Entity.prototype.centerInView = function(camera) 
{
    camera._target = BBox.getCenter( this._mesh.bounding );
    var r = BBox.getRadius( this._mesh.bounding );
    camera._position = vec3.add( camera._position, camera._target, [0,r*0.5, r*3] );
}