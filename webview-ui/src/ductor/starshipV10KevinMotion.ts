export interface KevinPixelMotion {
  readonly width: 540;
  readonly height: 230;
  readonly restDiffPixels: 0;
  render(timeSec: number, working: boolean): HTMLCanvasElement;
}

const WIDTH = 540;
const HEIGHT = 230;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timeout = setTimeout(() => {
      image.onload = null;
      image.onerror = null;
      reject(new Error(`Kevin V10 PNG timed out: ${url}`));
    }, 15000);
    image.onload = () => {
      clearTimeout(timeout);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timeout);
      reject(new Error(`Kevin V10 PNG failed: ${url}`));
    };
    image.src = url;
  });
}

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Kevin pixel warp could not create WebGL shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? 'unknown shader error';
    gl.deleteShader(shader);
    throw new Error(`Kevin pixel warp shader failed: ${message}`);
  }
  return shader;
}

function createProgram(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error('Kevin pixel warp could not create WebGL program');
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? 'unknown link error';
    gl.deleteProgram(program);
    throw new Error(`Kevin pixel warp program failed: ${message}`);
  }
  return program;
}

function makeStaticCanvas(image: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Kevin source canvas requires a 2D context');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, 0);
  return canvas;
}

/**
 * Animate the authored star-map surface by remapping its own pixels.
 *
 * Nothing is painted on top of the PNG and no planet is cut out as a sprite.
 * The shader samples the original 540×230 texture through an elliptical-polar
 * flow field measured from the actual table. Thus planets, orbit lines, glow,
 * particles and their local reflections move together as one surface.
 */
export async function loadKevinPixelMotion(assetUrl: string): Promise<KevinPixelMotion> {
  const image = await loadImage(assetUrl);
  if (image.naturalWidth !== WIDTH || image.naturalHeight !== HEIGHT) {
    throw new Error(
      `Kevin V10 source must be ${WIDTH}x${HEIGHT}, got ${image.naturalWidth}x${image.naturalHeight}`,
    );
  }

  const staticCanvas = makeStaticCanvas(image);
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: false,
    depth: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: true,
  });

  if (!gl) {
    return {
      width: WIDTH,
      height: HEIGHT,
      restDiffPixels: 0,
      render(): HTMLCanvasElement {
        return staticCanvas;
      },
    };
  }

  const vertexSource = `
    attribute vec2 a_position;
    varying vec2 v_uv;

    void main() {
      v_uv = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fragmentSource = `
    precision highp float;

    uniform sampler2D u_texture;
    uniform vec2 u_size;
    uniform float u_time;
    uniform float u_speed;
    varying vec2 v_uv;

    const float CENTER_X = 308.7;
    const float CENTER_Y = 54.2;
    const float Y_SCALE = 0.32;
    const float RADIUS = 150.0;

    float smoothGate(float edge0, float edge1, float value) {
      float t = clamp((value - edge0) / (edge1 - edge0), 0.0, 1.0);
      return t * t * (3.0 - 2.0 * t);
    }

    void main() {
      vec2 pixel = vec2(v_uv.x * u_size.x, (1.0 - v_uv.y) * u_size.y);
      vec2 relative = vec2(pixel.x - CENTER_X, (pixel.y - CENTER_Y) / Y_SCALE);
      float radius = length(relative);
      float theta = atan(relative.y, relative.x);

      // Physical rim stays fixed; the central sun is pinned.
      float edgeGate = 1.0 - smoothGate(RADIUS - 12.0, RADIUS, radius);
      float centerGate = smoothGate(18.0, 42.0, radius);
      float gate = edgeGate * centerGate;

      // Differential rotation makes the authored map behave like one living
      // surface rather than independent stickers.
      float radiusNorm = clamp(radius / RADIUS, 0.0, 1.0);
      float angularSpeed = u_speed * (1.20 - radiusNorm * 0.72);
      float sourceTheta = theta - angularSpeed * u_time * gate;

      vec2 warpedPixel = vec2(
        CENTER_X + cos(sourceTheta) * radius,
        CENTER_Y + sin(sourceTheta) * radius * Y_SCALE
      );

      vec2 originalUv = vec2(pixel.x / u_size.x, 1.0 - pixel.y / u_size.y);
      vec2 warpedUv = vec2(
        warpedPixel.x / u_size.x,
        1.0 - warpedPixel.y / u_size.y
      );

      vec4 originalColor = texture2D(u_texture, originalUv);
      vec4 warpedColor = texture2D(u_texture, warpedUv);

      // The authored PNG silhouette is immutable. Never let a warped opaque
      // texel spill into a source-transparent pixel, which would turn the
      // 540x230 crop into a visible rectangular overlay.
      float originalValid = step(0.01, originalColor.a);
      float warpedValid = step(0.01, warpedColor.a);
      float effectiveGate = gate * originalValid * warpedValid;
      vec3 color = mix(originalColor.rgb, warpedColor.rgb, effectiveGate);

      // Preserve the exact authored alpha at this pixel.
      gl_FragColor = vec4(color, originalColor.a);
    }
  `;

  const program = createProgram(gl, vertexSource, fragmentSource);
  gl.useProgram(program);

  const position = gl.getAttribLocation(program, 'a_position');
  const buffer = gl.createBuffer();
  if (!buffer) throw new Error('Kevin pixel warp could not create vertex buffer');
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const texture = gl.createTexture();
  if (!texture) throw new Error('Kevin pixel warp could not create texture');
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    image,
  );

  const textureLocation = gl.getUniformLocation(program, 'u_texture');
  const sizeLocation = gl.getUniformLocation(program, 'u_size');
  const timeLocation = gl.getUniformLocation(program, 'u_time');
  const speedLocation = gl.getUniformLocation(program, 'u_speed');
  gl.uniform1i(textureLocation, 0);
  gl.uniform2f(sizeLocation, WIDTH, HEIGHT);
  gl.viewport(0, 0, WIDTH, HEIGHT);
  gl.disable(gl.BLEND);

  return {
    width: WIDTH,
    height: HEIGHT,
    restDiffPixels: 0,
    render(timeSec: number, working: boolean): HTMLCanvasElement {
      if (timeSec <= 0.0001) return staticCanvas;
      gl.useProgram(program);
      gl.uniform1f(timeLocation, timeSec);
      gl.uniform1f(speedLocation, working ? 0.032 : 0.018);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      return canvas;
    },
  };
}
