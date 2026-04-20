export default `Shader "Galacean-IBL-baker" {
  SubShader "Default" {
    Pass "0" {
      VertexShader = vert;
      FragmentShader = frag;

      struct Attributes {
        vec3 POSITION;
        vec2 TEXCOORD_0;
      }

      struct Varyings {
        vec2 v_uv;
      }

      #include "Common/Common.glsl"

      samplerCube environmentMap;
      float face;
      float lodRoughness;
      float u_textureSize;

      Varyings vert(Attributes attr) {
        Varyings v;
        gl_Position = vec4(attr.POSITION.xzy, 1.0);
        gl_Position.y *= -1.0;
        v.v_uv = attr.TEXCOORD_0;
        return v;
      }

      vec4 RGBEToLinear(vec4 value) {
        return vec4(value.rgb * exp2(value.a * 255.0 - 128.0), 1.0);
      }

      const uint SAMPLE_COUNT = 4096u;
      const float MIN_ROUGHNESS = 0.002025; // = 0.045² (perceptualRoughness minimum squared)

      // HDR luminance compression thresholds
      const float HDR_LINEAR = 1024.0;   // no compression below this luminance
      const float HDR_MAX = 16384.0;     // compress between HDR_LINEAR and HDR_MAX

      vec4 toLinear(vec4 color) {
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
      float D_GGX(const in float a, const in float NoH) {
        float f = (a - 1.0) * ((a + 1.0) * (NoH * NoH)) + 1.0;
        return (a * a) / (PI * f * f);
      }

      // https://learnopengl.com/PBR/IBL/Specular-IBL
      // Hammersley
      float radicalInverse_VdC(uint bits) {
        bits = (bits << 16u) | (bits >> 16u);
        bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
        bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
        bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
        bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
        return float(bits) * 2.3283064365386963e-10; // / 0x100000000
      }

      vec2 hammersley(uint i, uint N) {
        return vec2(float(i)/float(N), radicalInverse_VdC(i));
      }

      // WebGL1 fallback
      float VanDerCorpus(uint n, uint base) {
        float invBase = 1.0 / float(base);
        float denom   = 1.0;
        float result  = 0.0;

        for(uint i = 0u; i < 32u; ++i) {
          if(n > 0u) {
            denom   = mod(float(n), 2.0);
            result += denom * invBase;
            invBase = invBase / 2.0;
            n       = uint(float(n) / 2.0);
          }
        }

        return result;
      }

      vec2 HammersleyNoBitOps(uint i, uint N) {
        return vec2(float(i)/float(N), VanDerCorpus(i, 2u));
      }

      vec3 importanceSampleGGX(vec2 Xi, vec3 N, float roughness) {
        float a = roughness * roughness;

        float phi = 2.0 * PI * Xi.x;
        // NOTE: (aa-1) == (a-1)(a+1) produces better fp accuracy
        float cosTheta2 = (1.0 - Xi.y) / (1.0 + (a + 1.0) * ((a - 1.0) * Xi.y));
        float cosTheta = sqrt(cosTheta2);
        float sinTheta = sqrt(1.0 - cosTheta2);

        // from spherical coordinates to cartesian coordinates
        vec3 H;
        H.x = cos(phi) * sinTheta;
        H.y = sin(phi) * sinTheta;
        H.z = cosTheta;

        // from tangent-space vector to world-space sample vector
        vec3 up        = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
        vec3 tangent   = normalize(cross(up, N));
        vec3 bitangent = cross(N, tangent);

        vec3 sampleVec = tangent * H.x + bitangent * H.y + N * H.z;
        return normalize(sampleVec);
      }

      // Pre-filtered importance sampling
      // See: Krivanek, "Real-time Shading with Filtered Importance Sampling"
      // See: Colbert, "GPU-Based Importance Sampling", GPU Gems 3
      vec3 specular(vec3 N) {
        vec3 V = N;

        float totalWeight = 0.0;
        vec3 prefilteredColor = vec3(0.0);

        // Solid angle of a texel in the base cubemap
        float omegaP = 4.0 * PI / (6.0 * u_textureSize * u_textureSize);

        for(uint i = 0u; i < SAMPLE_COUNT; ++i) {
          vec2 Xi = hammersley(i, SAMPLE_COUNT);
          vec3 H  = importanceSampleGGX(Xi, N, lodRoughness);
          vec3 L  = normalize(2.0 * dot(V, H) * H - V);

          float NdotL = max(dot(N, L), 0.0);

          if(NdotL > 0.0) {
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

      void frag(Varyings v) {
        float cx = v.v_uv.x * 2.0 - 1.0;
        float cy = v.v_uv.y * 2.0 - 1.0;

        vec3 dir = vec3(0.0);
        if (face == 0.0) { // PX
          dir = vec3( 1.0,  cy, -cx);
        }
        else if (face == 1.0) { // NX
          dir = vec3(-1.0,  cy,  cx);
        }
        else if (face == 2.0) { // PY
          dir = vec3( cx,  1.0, -cy);
        }
        else if (face == 3.0) { // NY
          dir = vec3( cx, -1.0,  cy);
        }
        else if (face == 4.0) { // PZ
          dir = vec3( cx,  cy,  1.0);
        }
        else if (face == 5.0) { // NZ
          dir = vec3(-cx,  cy, -1.0);
        }

        dir = normalize(dir);

        if (lodRoughness == 0.0) {
          gl_FragColor = vec4(toLinear(textureCube(environmentMap, dir)).rgb, 1.0);
        } else {
          vec3 integratedBRDF = specular(dir);
          gl_FragColor = vec4(integratedBRDF, 1.0);
        }
      }
    }
  }
}`;
