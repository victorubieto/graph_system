\basicVS 

#version 300 es
precision highp float;

in vec3 a_vertex;
in vec3 a_normal;
in vec4 a_color;

out vec3 v_normal;
out vec4 v_color;

uniform mat4 u_mvp;
uniform mat4 u_model;
void main() {
    v_color = a_color;
    v_normal = (u_model * vec4(a_normal,0.0)).xyz;
    gl_Position = u_mvp * vec4(a_vertex,1.0);
}


\basicFS

#version 300 es
precision highp float;

in vec3 v_normal;
out vec4 FragColor;
uniform vec4 u_color;

void main() {
    vec4 final_color = u_color;
    FragColor = vec4( final_color.xyz, 1.0 );
}


\volumeVS

#version 300 es
precision highp float;

in vec3 a_vertex;
in vec3 a_normal;
in vec2 a_coord;

out vec3 v_pos;
out vec3 v_world_pos;
out vec3 v_normal;
out vec2 v_coord;

uniform mat4 u_model;
uniform mat4 u_mvp;
        
void main() {
    v_pos = a_vertex;
    v_world_pos = (u_model * vec4( v_pos, 1.0) ).xyz;

    v_normal = (u_model * vec4( a_normal, 0.0) ).xyz; //a_normal
    v_coord = a_coord;
    
    gl_Position = u_mvp * vec4( v_world_pos, 1.0 );
}


\FSUniforms

#version 300 es
precision highp float;
precision highp sampler3D;
precision highp isampler3D;
precision highp usampler3D;

in vec3 v_pos;
in vec3 v_normal;
in vec2 v_coord;

out vec4 final_color;

uniform vec3 u_camera_position;
uniform vec3 u_local_camera_position;
uniform vec3 u_cam_space;
uniform vec4 u_color;
uniform float u_time;
uniform float u_quality;
uniform float u_brightness;
uniform float u_obj_size;

\FSMain

void main() {
    final_color = vec4(0.0);

\FSReturn

    final_color = final_color * u_brightness;
}