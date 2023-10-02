precision mediump float;

uniform float u_time;
uniform vec2 u_resolution;

const float NUM_OF_STEPS = 256.0;
const float MIN_DIST_TO_SDF = 0.001;
const float MAX_DIST_TO_TRAVEL = 64.0;

const vec3 skyColor = vec3(0.0);
const vec3 globalLight = vec3(0.35);

float smoothUnion(float d1, float d2, float k) {
  float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
  return mix(d2, d1, h) - k * h * (1.0 - h);
}

float randfloat(float seed) {
  return mod(seed * 65484954.0 + 12345.0, 214658.0) * 4.6585732;
}

float sdfPlane(vec3 p, vec3 n, float h) {
  return dot(p, n) + h; // n must be normalized
}

float sdfSphere(vec3 p, vec3 c, float r) {
  vec2 uv = 2.0 * gl_FragCoord.xy / u_resolution - 1.0;
  return length(p - c) - r;
}

float map(vec3 p) {
  float radius = 0.75;

  // animation
  vec3 ctr1 = vec3(-0.9, -0.25 + sin(u_time) * 0.5, 0.0);
  vec3 ctr2 = vec3(0.9, -0.25 + sin(u_time + 1.1) * 0.5, 0.0);
  vec3 ctr3 = vec3(0, -0.25 + sin(u_time + 2.2) * 0.5, 1.2);

  float sphere1 = sdfSphere(p, ctr1, radius);
  float sphere2 = sdfSphere(p, ctr2, radius);
  float sphere3 = sdfSphere(p, ctr3, radius);
  float m = sphere1;

  // plane
  float h = 1.0;
  vec3 normal = vec3(0.0, 1.0, 0.0);
  float plane = sdfPlane(p, normal, h);

  m = min(min(sphere1, sphere3), min(sphere2, plane));

  // m = smoothUnion(m, plane, 0.5); // smooth blending (optional)

  return m;
}

vec3 hsl2rgb(float h, float s, float l) {
  float C = (1.0 - abs(2.0 * l - 1.0)) * s;
  float X = C * (1.0 - abs(mod(h * 6.0, 2.0) - 1.0));
  float m = l - 0.5 * C;

  float R, G, B;

  if (h < 1.0 / 6.0) {
    R = C;
    G = X;
    B = 0.0;
  }
  else if (h < 2.0 / 6.0) {
    R = X;
    G = C;
    B = 0.0;
  }
  else if (h < 3.0 / 6.0) {
    R = 0.0;
    G = C;
    B = X;
  }
  else if (h < 4.0 / 6.0) {
    R = 0.0;
    G = X;
    B = C;
  }
  else if (h < 5.0 / 6.0) {
    R = X;
    G = 0.0;
    B = C;
  }
  else {
    R = C;
    G = 0.0;
    B = X;
  }
  R = R + m;
  G = G + m;
  B = B + m;

  return vec3(R, G, B);
}

vec3 hsl2oklab(float h, float s, float l) {
  float M = 0.99927;
  float L_ = (l <= 0.08) ? (l * ((1.16 * l) - 0.16)) / 0.08 : pow(l, 1.0 / 3.0);
  float L = L_ * M - 0.16;
  float a = s * cos(h * 6.28318);
  float b = s * sin(h * 6.28318);
  return vec3(L, a, b);
}

vec3 oklab2rgb(float l, float a, float B) {
  float y = (l + 0.3963377774 * a + 0.2158037573 * B);
  float x = (0.0329860584 * l + 0.3375417293 * a + 0.450995514 * B);
  float z = (0.000621391 * l + 0.013905594 * a + 0.983600723 * B);

  float r = max(0.0, min(1.0, (y + 1.13983 * z)));
  float g = max(0.0, min(1.0, (y - 0.39465 * x - 0.5806 * z)));
  float b = max(0.0, min(1.0, (y + 2.03211 * x)));

  return vec3(r, g, b);
}

