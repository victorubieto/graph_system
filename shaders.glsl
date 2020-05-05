\basicVS 
        
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


\basicFS
    
precision highp float;
varying vec3 v_normal;
uniform vec4 u_camera_position;
uniform vec4 u_color;
void main() {
    vec4 final_color = u_color;
    gl_FragColor = vec4( final_color.xyz, 1.0 );
}


\volume.vs

precision highp float;
attribute vec3 a_vertex;
attribute vec3 a_normal;
attribute vec2 a_coord;
varying vec3 v_pos;
varying vec3 v_normal;
varying vec2 v_coord;
uniform mat4 u_mvp;
        
void main() {
    v_pos = a_vertex.xyz;
    v_coord = a_coord;
    v_normal = a_normal;
    gl_Position = u_mvp * vec4(v_pos,1.0);
}


\volume1.fs

precision highp float;
varying vec3 v_pos;
varying vec3 v_normal;
uniform vec3 u_local_camera_position;
uniform vec4 u_color;

\volume2.fs

vec4 getVoxel()
{
    // TO DO
    return vec4(0.0);
}

void main() {
    vec4 final_color = vec4(0.0);

\volume3.fs    

    gl_FragColor = final_color;
}
