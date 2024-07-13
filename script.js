async function animate(canvas) {
  /** @type WebGLRenderingContext */
  const gl = canvas.getContext("webgl");

  function createShader(sourceCode, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, sourceCode);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);

      const name = type === gl.VERTEX_SHADER ? "vertex" : "fragment";
      throw `Could not compile WebGL ${name} shader. \n\n${info}`;
    }

    return shader;
  }

  function createProgram(vertexShader, fragmentShader) {
    const program = gl.createProgram();

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);

    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      throw `Could not compile WebGL program. \n\n${info}`;
    }

    return program;
  }

  function createTexture(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();

      image.onload = () => {
        const level = 0;
        const internalFormat = gl.RGBA;
        const srcFormat = gl.RGBA;
        const srcType = gl.UNSIGNED_BYTE;

        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
          gl.TEXTURE_2D,
          level,
          internalFormat,
          srcFormat,
          srcType,
          image
        );

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

        resolve(texture);
      };

      image.onerror = reject;

      image.src = url;
    });
  }

  const vertexShader = createShader(
    `
        attribute vec2 position;
        
        varying vec2 uv;
    
        void main() {
            gl_Position = vec4(position, 0, 1);
            uv = gl_Position.xy + vec2(0.5);
        }
      `,
    gl.VERTEX_SHADER
  );

  const fragmentShader = createShader(
    `
        uniform mediump vec3 color;
        uniform sampler2D frontTexture;
        uniform sampler2D backTexture;
        
        varying mediump vec2 uv;

        void main() {
            mediump vec4 xcolor = texture2D(frontTexture, uv);
            gl_FragColor = vec4(xcolor.rgb, 1.0);
        }
      `,
    gl.FRAGMENT_SHADER
  );

  const program = createProgram(vertexShader, fragmentShader);

  const positions = [-1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0];

  const indices = [0, 1, 2, 2, 3, 0];

  const planeBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, planeBuffer);

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array(indices),
    gl.STATIC_DRAW
  );

  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 2 * 4, 0);
  gl.enableVertexAttribArray(0);

  gl.useProgram(program);

  const colorLocation = gl.getUniformLocation(program, "color");

  const frontTexture = await createTexture("./front.png");
  const backTexture = await createTexture("./back.png");

  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, frontTexture)
  gl.uniform1i(gl.getUniformLocation(program, "frontTexture"), 0);
  
  gl.activeTexture(gl.TEXTURE1)
  gl.bindTexture(gl.TEXTURE_2D, backTexture)
  gl.uniform1i(gl.getUniformLocation(program, "backTexture"), 1);

  function step(timeStamp) {
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    //   gl.clearColor(0.0, (timeStamp / 1000) % 1, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.uniform3f(colorLocation, 1.0, (timeStamp / 1000) % 1, 1.0);

    const vertexCount = 6;
    const type = gl.UNSIGNED_SHORT;
    gl.drawElements(gl.TRIANGLES, vertexCount, type, 0);

    window.requestAnimationFrame(step);
  }

  window.requestAnimationFrame(step);
}
