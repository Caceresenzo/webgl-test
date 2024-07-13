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
        
        varying vec2 pass_uv;
    
        void main() {
            gl_Position = vec4(position, 0, 1);
            pass_uv = gl_Position.xy + vec2(0.5);
        }
      `,
    gl.VERTEX_SHADER
  );

  const fragmentShader = createShader(
    `
      precision mediump float;

      uniform vec2 resolution;
      uniform vec3 color;
      uniform vec2 mousePosition;
      uniform float time;
      uniform sampler2D frontTexture;
      uniform sampler2D backTexture;
      
      varying vec2 pass_uv;

      #define timeScale 			time * 0.001
      #define fireMovement 		vec2(-0.01, -0.5)
      #define distortionMovement	vec2(-0.01, -0.3)
      #define normalStrength		900000.0
      #define distortionStrength	100
      vec2 hash( vec2 p ) {
        p = vec2( dot(p,vec2(127.1,311.7)),
              dot(p,vec2(269.5,183.3)) );

        return -1.0 + 2.0*fract(sin(p) * 43758.5453123);
      }
      float noise( in vec2 p ) {
          const float K1 = 0.366025404; // (sqrt(3)-1)/2;
          const float K2 = 0.211324865; // (3-sqrt(3))/6;

        vec2 i = floor( p + (p.x+p.y) * K1 );

          vec2 a = p - i + (i.x+i.y) * K2;
          vec2 o = step(a.yx,a.xy);
          vec2 b = a - o + K2;
        vec2 c = a - 1.0 + 2.0*K2;

          vec3 h = max( 0.5-vec3(dot(a,a), dot(b,b), dot(c,c) ), 0.0 );

        vec3 n = h*h*h*h*vec3( dot(a,hash(i+0.0)), dot(b,hash(i+o)), dot(c,hash(i+1.0)));

          return dot( n, vec3(70.0) );
      }
      float fbm ( in vec2 p ) {
          float f = 0.0;
          mat2 m = mat2( 1.6,  1.2, -1.2,  1.6 );
          f  = 0.5000*noise(p); p = m*p;
          f += 0.2500*noise(p); p = m*p;
          f += 0.1250*noise(p); p = m*p;
          f += 0.0625*noise(p); p = m*p;
          f = 0.5 + 0.5 * f;
          return f;
      }
      vec3 bumpMap(vec2 uv) {
          vec2 s = 1. / resolution.xy;
          float p =  fbm(uv);
          float h1 = fbm(uv + s * vec2(1., 0));
          float v1 = fbm(uv + s * vec2(0, 1.));

          vec2 xy = (p - vec2(h1, v1)) * normalStrength;
          return vec3(xy + .5, 1.);
      }

        void main() {
          vec2 uv = gl_FragCoord.xy;
          vec4 theColor;
          
          vec3 normal = bumpMap(uv * vec2(1.0, 0.3) + distortionMovement * timeScale);

          float dist = distance(uv, mousePosition);
          if (dist > 100.0 || (normal.r > 0.8 && normal.g > 0.8 && normal.b > 0.8)) {
              theColor = texture2D(frontTexture, pass_uv);
          } else {
              theColor = texture2D(backTexture, pass_uv);
          }

          gl_FragColor = vec4(theColor.xyz, 1.0);
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
  const mousePositionLocation = gl.getUniformLocation(program, "mousePosition");
  const resolutionLocation = gl.getUniformLocation(program, "resolution");
  const timeLocation = gl.getUniformLocation(program, "time");

  const frontTexture = await createTexture("./front.png");
  const backTexture = await createTexture("./back.png");

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, frontTexture);
  gl.uniform1i(gl.getUniformLocation(program, "frontTexture"), 0);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, backTexture);
  gl.uniform1i(gl.getUniformLocation(program, "backTexture"), 1);

  let mousePosition = [0, 0];
  document.onmousemove = (event) => {
    const x = event.clientX / window.innerWidth;
    const y = 1 - (event.clientY / window.innerHeight);

    // mousePosition = [x, y]
    mousePosition = [event.clientX, window.innerHeight - event.clientY]
  };

  function step(timeStamp) {
    // console.log({ drawingBufferWidth: gl.drawingBufferWidth, drawingBufferHeight: gl.drawingBufferHeight })
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.uniform3f(colorLocation, 1.0, (timeStamp / 1000) % 1, 1.0);
    gl.uniform2f(mousePositionLocation, ...mousePosition);
    gl.uniform2f(resolutionLocation, window.innerWidth, window.innerHeight);
    gl.uniform1f(timeLocation, timeStamp);

    const vertexCount = 6;
    const type = gl.UNSIGNED_SHORT;
    gl.drawElements(gl.TRIANGLES, vertexCount, type, 0);

    window.requestAnimationFrame(step);
  }

  window.requestAnimationFrame(step);
}
