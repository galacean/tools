import hammersley from "./hammersley";
import importanceSampling from "./importanceSampling";

export default `
#include <common>

vec4 RGBEToLinear(vec4 value) {
    return vec4( value.rgb * exp2( value.a * 255.0 - 128.0 ), 1.0 );
}
    
varying vec2 v_uv;

uniform samplerCube environmentMap;
uniform float face;
uniform float lodRoughness;
uniform float u_textureSize;

const uint SAMPLE_COUNT = 4096u;
const float MIN_ROUGHNESS = 0.002025; // = 0.045² (perceptualRoughness minimum squared)

// HDR luminance compression thresholds
const float HDR_LINEAR = 1024.0;   // no compression below this luminance
const float HDR_MAX = 16384.0;     // compress between HDR_LINEAR and HDR_MAX

vec4 toLinear(vec4 color){
    vec4 linear;
    #if (DECODE_MODE == 0)
        linear = color;
    #elif (DECODE_MODE == 1)
        linear = sRGBToLinear(color);
    #elif (DECODE_MODE == 2)
        linear = RGBEToLinear(color);
    #endif

    return linear;
}

// HDR luminance-based tone compression
// See: Brian Karis, http://graphicrants.blogspot.com/2013/12/tone-mapping.html
vec3 compressHDR(const in vec3 color) {
    const vec3 rec709 = vec3(0.2126, 0.7152, 0.0722);
    float luma = dot(color, rec709);
    float s = 1.0;
    if (luma > HDR_LINEAR) {
        s = ((HDR_LINEAR * HDR_LINEAR - HDR_MAX * luma) / ((2.0 * HDR_LINEAR - HDR_MAX - luma) * luma));
    }
    return color * s;
}

// GGX normal distribution function
// NOTE: (aa-1) == (a-1)(a+1) produces better fp accuracy
float D_GGX( const in float a, const in float NoH ) {
    float f = (a - 1.0) * ((a + 1.0) * (NoH * NoH)) + 1.0;
    return (a * a) / (PI * f * f);
}


${hammersley}
${importanceSampling}

// Pre-filtered importance sampling
// See: Krivanek, "Real-time Shading with Filtered Importance Sampling"
// See: Colbert, "GPU-Based Importance Sampling", GPU Gems 3
vec3 specular(vec3 N) {
    vec3 V = N;

    float totalWeight = 0.0;
    vec3 prefilteredColor = vec3(0.0);

    // Solid angle of a texel in the base cubemap
    float omegaP = 4.0 * PI / (6.0 * u_textureSize * u_textureSize);

    for(uint i = 0u; i < SAMPLE_COUNT; ++i)
    {
        vec2 Xi = hammersley(i, SAMPLE_COUNT);
        vec3 H  = importanceSampleGGX(Xi, N, lodRoughness);
        vec3 L  = normalize(2.0 * dot(V, H) * H - V);

        float NdotL = max(dot(N, L), 0.0);

        if(NdotL > 0.0)
        {
            float NoH = max(dot(N, H), 0.0);

            // pdf = D(NoH, roughness) / 4
            // Since V == N, VoH == NoH, Jacobian 1/(4*VoH) cancels with NoH in numerator
            float pdf = D_GGX(max(MIN_ROUGHNESS, lodRoughness), NoH) * 0.25;

            // Solid angle of this importance sample
            float omegaS = 1.0 / (float(SAMPLE_COUNT) * pdf);

            // K = 4 LOD bias for overlapping samples (Krivanek)
            // lod = log4(K * omegaS / omegaP) = 1.0 + 0.5 * log2(omegaS / omegaP)
            float mipLevel = 1.0 + 0.5 * log2(omegaS / omegaP);
            mipLevel = max(mipLevel, 0.0);

            vec4 samplerColor = textureCubeLodEXT(environmentMap, L, mipLevel);
            vec3 linearColor = compressHDR(toLinear(samplerColor).rgb);

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
        gl_FragColor = vec4(compressHDR(toLinear(textureCube(environmentMap, dir)).rgb), 1.0);
    } else {
        vec3 integratedBRDF = specular(dir);
        gl_FragColor = vec4(integratedBRDF, 1.);
    }
}
`;
