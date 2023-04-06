import hammersley from "./hammersley";
import importanceSampling from "./importanceSampling";

export default `
varying vec2 v_uv;

uniform samplerCube environmentMap;
uniform float face;
uniform float lodRoughness;
uniform float u_textureSize;

#define PI 3.14159265359
#define RECIPROCAL_PI 0.31830988618

const uint SAMPLE_COUNT = 4096u;


float pow2( const in float x ) {
    return x * x;
}

vec4 RGBEToLinear(vec4 value) {
    return vec4( value.rgb * exp2( value.a * 255.0 - 128.0 ), 1.0 );
}

vec4 RGBMToLinear(vec4 value, float maxRange ) {
    return vec4( value.rgb * value.a * maxRange, 1.0 );
}


vec4 gammaToLinear(vec4 srgbIn){
    return vec4( pow(srgbIn.rgb, vec3(2.2)), srgbIn.a);
}

vec4 toLinear(vec4 color){
    vec4 linear;
    #if (DECODE_MODE == 0)
        linear = color;
    #elif (DECODE_MODE == 1)
        linear = gammaToLinear(color);
    #elif (DECODE_MODE == 2)
        linear = RGBEToLinear(color);
    #elif (DECODE_MODE == 3)
        linear = RGBMToLinear(color, 5.0);
    #endif

    return linear;
}

vec4 LinearToRGBM(vec4 value, float maxRange ) {
    float maxRGB = max( value.r, max( value.g, value.b ) );
    float M = clamp( maxRGB / maxRange, 0.0, 1.0 );
    M = ceil( M * 255.0 ) / 255.0;
    return vec4( value.rgb / ( M * maxRange ), M );
}

// Microfacet Models for Refraction through Rough Surfaces - equation (33)
// http://graphicrants.blogspot.com/2013/08/specular-brdf-reference.html
// alpha is "roughness squared" in Disney’s reparameterization
float D_GGX( const in float alpha, const in float dotNH ) {

	float a2 = pow2( alpha );

	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0; // avoid alpha = 0 with dotNH = 1

	return RECIPROCAL_PI * a2 / pow2( denom );

}


${hammersley}
${importanceSampling}

vec3 specular(vec3 N) {
    vec3 R = N;
    vec3 V = R;

    float totalWeight = 0.0;   
    vec3 prefilteredColor = vec3(0.0);     

    for(uint i = 0u; i < SAMPLE_COUNT; ++i)
    {
        vec2 Xi = hammersley(i, SAMPLE_COUNT);
        vec3 H  = importanceSampleGGX(Xi, N, lodRoughness);
        vec3 L  = normalize(2.0 * dot(V, H) * H - V);

        float NdotL = max(dot(N, L), 0.0);
        
        if(NdotL > 0.0)
        {
            float dotNH = dot(N,H);
            float D   = D_GGX(lodRoughness, dotNH);
            float pdf = (D * dotNH / (4.0 * dotNH)) + 0.0001; 
            float saTexel  = 4.0 * PI / (6.0 * u_textureSize * u_textureSize);
            float saSample = 1.0 / (float(SAMPLE_COUNT) * pdf + 0.0001);
            float mipLevel = lodRoughness == 0.0 ? 0.0 : 0.5 * log2(saSample / saTexel); 
            
            vec4 samplerColor = textureCubeLodEXT(environmentMap, L, mipLevel);
            vec3 linearColor = toLinear(samplerColor).rgb;

            prefilteredColor += linearColor * NdotL;
            totalWeight      += NdotL;
        }
    }
    prefilteredColor = prefilteredColor / totalWeight;
    return prefilteredColor;
}

void main() 
{
    float cx = v_uv.x * 2. - 1.;
    float cy = v_uv.y * 2. - 1.;

    vec3 dir = vec3(0.);
    if (face == 0.) { // PX
        dir = vec3( 1.,  cy, -cx);
    }
    else if (face == 1.) { // NX
        dir = vec3(-1.,  cy,  cx);
    }
    else if (face == 2.) { // PY
        dir = vec3( cx,  1., -cy);
    }
    else if (face == 3.) { // NY
        dir = vec3( cx, -1.,  cy);
    }
    else if (face == 4.) { // PZ
        dir = vec3( cx,  cy,  1.);
    }
    else if (face == 5.) { // NZ
        dir = vec3(-cx,  cy, -1.);
    }

    #ifdef FLIP_X
        dir.x *= -1.0;
    #endif
    dir = normalize(dir);


    if (lodRoughness == 0.) {
        gl_FragColor = toLinear(textureCube(environmentMap, dir));
    } else {
        vec3 integratedBRDF = specular(dir);
        gl_FragColor = vec4(integratedBRDF, 1.);
    }
    
    gl_FragColor = LinearToRGBM(gl_FragColor, 5.0);
}
`;