vec3 genColor(float n) {
  float lumStep = 1.4;
  float hueStep = 0.2;
  float initLum = 0.1;
  float initHue = 0.0;
  return oklab2rgb(
    initLum + mod(lumStep * n, 1.0),
    0.35,
    initHue + mod(hueStep * n, 1.0)
  );
  /* return hsl2oklab(
    initHue + mod(hueStep * n, 1.0),
    sin(initLum + mod(lumStep * n, 1.0)),
    sin(initLum + mod(lumStep * n, 1.0))
  ); */
  /* return hsl2rgb(
    initHue + mod(hueStep * n, 1.0),
    0.35,
    initLum + mod(lumStep * n, 1.0)
  ); */
}

float rayMarch(vec3 ro, vec3 rd, float maxDistToTravel) {
  float dist = 0.0;

  for (float i = 0.0; i < NUM_OF_STEPS; i++) {
    vec3 currentPos = ro + rd * dist;
    float distToSdf = map(currentPos);

    if (distToSdf < MIN_DIST_TO_SDF) {
      // collision
      break;
    }

    dist = dist + distToSdf;

    if (dist > maxDistToTravel) {
      // sky
      break;
    }
  }

  return dist;
}

vec3 getNormal(vec3 p) {
  vec2 d = vec2(0.01, 0.0);
  float gx = map(p + d.xyy) - map(p - d.xyy);
  float gy = map(p + d.yxy) - map(p - d.yxy);
  float gz = map(p + d.yyx) - map(p - d.yyx);
  vec3 normal = vec3(gx, gy, gz);
  return normalize(normal);
}

vec3 colorMap(float gray) {
  // 8 color limiter
  float step = 1.0 / 7.0;
  float noise = (
    fract(
      sin(
        dot(
          vec2(
            12.9898,
            78.233
          ),
          gl_FragCoord.xy
        )
      )
    ) - 0.5
  ) * step;
  float grayLimited = floor((gray + (noise * 0.26)) / step + 0.5) * step;
  // float dither = (fract(gray / step) - 0.5) * step;
  return genColor(grayLimited);
  // return vec3(grayLimited);
}

vec3 postEffect(vec3 v) {
  v *= vec3(0.21, 0.72, 0.07);
  float grayScale = dot(v, vec3(0.3, 0.59, 0.11));
  return colorMap(grayScale);
}

vec3 render(vec2 uv) {
  vec3 color = skyColor;

  vec3 ro = vec3(0.0, 0.0, -2.0); // ray origin
  vec3 rd = vec3(uv, 1.0); // ray direction

  float dist = rayMarch(ro, rd, MAX_DIST_TO_TRAVEL);

  if (dist < MAX_DIST_TO_TRAVEL) {
    // normal lighting
    vec3 p = ro + rd * dist;
    vec3 normal = getNormal(p);

    // diffuse lighting
    vec3 lightColor = vec3(1.0);
    vec3 lightSource = vec3(sin(u_time) * 2.0, 2.5, cos(u_time) * 2.0);
    float diffuseStrength = max(0.0, dot(normalize(lightSource), normal));
    vec3 diffuse = lightColor * diffuseStrength;

    // specular lighting
    vec3 viewSource = normalize(ro);
    vec3 reflectSource = normalize(reflect(-lightSource, normal));
    float specularStrength = max(0.0, dot(viewSource, reflectSource));
    specularStrength = pow(specularStrength, 64.0);
    vec3 specular = specularStrength * lightColor;

    color = vec3(diffuse * 0.75 + specular * 0.25); // / (dist * 1.5);

    // shadows
    // update rays
    vec3 lightDirection = normalize(lightSource);
    float distToLightSource = length(lightSource - p);
    ro = p + normal * 0.1;
    rd = lightDirection;

    // ray march based on new ro + rd
    float dist = rayMarch(ro, rd, distToLightSource);
    if (dist < distToLightSource) {
      color = color * vec3(0.25);
    }

    // gamma correction
    color = pow(color + globalLight, vec3(1.0 / 2.2)); //  / (dist * 3.9)
  }
  return postEffect(color); // comment to ignore post-effect
  return color;
}

void main() {
  vec2 uv = 2.0 * gl_FragCoord.xy / u_resolution - 1.0;
  // properly center the shader in full screen mode
  // uv = (2.0 * gl_FragCoord.xy - u_resolution) / u_resolution.y;
  // Camera movement
  uv.x += sin(u_time) * 0.2;
  uv.y += cos(u_time) * 0.2;
  vec3 color = render(uv);
  gl_FragColor = vec4(color, 1.0);
}
