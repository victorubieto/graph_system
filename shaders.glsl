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


\volumeVS

precision highp float;
attribute vec3 a_vertex;
attribute vec3 a_normal;
attribute vec2 a_coord;
varying vec3 v_pos;
varying vec3 v_normal;
varying vec2 v_uv;
varying vec2 v_coord;
uniform mat4 u_mvp;
        
void main() {
    v_pos = a_vertex.xyz;
    v_coord = a_coord;
    v_normal = a_normal;
    gl_Position = u_mvp * vec4(v_pos,1.0);
}


\FSUniforms

precision highp float;
varying vec3 v_pos;
varying vec3 v_normal;
varying vec2 v_uv;
uniform vec3 u_camera_position;
uniform vec3 u_local_camera_position;
uniform vec4 u_color;
uniform float u_time;
uniform float u_quality;
uniform float u_brightness;

\FSVoxelFunc

vec4 getVoxel()
{

\FSMain

    return vec4(0.0);
}

void main() {
    vec4 final_color = vec4(0.0);

\FSReturn

    gl_FragColor = final_color * u_brightness;
}


\Noise2

vec4 permute( vec4 x ) {return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt( vec4 r ) {return 1.79284291400159 - 0.85373472095314 * r;}
vec3 fade( vec3 t ) {return t*t*t*(t*(t*6.0-15.0)+10.0);}
float rand( float n ){return fract(sin(n) * 43758.5453123);}

float noise3D( vec3 P)
{
    vec3 Pi0 = floor(P); // Integer part for indexing
    vec3 Pi1 = Pi0 + vec3(1.0); // Integer part + 1
    Pi0 = mod(Pi0, 289.0);
    Pi1 = mod(Pi1, 289.0);
    vec3 Pf0 = fract(P); // Fractional part for interpolation
    vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0
    vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
    vec4 iy = vec4(Pi0.yy, Pi1.yy);
    vec4 iz0 = Pi0.zzzz;
    vec4 iz1 = Pi1.zzzz;

    vec4 ixy = permute(permute(ix) + iy);
    vec4 ixy0 = permute(ixy + iz0);
    vec4 ixy1 = permute(ixy + iz1);

    vec4 gx0 = ixy0 / 7.0;
    vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
    gx0 = fract(gx0);
    vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
    vec4 sz0 = step(gz0, vec4(0.0));
    gx0 -= sz0 * (step(0.0, gx0) - 0.5);
    gy0 -= sz0 * (step(0.0, gy0) - 0.5);

    vec4 gx1 = ixy1 / 7.0;
    vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
    gx1 = fract(gx1);
    vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
    vec4 sz1 = step(gz1, vec4(0.0));
    gx1 -= sz1 * (step(0.0, gx1) - 0.5);
    gy1 -= sz1 * (step(0.0, gy1) - 0.5);

    vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
    vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
    vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
    vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
    vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
    vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
    vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
    vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

    vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
    g000 *= norm0.x;
    g010 *= norm0.y;
    g100 *= norm0.z;
    g110 *= norm0.w;
    vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
    g001 *= norm1.x;
    g011 *= norm1.y;
    g101 *= norm1.z;
    g111 *= norm1.w;

    float n000 = dot(g000, Pf0);
    float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
    float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
    float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
    float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
    float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
    float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
    float n111 = dot(g111, Pf1);

    vec3 fade_xyz = fade(Pf0);
    vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
    vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
    float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
    return 2.2 * n_xyz;
}

#define MAX_OCTAVES 16

float fractal_noise( vec3 P)
{
    float fscale = 1.0;
    float amp = 1.0;
    float sum = 0.0;
    float octaves = clamp(detail, 0.0, 16.0);
    int n = int(octaves);

    for (int i = 0; i <= MAX_OCTAVES; i++) {
        if (i > n) continue;
        float t = noise3D(fscale * P);
        sum += t * amp;
        amp *= 0.5;
        fscale *= 2.0;
    }

    return sum;
}

float cnoise( vec3 P )
{
    P *= scale;
    
    if (distortion != 0.0) {
        float value = noise3D(P);
        P += vec3(noise3D(P + rand(0.0)) * distortion,
                noise3D(P + rand(1.0)) * distortion,
                noise3D(P + rand(2.0)) * distortion);
    }

    return fractal_noise(P);
}


\ColorRamp

vec4 colorRamp(float fac, float clamp_min, float clamp_max){
    float value;
    if ( fac < 0.5 ){
        value = clamp(fac, 0.0, clamp_min);
    }
    else{
        value =  clamp(fac, clamp_max, 1.0);
    }
    return vec4(vec3(value), 1.0);
}


\Translate

vec3 setTranslation(vec3 vector, float x, float y, float z){
    return vector + vec3(x, y, z);
}


\Scale

vec3 setScale(vec3 vector, float x, float y, float z){
    return vector * vec3(x, y, z);
}


\Rotate

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
}


\Noise

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
    
    // if (distortion != 0.0) { // not used due to the computational cost
    //     float value = noise(P);
    //     P += vec3(noise(P + rand(0)) * distortion,
    //             noise(P + rand(1)) * distortion,
    //             noise(P + rand(2)) * distortion);
    // }

    return fractal_noise(P);
}
