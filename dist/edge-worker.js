// deploy/worker/src/core/sha224.ts
var K = new Uint32Array([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
var rotr = (value, shift) => value >>> shift | value << 32 - shift;
function sha224Hex(text3) {
  const message = new TextEncoder().encode(text3);
  const bitLength = BigInt(message.length) * 8n;
  const paddedLength = Math.ceil((message.length + 1 + 8) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(message);
  padded[message.length] = 128;
  for (let i = 0; i < 8; i += 1) {
    padded[paddedLength - 1 - i] = Number(bitLength >> BigInt(i * 8) & 0xffn);
  }
  const h = new Uint32Array([
    3238371032,
    914150663,
    812702999,
    4144912697,
    4290775857,
    1750603025,
    1694076839,
    3204075428
  ]);
  const w = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      const j = offset + i * 4;
      w[i] = (padded[j] << 24 | padded[j + 1] << 16 | padded[j + 2] << 8 | padded[j + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i += 1) {
      const x = w[i - 15];
      const y = w[i - 2];
      const s0 = (rotr(x, 7) ^ rotr(x, 18) ^ x >>> 3) >>> 0;
      const s1 = (rotr(y, 17) ^ rotr(y, 19) ^ y >>> 10) >>> 0;
      w[i] = w[i - 16] + s0 + w[i - 7] + s1 >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i += 1) {
      const s1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const ch = (e & f ^ ~e & g) >>> 0;
      const t1 = hh + s1 + ch + K[i] + w[i] >>> 0;
      const s0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const maj = (a & b ^ a & c ^ b & c) >>> 0;
      const t2 = s0 + maj >>> 0;
      hh = g;
      g = f;
      f = e;
      e = d + t1 >>> 0;
      d = c;
      c = b;
      b = a;
      a = t1 + t2 >>> 0;
    }
    h[0] = h[0] + a >>> 0;
    h[1] = h[1] + b >>> 0;
    h[2] = h[2] + c >>> 0;
    h[3] = h[3] + d >>> 0;
    h[4] = h[4] + e >>> 0;
    h[5] = h[5] + f >>> 0;
    h[6] = h[6] + g >>> 0;
    h[7] = h[7] + hh >>> 0;
  }
  return [...h.slice(0, 7)].map((value) => value.toString(16).padStart(8, "0")).join("");
}

// deploy/worker/src/config/store.ts
var CONFIG_KEY = "protocol:config:v1";
function randomHex(bytes) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return [...data].map((value) => value.toString(16).padStart(2, "0")).join("");
}
function isConfig(value) {
  if (!value || typeof value !== "object") return false;
  const c = value;
  return c.schemaVersion === 1 && typeof c.createdAt === "string" && typeof c.vless?.uuid === "string" && typeof c.vless?.path === "string" && typeof c.vless?.enabled === "boolean" && typeof c.trojan?.password === "string" && typeof c.trojan?.passwordHash === "string" && typeof c.trojan?.path === "string" && typeof c.trojan?.enabled === "boolean" && c.xhttp?.mode === "stream-one" && typeof c.xhttp?.path === "string" && typeof c.xhttp?.enabled === "boolean" && typeof c.subscription?.token === "string" && typeof c.subscription?.path === "string";
}
async function loadProtocolConfig(env) {
  const raw = await env.C.get(CONFIG_KEY);
  if (!raw) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("invalid-protocol-config");
  }
  if (!isConfig(parsed)) throw new Error("invalid-protocol-config");
  return parsed;
}
async function ensureProtocolConfig(env) {
  const existing = await loadProtocolConfig(env);
  if (existing) return existing;
  const password = randomHex(24);
  const created = {
    schemaVersion: 1,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    vless: { enabled: true, uuid: crypto.randomUUID(), path: "/vless" },
    trojan: { enabled: true, password, passwordHash: sha224Hex(password), path: "/trojan" },
    xhttp: { enabled: true, path: "/xhttp", mode: "stream-one" },
    subscription: { token: randomHex(24), path: "/sub" }
  };
  await env.C.put(CONFIG_KEY, JSON.stringify(created));
  return created;
}
function publicProtocolStatus(config) {
  return {
    schemaVersion: 1,
    vless: { enabled: config.vless.enabled, path: config.vless.path },
    trojan: { enabled: config.trojan.enabled, path: config.trojan.path },
    xhttp: { enabled: config.xhttp.enabled, path: config.xhttp.path, mode: config.xhttp.mode }
  };
}

// deploy/worker/src/observability/xhttpDiagnostics.ts
var KV_KEY = "diag:xhttp:v1";
var DEFAULT_FLUSH_INTERVAL_MS = 5 * 60 * 1e3;
function dayOf(timestampMs) {
  return new Date(timestampMs).toISOString().slice(0, 10);
}
function isRecord(value) {
  if (!value || typeof value !== "object") return false;
  const record = value;
  return typeof record.day === "string" && typeof record.attempts === "number" && typeof record.success === "number" && (record.lastStatus === null || typeof record.lastStatus === "number") && (record.lastAt === null || typeof record.lastAt === "string");
}
function createXhttpDiagnostics(kv, options = {}) {
  const now = options.now ?? Date.now;
  const flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
  const startedAtMs = now();
  let day = dayOf(startedAtMs);
  let attempts = 0;
  let success = 0;
  let lastStatus = null;
  let lastAt = null;
  let lastFlushAtMs = Number.NEGATIVE_INFINITY;
  let flushedAttempts = 0;
  function rotateDayIfNeeded() {
    const currentDay = dayOf(now());
    if (currentDay === day) return;
    day = currentDay;
    attempts = 0;
    success = 0;
    lastStatus = null;
    lastAt = null;
    flushedAttempts = 0;
  }
  function localRecord() {
    return { day, attempts, success, lastStatus, lastAt };
  }
  async function readPersisted() {
    try {
      const raw = await kv.get(KV_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return {
    record(status) {
      rotateDayIfNeeded();
      attempts += 1;
      if (status === 200) success += 1;
      lastStatus = status;
      lastAt = new Date(now()).toISOString();
    },
    async flushIfNeeded() {
      if (attempts === flushedAttempts) return;
      const currentMs = now();
      if (currentMs - lastFlushAtMs < flushIntervalMs) return;
      lastFlushAtMs = currentMs;
      flushedAttempts = attempts;
      try {
        await kv.put(KV_KEY, JSON.stringify(localRecord()));
      } catch {
      }
    },
    async snapshot() {
      const local = localRecord();
      const persisted = await readPersisted();
      if (!persisted) return local;
      if (persisted.day !== local.day) {
        return persisted.day > local.day ? persisted : local;
      }
      const persistedFresher = (persisted.lastAt ?? "") > (local.lastAt ?? "") || persisted.attempts > local.attempts;
      return persistedFresher ? persisted : local;
    }
  };
}

// node_modules/.pnpm/uqr@0.1.3/node_modules/uqr/dist/index.mjs
var QrCodeDataType = /* @__PURE__ */ ((QrCodeDataType2) => {
  QrCodeDataType2[QrCodeDataType2["Border"] = -1] = "Border";
  QrCodeDataType2[QrCodeDataType2["Data"] = 0] = "Data";
  QrCodeDataType2[QrCodeDataType2["Function"] = 1] = "Function";
  QrCodeDataType2[QrCodeDataType2["Position"] = 2] = "Position";
  QrCodeDataType2[QrCodeDataType2["Timing"] = 3] = "Timing";
  QrCodeDataType2[QrCodeDataType2["Alignment"] = 4] = "Alignment";
  return QrCodeDataType2;
})(QrCodeDataType || {});
var LOW = [0, 1];
var MEDIUM = [1, 0];
var QUARTILE = [2, 3];
var HIGH = [3, 2];
var EccMap = {
  L: LOW,
  M: MEDIUM,
  Q: QUARTILE,
  H: HIGH
};
var NUMERIC_REGEX = /^\d*$/;
var ALPHANUMERIC_REGEX = /^[A-Z0-9 $%*+./:-]*$/;
var ALPHANUMERIC_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
var MIN_VERSION = 1;
var MAX_VERSION = 40;
var PENALTY_N1 = 3;
var PENALTY_N2 = 3;
var PENALTY_N3 = 40;
var PENALTY_N4 = 10;
var ECC_CODEWORDS_PER_BLOCK = [
  // Version: (note that index 0 is for padding, and is set to an illegal value)
  // 0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40    Error correction level
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  // Low
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  // Medium
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  // Quartile
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
  // High
];
var NUM_ERROR_CORRECTION_BLOCKS = [
  // Version: (note that index 0 is for padding, and is set to an illegal value)
  // 0, 1, 2, 3, 4, 5, 6, 7, 8, 9,10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40    Error correction level
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  // Low
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  // Medium
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  // Quartile
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
  // High
];
var QrCode = class {
  /* -- Constructor (low level) and fields -- */
  // Creates a new QR Code with the given version number,
  // error correction level, data codeword bytes, and mask number.
  // This is a low-level API that most users should not use directly.
  // A mid-level API is the encodeSegments() function.
  constructor(version, ecc, dataCodewords, msk) {
    this.version = version;
    this.ecc = ecc;
    if (version < MIN_VERSION || version > MAX_VERSION)
      throw new RangeError("Version value out of range");
    if (msk < -1 || msk > 7)
      throw new RangeError("Mask value out of range");
    this.size = version * 4 + 17;
    const row = Array.from({ length: this.size }).fill(false);
    for (let i = 0; i < this.size; i++) {
      this.modules.push(row.slice());
      this.types.push(row.map(() => 0));
    }
    this.drawFunctionPatterns();
    const allCodewords = this.addEccAndInterleave(dataCodewords);
    this.drawCodewords(allCodewords);
    if (msk === -1) {
      let minPenalty = 1e9;
      for (let i = 0; i < 8; i++) {
        this.applyMask(i);
        this.drawFormatBits(i);
        const penalty = this.getPenaltyScore();
        if (penalty < minPenalty) {
          msk = i;
          minPenalty = penalty;
        }
        this.applyMask(i);
      }
    }
    this.mask = msk;
    this.applyMask(msk);
    this.drawFormatBits(msk);
  }
  /* -- Fields -- */
  // The width and height of this QR Code, measured in modules, between
  // 21 and 177 (inclusive). This is equal to version * 4 + 17.
  size;
  // The index of the mask pattern used in this QR Code, which is between 0 and 7 (inclusive).
  // Even if a QR Code is created with automatic masking requested (mask = -1),
  // the resulting object still has a mask value between 0 and 7.
  mask;
  // The modules of this QR Code (false = light, true = dark).
  // Immutable after constructor finishes. Accessed through getModule().
  modules = [];
  types = [];
  /* -- Accessor methods -- */
  // Returns the color of the module (pixel) at the given coordinates, which is false
  // for light or true for dark. The top left corner has the coordinates (x=0, y=0).
  // If the given coordinates are out of bounds, then false (light) is returned.
  getModule(x, y) {
    return x >= 0 && x < this.size && y >= 0 && y < this.size && this.modules[y][x];
  }
  /* -- Private helper methods for constructor: Drawing function modules -- */
  // Reads this object's version field, and draws and marks all function modules.
  drawFunctionPatterns() {
    for (let i = 0; i < this.size; i++) {
      this.setFunctionModule(6, i, i % 2 === 0, QrCodeDataType.Timing);
      this.setFunctionModule(i, 6, i % 2 === 0, QrCodeDataType.Timing);
    }
    this.drawFinderPattern(3, 3);
    this.drawFinderPattern(this.size - 4, 3);
    this.drawFinderPattern(3, this.size - 4);
    const alignPatPos = this.getAlignmentPatternPositions();
    const numAlign = alignPatPos.length;
    for (let i = 0; i < numAlign; i++) {
      for (let j = 0; j < numAlign; j++) {
        if (!(i === 0 && j === 0 || i === 0 && j === numAlign - 1 || i === numAlign - 1 && j === 0))
          this.drawAlignmentPattern(alignPatPos[i], alignPatPos[j]);
      }
    }
    this.drawFormatBits(0);
    this.drawVersion();
  }
  // Draws two copies of the format bits (with its own error correction code)
  // based on the given mask and this object's error correction level field.
  drawFormatBits(mask) {
    const data = this.ecc[1] << 3 | mask;
    let rem = data;
    for (let i = 0; i < 10; i++)
      rem = rem << 1 ^ (rem >>> 9) * 1335;
    const bits = (data << 10 | rem) ^ 21522;
    for (let i = 0; i <= 5; i++)
      this.setFunctionModule(8, i, getBit(bits, i));
    this.setFunctionModule(8, 7, getBit(bits, 6));
    this.setFunctionModule(8, 8, getBit(bits, 7));
    this.setFunctionModule(7, 8, getBit(bits, 8));
    for (let i = 9; i < 15; i++)
      this.setFunctionModule(14 - i, 8, getBit(bits, i));
    for (let i = 0; i < 8; i++)
      this.setFunctionModule(this.size - 1 - i, 8, getBit(bits, i));
    for (let i = 8; i < 15; i++)
      this.setFunctionModule(8, this.size - 15 + i, getBit(bits, i));
    this.setFunctionModule(8, this.size - 8, true);
  }
  // Draws two copies of the version bits (with its own error correction code),
  // based on this object's version field, iff 7 <= version <= 40.
  drawVersion() {
    if (this.version < 7)
      return;
    let rem = this.version;
    for (let i = 0; i < 12; i++)
      rem = rem << 1 ^ (rem >>> 11) * 7973;
    const bits = this.version << 12 | rem;
    for (let i = 0; i < 18; i++) {
      const color = getBit(bits, i);
      const a = this.size - 11 + i % 3;
      const b = Math.floor(i / 3);
      this.setFunctionModule(a, b, color);
      this.setFunctionModule(b, a, color);
    }
  }
  // Draws a 9*9 finder pattern including the border separator,
  // with the center module at (x, y). Modules can be out of bounds.
  drawFinderPattern(x, y) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && xx < this.size && yy >= 0 && yy < this.size)
          this.setFunctionModule(xx, yy, dist !== 2 && dist !== 4, QrCodeDataType.Position);
      }
    }
  }
  // Draws a 5*5 alignment pattern, with the center module
  // at (x, y). All modules must be in bounds.
  drawAlignmentPattern(x, y) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        this.setFunctionModule(
          x + dx,
          y + dy,
          Math.max(Math.abs(dx), Math.abs(dy)) !== 1,
          QrCodeDataType.Alignment
        );
      }
    }
  }
  // Sets the color of a module and marks it as a function module.
  // Only used by the constructor. Coordinates must be in bounds.
  setFunctionModule(x, y, isDark, type = QrCodeDataType.Function) {
    this.modules[y][x] = isDark;
    this.types[y][x] = type;
  }
  /* -- Private helper methods for constructor: Codewords and masking -- */
  // Returns a new byte string representing the given data with the appropriate error correction
  // codewords appended to it, based on this object's version and error correction level.
  addEccAndInterleave(data) {
    const ver = this.version;
    const ecl = this.ecc;
    if (data.length !== getNumDataCodewords(ver, ecl))
      throw new RangeError("Invalid argument");
    const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ecl[0]][ver];
    const blockEccLen = ECC_CODEWORDS_PER_BLOCK[ecl[0]][ver];
    const rawCodewords = Math.floor(getNumRawDataModules(ver) / 8);
    const numShortBlocks = numBlocks - rawCodewords % numBlocks;
    const shortBlockLen = Math.floor(rawCodewords / numBlocks);
    const blocks = [];
    const rsDiv = reedSolomonComputeDivisor(blockEccLen);
    for (let i = 0, k = 0; i < numBlocks; i++) {
      const dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
      k += dat.length;
      const ecc = reedSolomonComputeRemainder(dat, rsDiv);
      if (i < numShortBlocks)
        dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    const result = [];
    for (let i = 0; i < blocks[0].length; i++) {
      blocks.forEach((block, j) => {
        if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks)
          result.push(block[i]);
      });
    }
    return result;
  }
  // Draws the given sequence of 8-bit codewords (data and error correction) onto the entire
  // data area of this QR Code. Function modules need to be marked off before this is called.
  drawCodewords(data) {
    if (data.length !== Math.floor(getNumRawDataModules(this.version) / 8))
      throw new RangeError("Invalid argument");
    let i = 0;
    for (let right = this.size - 1; right >= 1; right -= 2) {
      if (right === 6)
        right = 5;
      for (let vert = 0; vert < this.size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = (right + 1 & 2) === 0;
          const y = upward ? this.size - 1 - vert : vert;
          if (!this.types[y][x] && i < data.length * 8) {
            this.modules[y][x] = getBit(data[i >>> 3], 7 - (i & 7));
            i++;
          }
        }
      }
    }
  }
  // XORs the codeword modules in this QR Code with the given mask pattern.
  // The function modules must be marked and the codeword bits must be drawn
  // before masking. Due to the arithmetic of XOR, calling applyMask() with
  // the same mask value a second time will undo the mask. A final well-formed
  // QR Code needs exactly one (not zero, two, etc.) mask applied.
  applyMask(mask) {
    if (mask < 0 || mask > 7)
      throw new RangeError("Mask value out of range");
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        let invert;
        switch (mask) {
          case 0:
            invert = (x + y) % 2 === 0;
            break;
          case 1:
            invert = y % 2 === 0;
            break;
          case 2:
            invert = x % 3 === 0;
            break;
          case 3:
            invert = (x + y) % 3 === 0;
            break;
          case 4:
            invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
            break;
          case 5:
            invert = x * y % 2 + x * y % 3 === 0;
            break;
          case 6:
            invert = (x * y % 2 + x * y % 3) % 2 === 0;
            break;
          case 7:
            invert = ((x + y) % 2 + x * y % 3) % 2 === 0;
            break;
          default:
            throw new Error("Unreachable");
        }
        if (!this.types[y][x] && invert)
          this.modules[y][x] = !this.modules[y][x];
      }
    }
  }
  // Calculates and returns the penalty score based on state of this QR Code's current modules.
  // This is used by the automatic mask choice algorithm to find the mask pattern that yields the lowest score.
  getPenaltyScore() {
    let result = 0;
    for (let y = 0; y < this.size; y++) {
      let runColor = false;
      let runX = 0;
      const runHistory = [0, 0, 0, 0, 0, 0, 0];
      for (let x = 0; x < this.size; x++) {
        if (this.modules[y][x] === runColor) {
          runX++;
          if (runX === 5)
            result += PENALTY_N1;
          else if (runX > 5)
            result++;
        } else {
          this.finderPenaltyAddHistory(runX, runHistory);
          if (!runColor)
            result += this.finderPenaltyCountPatterns(runHistory) * PENALTY_N3;
          runColor = this.modules[y][x];
          runX = 1;
        }
      }
      result += this.finderPenaltyTerminateAndCount(runColor, runX, runHistory) * PENALTY_N3;
    }
    for (let x = 0; x < this.size; x++) {
      let runColor = false;
      let runY = 0;
      const runHistory = [0, 0, 0, 0, 0, 0, 0];
      for (let y = 0; y < this.size; y++) {
        if (this.modules[y][x] === runColor) {
          runY++;
          if (runY === 5)
            result += PENALTY_N1;
          else if (runY > 5)
            result++;
        } else {
          this.finderPenaltyAddHistory(runY, runHistory);
          if (!runColor)
            result += this.finderPenaltyCountPatterns(runHistory) * PENALTY_N3;
          runColor = this.modules[y][x];
          runY = 1;
        }
      }
      result += this.finderPenaltyTerminateAndCount(runColor, runY, runHistory) * PENALTY_N3;
    }
    for (let y = 0; y < this.size - 1; y++) {
      for (let x = 0; x < this.size - 1; x++) {
        const color = this.modules[y][x];
        if (color === this.modules[y][x + 1] && color === this.modules[y + 1][x] && color === this.modules[y + 1][x + 1]) {
          result += PENALTY_N2;
        }
      }
    }
    let dark = 0;
    for (const row of this.modules)
      dark = row.reduce((sum, color) => sum + (color ? 1 : 0), dark);
    const total = this.size * this.size;
    const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
    result += k * PENALTY_N4;
    return result;
  }
  /* -- Private helper functions -- */
  // Returns an ascending list of positions of alignment patterns for this version number.
  // Each position is in the range [0,177), and are used on both the x and y axes.
  // This could be implemented as lookup table of 40 variable-length lists of integers.
  getAlignmentPatternPositions() {
    if (this.version === 1) {
      return [];
    } else {
      const numAlign = Math.floor(this.version / 7) + 2;
      const step = this.version === 32 ? 26 : Math.ceil((this.version * 4 + 4) / (numAlign * 2 - 2)) * 2;
      const result = [6];
      for (let pos = this.size - 7; result.length < numAlign; pos -= step)
        result.splice(1, 0, pos);
      return result;
    }
  }
  // Can only be called immediately after a light run is added, and
  // returns either 0, 1, or 2. A helper function for getPenaltyScore().
  finderPenaltyCountPatterns(runHistory) {
    const n = runHistory[1];
    const core = n > 0 && runHistory[2] === n && runHistory[3] === n * 3 && runHistory[4] === n && runHistory[5] === n;
    return (core && runHistory[0] >= n * 4 && runHistory[6] >= n ? 1 : 0) + (core && runHistory[6] >= n * 4 && runHistory[0] >= n ? 1 : 0);
  }
  // Must be called at the end of a line (row or column) of modules. A helper function for getPenaltyScore().
  finderPenaltyTerminateAndCount(currentRunColor, currentRunLength, runHistory) {
    if (currentRunColor) {
      this.finderPenaltyAddHistory(currentRunLength, runHistory);
      currentRunLength = 0;
    }
    currentRunLength += this.size;
    this.finderPenaltyAddHistory(currentRunLength, runHistory);
    return this.finderPenaltyCountPatterns(runHistory);
  }
  // Pushes the given value to the front and drops the last value. A helper function for getPenaltyScore().
  finderPenaltyAddHistory(currentRunLength, runHistory) {
    if (runHistory[0] === 0)
      currentRunLength += this.size;
    runHistory.pop();
    runHistory.unshift(currentRunLength);
  }
};
function appendBits(val, len, bb) {
  if (len < 0 || len > 31 || val >>> len !== 0)
    throw new RangeError("Value out of range");
  for (let i = len - 1; i >= 0; i--)
    bb.push(val >>> i & 1);
}
function getBit(x, i) {
  return (x >>> i & 1) !== 0;
}
var QrSegment = class {
  // Creates a new QR Code segment with the given attributes and data.
  // The character count (numChars) must agree with the mode and the bit buffer length,
  // but the constraint isn't checked. The given bit buffer is cloned and stored.
  constructor(mode, numChars, bitData) {
    this.mode = mode;
    this.numChars = numChars;
    this.bitData = bitData;
    if (numChars < 0)
      throw new RangeError("Invalid argument");
    this.bitData = bitData.slice();
  }
  /* -- Methods -- */
  // Returns a new copy of the data bits of this segment.
  getData() {
    return this.bitData.slice();
  }
};
var MODE_NUMERIC = [1, 10, 12, 14];
var MODE_ALPHANUMERIC = [2, 9, 11, 13];
var MODE_BYTE = [4, 8, 16, 16];
function numCharCountBits(mode, ver) {
  return mode[Math.floor((ver + 7) / 17) + 1];
}
function makeBytes(data) {
  const bb = [];
  for (const b of data)
    appendBits(b, 8, bb);
  return new QrSegment(MODE_BYTE, data.length, bb);
}
function makeNumeric(digits) {
  if (!isNumeric(digits))
    throw new RangeError("String contains non-numeric characters");
  const bb = [];
  for (let i = 0; i < digits.length; ) {
    const n = Math.min(digits.length - i, 3);
    appendBits(Number.parseInt(digits.substring(i, i + n), 10), n * 3 + 1, bb);
    i += n;
  }
  return new QrSegment(MODE_NUMERIC, digits.length, bb);
}
function makeAlphanumeric(text3) {
  if (!isAlphanumeric(text3))
    throw new RangeError("String contains unencodable characters in alphanumeric mode");
  const bb = [];
  let i;
  for (i = 0; i + 2 <= text3.length; i += 2) {
    let temp = ALPHANUMERIC_CHARSET.indexOf(text3.charAt(i)) * 45;
    temp += ALPHANUMERIC_CHARSET.indexOf(text3.charAt(i + 1));
    appendBits(temp, 11, bb);
  }
  if (i < text3.length)
    appendBits(ALPHANUMERIC_CHARSET.indexOf(text3.charAt(i)), 6, bb);
  return new QrSegment(MODE_ALPHANUMERIC, text3.length, bb);
}
function makeSegments(text3) {
  if (text3 === "")
    return [];
  else if (isNumeric(text3))
    return [makeNumeric(text3)];
  else if (isAlphanumeric(text3))
    return [makeAlphanumeric(text3)];
  else
    return [makeBytes(toUtf8ByteArray(text3))];
}
function isNumeric(text3) {
  return NUMERIC_REGEX.test(text3);
}
function isAlphanumeric(text3) {
  return ALPHANUMERIC_REGEX.test(text3);
}
function getTotalBits(segs, version) {
  let result = 0;
  for (const seg of segs) {
    const ccbits = numCharCountBits(seg.mode, version);
    if (seg.numChars >= 1 << ccbits)
      return Number.POSITIVE_INFINITY;
    result += 4 + ccbits + seg.bitData.length;
  }
  return result;
}
function toUtf8ByteArray(str) {
  str = encodeURI(str);
  const result = [];
  for (let i = 0; i < str.length; i++) {
    if (str.charAt(i) !== "%") {
      result.push(str.charCodeAt(i));
    } else {
      result.push(Number.parseInt(str.substring(i + 1, i + 3), 16));
      i += 2;
    }
  }
  return result;
}
function getNumRawDataModules(ver) {
  if (ver < MIN_VERSION || ver > MAX_VERSION)
    throw new RangeError("Version number out of range");
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7)
      result -= 36;
  }
  return result;
}
function getNumDataCodewords(ver, ecl) {
  return Math.floor(getNumRawDataModules(ver) / 8) - ECC_CODEWORDS_PER_BLOCK[ecl[0]][ver] * NUM_ERROR_CORRECTION_BLOCKS[ecl[0]][ver];
}
function reedSolomonComputeDivisor(degree) {
  if (degree < 1 || degree > 255)
    throw new RangeError("Degree out of range");
  const result = [];
  for (let i = 0; i < degree - 1; i++)
    result.push(0);
  result.push(1);
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = reedSolomonMultiply(result[j], root);
      if (j + 1 < result.length)
        result[j] ^= result[j + 1];
    }
    root = reedSolomonMultiply(root, 2);
  }
  return result;
}
function reedSolomonComputeRemainder(data, divisor) {
  const result = divisor.map((_) => 0);
  for (const b of data) {
    const factor = b ^ result.shift();
    result.push(0);
    divisor.forEach((coef, i) => result[i] ^= reedSolomonMultiply(coef, factor));
  }
  return result;
}
function reedSolomonMultiply(x, y) {
  if (x >>> 8 !== 0 || y >>> 8 !== 0)
    throw new RangeError("Byte out of range");
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = z << 1 ^ (z >>> 7) * 285;
    z ^= (y >>> i & 1) * x;
  }
  return z;
}
function encodeSegments(segs, ecl, minVersion = 1, maxVersion = 40, mask = -1, boostEcl = true) {
  if (!(MIN_VERSION <= minVersion && minVersion <= maxVersion && maxVersion <= MAX_VERSION) || mask < -1 || mask > 7) {
    throw new RangeError("Invalid value");
  }
  let version;
  let dataUsedBits;
  for (version = minVersion; ; version++) {
    const dataCapacityBits2 = getNumDataCodewords(version, ecl) * 8;
    const usedBits = getTotalBits(segs, version);
    if (usedBits <= dataCapacityBits2) {
      dataUsedBits = usedBits;
      break;
    }
    if (version >= maxVersion)
      throw new RangeError("Data too long");
  }
  for (const newEcl of [MEDIUM, QUARTILE, HIGH]) {
    if (boostEcl && dataUsedBits <= getNumDataCodewords(version, newEcl) * 8)
      ecl = newEcl;
  }
  const bb = [];
  for (const seg of segs) {
    appendBits(seg.mode[0], 4, bb);
    appendBits(seg.numChars, numCharCountBits(seg.mode, version), bb);
    for (const b of seg.getData())
      bb.push(b);
  }
  const dataCapacityBits = getNumDataCodewords(version, ecl) * 8;
  appendBits(0, Math.min(4, dataCapacityBits - bb.length), bb);
  appendBits(0, (8 - bb.length % 8) % 8, bb);
  for (let padByte = 236; bb.length < dataCapacityBits; padByte ^= 236 ^ 17)
    appendBits(padByte, 8, bb);
  const dataCodewords = Array.from({ length: Math.ceil(bb.length / 8) }, () => 0);
  bb.forEach((b, i) => dataCodewords[i >>> 3] |= b << 7 - (i & 7));
  return new QrCode(version, ecl, dataCodewords, mask);
}
function encode(data, options) {
  const {
    ecc = "L",
    boostEcc = false,
    minVersion = 1,
    maxVersion = 40,
    maskPattern = -1,
    border = 1
  } = options || {};
  const segment = typeof data === "string" ? makeSegments(data) : Array.isArray(data) ? [makeBytes(data)] : void 0;
  if (!segment)
    throw new Error(`uqr only supports encoding string and binary data, but got: ${typeof data}`);
  const qr = encodeSegments(
    segment,
    EccMap[ecc],
    minVersion,
    maxVersion,
    maskPattern,
    boostEcc
  );
  const result = addBorder({
    version: qr.version,
    maskPattern: qr.mask,
    size: qr.size,
    data: qr.modules,
    types: qr.types
  }, border);
  if (options?.invert)
    result.data = result.data.map((row) => row.map((mod) => !mod));
  options?.onEncoded?.(result);
  return result;
}
function addBorder(input, border = 1) {
  if (!border)
    return input;
  const { size } = input;
  const newSize = size + border * 2;
  input.size = newSize;
  input.data.forEach((row) => {
    for (let i = 0; i < border; i++) {
      row.unshift(false);
      row.push(false);
    }
  });
  for (let i = 0; i < border; i++) {
    input.data.unshift(Array.from({ length: newSize }, (_) => false));
    input.data.push(Array.from({ length: newSize }, (_) => false));
  }
  const b = QrCodeDataType.Border;
  input.types.forEach((row) => {
    for (let i = 0; i < border; i++) {
      row.unshift(b);
      row.push(b);
    }
  });
  for (let i = 0; i < border; i++) {
    input.types.unshift(Array.from({ length: newSize }, (_) => b));
    input.types.push(Array.from({ length: newSize }, (_) => b));
  }
  return input;
}
function escapeAttr(value) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function renderSVG(data, options = {}) {
  const result = encode(data, options);
  const {
    pixelSize = 10,
    whiteColor = "white",
    blackColor = "black"
  } = options;
  const height = result.size * pixelSize;
  const width = result.size * pixelSize;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">`;
  const paths = [];
  for (let row = 0; row < result.size; row++) {
    for (let col = 0; col < result.size; col++) {
      const x = col * pixelSize;
      const y = row * pixelSize;
      if (result.data[row][col])
        paths.push(`M${x},${y}h${pixelSize}v${pixelSize}h-${pixelSize}z`);
    }
  }
  svg += `<rect fill="${escapeAttr(whiteColor)}" width="${width}" height="${height}"/>`;
  svg += `<path fill="${escapeAttr(blackColor)}" d="${paths.join("")}"/>`;
  svg += "</svg>";
  return svg;
}

// deploy/worker/src/core/bytes.ts
function toBytes(input) {
  if (typeof input === "string") return new TextEncoder().encode(input);
  if (input instanceof Uint8Array) return input;
  return new Uint8Array(input);
}
function concatBytes(...parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
function constantTimeEqual(a, b) {
  const max = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < max; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

// deploy/worker/src/config/admin.ts
var PLACEHOLDER = "CHANGE-ME-TO-A-LONG-RANDOM-PASSWORD";
function validateAdminSecret(secret) {
  if (secret.length < 16 || secret === PLACEHOLDER) throw new Error("unsafe-admin-secret");
}
async function digest(value) {
  const bytes = new TextEncoder().encode(value);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}
async function verifyAdminPassword(candidate, configured) {
  try {
    validateAdminSecret(configured);
  } catch {
    return false;
  }
  const [left, right] = await Promise.all([digest(candidate), digest(configured)]);
  return constantTimeEqual(left, right);
}

// deploy/worker/src/subscription/links.ts
function q(value) {
  return encodeURIComponent(value);
}
function buildNamedProtocolLinks(config, host) {
  const cleanHost = host.trim().toLowerCase();
  const links = {};
  if (config.vless.enabled) {
    const params = `encryption=none&security=tls&sni=${q(cleanHost)}&fp=chrome&type=ws&host=${q(cleanHost)}&path=${q(config.vless.path)}`;
    links.vlessWs = `vless://${config.vless.uuid}@${cleanHost}:443?${params}#Tehran-Network-VLESS-WS`;
  }
  if (config.trojan.enabled) {
    const params = `security=tls&sni=${q(cleanHost)}&fp=chrome&type=ws&host=${q(cleanHost)}&path=${q(config.trojan.path)}`;
    links.trojanWs = `trojan://${q(config.trojan.password)}@${cleanHost}:443?${params}#Tehran-Network-Trojan-WS`;
  }
  if (config.xhttp.enabled) {
    const extra = JSON.stringify({ noGRPCHeader: true });
    const params = `encryption=none&security=tls&sni=${q(cleanHost)}&fp=chrome&type=xhttp&host=${q(cleanHost)}&path=${q(config.xhttp.path)}&mode=stream-one&extra=${q(extra)}`;
    links.vlessXhttp = `vless://${config.vless.uuid}@${cleanHost}:443?${params}#Tehran-Network-VLESS-XHTTP`;
  }
  return links;
}
function buildProtocolLinks(config, host) {
  return Object.values(buildNamedProtocolLinks(config, host)).filter(
    (value) => Boolean(value)
  );
}
function buildSubscriptionUrl(config, host) {
  return `https://${host}${config.subscription.path}/${config.subscription.token}`;
}

// deploy/worker/src/panel.ts
function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function page(body, title = "Tehran Network Edge Panel") {
  return `<!doctype html><html lang="fa" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><title>${escapeHtml(title)}</title>
<link rel="icon" href="data:,"><link rel="preload" href="/panel.js" as="script">
<style>
:root{font-family:Inter,system-ui,Tahoma,sans-serif;color:#eef2ff;background:#050816}*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:radial-gradient(circle at 10% 10%,#7c3aed55,transparent 35%),radial-gradient(circle at 90% 10%,#06b6d455,transparent 30%),#050816}
main{max-width:1160px;margin:auto;padding:30px 18px 70px}.top{display:flex;justify-content:space-between;gap:12px;align-items:center}.brand{font-weight:900;letter-spacing:.04em}.pill{border:1px solid #22c55e66;background:#22c55e18;color:#86efac;padding:8px 13px;border-radius:999px}
.hero{margin-top:34px;padding:clamp(22px,5vw,46px);border:1px solid #ffffff1f;border-radius:30px;background:#0b1026dd;box-shadow:0 35px 100px #0009}h1{font-size:clamp(32px,6vw,68px);margin:0;background:linear-gradient(90deg,#67e8f9,#a78bfa,#f472b6);-webkit-background-clip:text;color:transparent}p{line-height:1.9;color:#cbd5e1}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:15px}.card{padding:20px;border-radius:20px;background:#111936;border:1px solid #ffffff18;overflow:hidden}.card b{display:block;margin-bottom:9px}.field{display:flex;gap:9px;margin-top:12px}.field input{min-width:0;flex:1;background:#050816;border:1px solid #ffffff24;color:#dbeafe;border-radius:12px;padding:12px;direction:ltr}.field button,.primary{cursor:pointer;border:0;border-radius:12px;padding:12px 16px;font-weight:800;background:linear-gradient(90deg,#22d3ee,#8b5cf6);color:#fff}.login{display:grid;grid-template-columns:1fr auto;gap:10px;max-width:680px}.login input{background:#070b1c;border:1px solid #ffffff28;border-radius:14px;padding:14px;color:#fff}.qr{background:#fff;padding:10px;border-radius:16px;margin-top:13px;max-width:180px;direction:ltr}.qr svg{display:block;width:100%;height:auto}.notice{padding:15px;border-radius:14px;background:#f59e0b18;border:1px solid #f59e0b55;color:#fde68a}.error{background:#ef44441c;border-color:#ef444466;color:#fecaca}.muted{font-size:13px;color:#94a3b8;direction:ltr;text-align:left}@media(max-width:800px){.grid{grid-template-columns:1fr}.login{grid-template-columns:1fr}.top{align-items:flex-start;flex-direction:column}}
</style><script src="/panel.js" defer><\/script></head><body><main>${body}</main></body></html>`;
}
function top(status) {
  return `<div class="top"><div class="brand">TEHRAN NETWORK · EDGE PANEL</div><span class="pill">● ${escapeHtml(status)}</span></div>`;
}
function renderPublicPanel(config, error = "") {
  const state = config ? "Protocols Ready" : "Setup Required";
  const message = config ? "هسته اتصال فعال است. برای مشاهده کانفیگ‌ها و لینک اشتراک، رمز مدیریت ADMIN_PASSWORD را وارد کنید." : "نصب Cloudflare انجام شده. برای ساخت امن UUID، رمز Trojan و Subscription Token، همان ADMIN_PASSWORD زمان Deploy را وارد کنید.";
  return page(`${top(state)}<section class="hero">
<div class="muted">Cloudflare Worker · No VPS</div><h1>Tehran Network</h1>
<p>${message}</p>${error ? `<div class="notice error">${escapeHtml(error)}</div>` : ""}
<form class="login" method="post" action="/setup" autocomplete="off">
<input name="adminPassword" type="password" minlength="1" required autocomplete="current-password" placeholder="ADMIN_PASSWORD">
<button class="primary" type="submit">باز کردن پنل / Open Panel</button></form>
<div class="grid" style="margin-top:24px">
<div class="card"><b>VLESS · WebSocket</b><span>${config?.vless.enabled ? "فعال / Active" : "پس از Setup فعال می‌شود"}</span></div>
<div class="card"><b>Trojan · WebSocket</b><span>${config?.trojan.enabled ? "فعال / Active" : "پس از Setup فعال می‌شود"}</span></div>
<div class="card"><b>VLESS · XHTTP</b><span>${config?.xhttp.enabled ? "stream-one Active" : "پس از Setup فعال می‌شود"}</span></div>
</div></section>`);
}
function configCard(title, link, id) {
  const safe = escapeHtml(link);
  const qr = renderSVG(link, { ecc: "M", border: 2 });
  return `<div class="card"><b>${escapeHtml(title)}</b><div class="field">
<input id="${id}" readonly value="${safe}"><button type="button" data-copy-target="${id}">Copy</button></div>
<div class="qr">${qr}</div></div>`;
}
function renderOwnerPanel(config, host) {
  const links = buildNamedProtocolLinks(config, host);
  const subscriptionUrl = buildSubscriptionUrl(config, host);
  const cards = [
    links.vlessWs ? configCard("VLESS · WebSocket · TLS", links.vlessWs, "vless-ws") : "",
    links.trojanWs ? configCard("Trojan · WebSocket · TLS", links.trojanWs, "trojan-ws") : "",
    links.vlessXhttp ? configCard("VLESS · XHTTP · stream-one", links.vlessXhttp, "vless-xhttp") : ""
  ].join("");
  return page(`${top("Ready to Connect")}<section class="hero">
<div class="muted">Owner view · credentials are never shown on the public page</div>
<h1>اتصال آماده است.</h1><p>یکی از کانفیگ‌ها را Copy یا QR را Scan کنید. برای کلاینت‌های سازگار می‌توانید لینک Subscription را وارد کنید.</p>
<div class="grid">${cards}</div>
<div class="card" style="margin-top:15px"><b>Subscription · Universal</b><div class="field">
<input id="subscription-url" readonly value="${escapeHtml(subscriptionUrl)}"><button type="button" data-copy-target="subscription-url">Copy</button></div>
<div class="qr">${renderSVG(subscriptionUrl, { ecc: "M", border: 2 })}</div>
<p class="muted">Formats: base64 · links · singbox · mihomo</p></div>
<div class="notice" style="margin-top:15px">رمز مدیریت، UUID، رمز Trojan و Subscription Token مستقل هستند. این صفحه فقط بعد از احراز ADMIN_PASSWORD نمایش داده می‌شود.</div>
</section>`);
}
function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff"
    }
  });
}
async function handleSetupForm(request, env) {
  let candidate;
  try {
    const form = await request.formData();
    candidate = String(form.get("adminPassword") ?? "");
  } catch {
    return htmlResponse(renderPublicPanel(null, "فرم نامعتبر است / Invalid form"), 400);
  }
  if (!await verifyAdminPassword(candidate, env.ADMIN_PASSWORD)) {
    return htmlResponse(
      renderPublicPanel(null, "رمز مدیریت صحیح نیست / Invalid admin password"),
      401
    );
  }
  const config = await ensureProtocolConfig(env);
  return htmlResponse(renderOwnerPanel(config, new URL(request.url).hostname));
}
function bearer(request) {
  const value = request.headers.get("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}
async function handleAdminApiSetup(request, env) {
  if (!await verifyAdminPassword(bearer(request), env.ADMIN_PASSWORD)) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
    });
  }
  const config = await ensureProtocolConfig(env);
  const host = new URL(request.url).hostname;
  return new Response(
    JSON.stringify({
      ok: true,
      links: buildProtocolLinks(config, host),
      subscriptionUrl: buildSubscriptionUrl(config, host),
      protocols: {
        vless: { enabled: config.vless.enabled, path: config.vless.path },
        trojan: { enabled: config.trojan.enabled, path: config.trojan.path },
        xhttp: { enabled: config.xhttp.enabled, path: config.xhttp.path, mode: config.xhttp.mode }
      }
    }),
    { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }
  );
}
function panelScript() {
  return `document.addEventListener('click',async(e)=>{const b=e.target.closest('[data-copy-target]');if(!b)return;const el=document.getElementById(b.dataset.copyTarget);if(!el)return;try{await navigator.clipboard.writeText(el.value);const old=b.textContent;b.textContent='Copied';setTimeout(()=>b.textContent=old,1200)}catch{el.select();document.execCommand('copy')}});`;
}
function javascriptResponse() {
  return new Response(panelScript(), {
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "public, max-age=3600",
      "x-content-type-options": "nosniff"
    }
  });
}
function publicPanelResponse(config) {
  return htmlResponse(renderPublicPanel(config));
}

// deploy/worker/src/subscription/formats.ts
function singbox(config, host) {
  const outbounds = [];
  if (config.vless.enabled) {
    outbounds.push({
      type: "vless",
      tag: "Tehran-Network-VLESS-WS",
      server: host,
      server_port: 443,
      uuid: config.vless.uuid,
      tls: { enabled: true, server_name: host, utls: { enabled: true, fingerprint: "chrome" } },
      transport: { type: "ws", path: config.vless.path, headers: { Host: host } }
    });
  }
  if (config.trojan.enabled) {
    outbounds.push({
      type: "trojan",
      tag: "Tehran-Network-Trojan-WS",
      server: host,
      server_port: 443,
      password: config.trojan.password,
      tls: { enabled: true, server_name: host, utls: { enabled: true, fingerprint: "chrome" } },
      transport: { type: "ws", path: config.trojan.path, headers: { Host: host } }
    });
  }
  return JSON.stringify({ outbounds }, null, 2);
}
function yamlQuote(value) {
  return JSON.stringify(value);
}
function mihomo(config, host) {
  const rows = ["proxies:"];
  if (config.vless.enabled) {
    rows.push(
      "  - name: Tehran-Network-VLESS-WS",
      "    type: vless",
      `    server: ${yamlQuote(host)}`,
      "    port: 443",
      `    uuid: ${yamlQuote(config.vless.uuid)}`,
      "    tls: true",
      `    servername: ${yamlQuote(host)}`,
      "    network: ws",
      "    ws-opts:",
      `      path: ${yamlQuote(config.vless.path)}`,
      "      headers:",
      `        Host: ${yamlQuote(host)}`
    );
  }
  if (config.trojan.enabled) {
    rows.push(
      "  - name: Tehran-Network-Trojan-WS",
      "    type: trojan",
      `    server: ${yamlQuote(host)}`,
      "    port: 443",
      `    password: ${yamlQuote(config.trojan.password)}`,
      "    tls: true",
      `    sni: ${yamlQuote(host)}`,
      "    network: ws",
      "    ws-opts:",
      `      path: ${yamlQuote(config.trojan.path)}`,
      "      headers:",
      `        Host: ${yamlQuote(host)}`
    );
  }
  return `${rows.join("\n")}
`;
}
function renderSubscription(format, config, host) {
  const links = buildProtocolLinks(config, host);
  if (format === "links") {
    return { body: `${links.join("\n")}
`, contentType: "text/plain; charset=utf-8" };
  }
  if (format === "base64") {
    return { body: btoa(links.join("\n")), contentType: "text/plain; charset=utf-8" };
  }
  if (format === "singbox") {
    return { body: singbox(config, host), contentType: "application/json; charset=utf-8" };
  }
  return { body: mihomo(config, host), contentType: "text/yaml; charset=utf-8" };
}
function chooseFormat(request) {
  const requested = new URL(request.url).searchParams.get("format")?.toLowerCase();
  if (requested === "links" || requested === "base64" || requested === "singbox" || requested === "mihomo") {
    return requested;
  }
  const ua = request.headers.get("user-agent")?.toLowerCase() ?? "";
  if (ua.includes("sing-box") || ua.includes("singbox")) return "singbox";
  if (ua.includes("clash") || ua.includes("mihomo")) return "mihomo";
  return "base64";
}

// deploy/worker/src/routes/subscription.ts
function secureEqual(left, right) {
  const encoder = new TextEncoder();
  return constantTimeEqual(encoder.encode(left), encoder.encode(right));
}
async function handleSubscriptionRoute(request, config) {
  const url = new URL(request.url);
  const prefix = config ? `${config.subscription.path}/` : "/sub/";
  if (!url.pathname.startsWith(prefix)) return null;
  if (request.method !== "GET" || !config) return new Response("Not found", { status: 404 });
  const token = decodeURIComponent(url.pathname.slice(prefix.length));
  if (!token || token.includes("/") || !secureEqual(token, config.subscription.token)) {
    return new Response("Not found", { status: 404 });
  }
  const output = renderSubscription(chooseFormat(request), config, url.hostname);
  return new Response(output.body, {
    status: 200,
    headers: {
      "content-type": output.contentType,
      "cache-control": "no-store",
      "content-disposition": "inline",
      "x-content-type-options": "nosniff"
    }
  });
}

// deploy/worker/src/network/destination.ts
function normalizeHost(host) {
  return host.trim().toLowerCase().replace(/\.$/, "");
}
function parseIpv4(host) {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((part) => /^\d{1,3}$/.test(part) ? Number(part) : Number.NaN);
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return nums;
}
function isBlockedIpv4(ip) {
  const [a, b] = ip;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a >= 224) return true;
  return false;
}
function firstIpv6Hextet(host) {
  if (!host.includes(":")) return null;
  const first = host.split(":", 1)[0];
  if (host === "::" || host === "::1") return 0;
  if (!first || !/^[0-9a-f]{1,4}$/i.test(first)) return null;
  return Number.parseInt(first, 16);
}
function isBlockedIpv6(host) {
  const normalized = host.toLowerCase();
  if (normalized === "::" || normalized === "::1") return true;
  const first = firstIpv6Hextet(normalized);
  if (first === null) return false;
  if ((first & 65024) === 64512) return true;
  if ((first & 65472) === 65152) return true;
  if ((first & 65280) === 65280) return true;
  return false;
}
function validateDestination(destination, selfHost) {
  const host = normalizeHost(destination.host);
  const self = normalizeHost(selfHost);
  if (!host || host.length > 253) return { ok: false, reason: "invalid-host" };
  if (!Number.isInteger(destination.port) || destination.port < 1 || destination.port > 65535) {
    return { ok: false, reason: "invalid-port" };
  }
  if (host === self) return { ok: false, reason: "self-destination" };
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    return { ok: false, reason: "local-domain" };
  }
  const ipv4 = parseIpv4(host);
  if (ipv4 && isBlockedIpv4(ipv4)) return { ok: false, reason: "private-ipv4" };
  if (host.includes(":") && isBlockedIpv6(host)) return { ok: false, reason: "private-ipv6" };
  return { ok: true };
}

// deploy/worker/src/network/tcp.ts
var openTcp = async (destination, selfHost) => {
  const validation = validateDestination(destination, selfHost);
  if (!validation.ok) throw new Error(`destination-blocked:${validation.reason}`);
  const { connect } = await import("cloudflare:sockets");
  const socket = connect(
    { hostname: destination.host, port: destination.port },
    { allowHalfOpen: true }
  );
  if (socket.opened) await socket.opened;
  return socket;
};

// deploy/worker/src/core/uuid.ts
var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function uuidToBytes(uuid) {
  if (!UUID_RE.test(uuid)) throw new Error("invalid-uuid");
  const compact = uuid.replaceAll("-", "");
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) out[i] = Number.parseInt(compact.slice(i * 2, i * 2 + 2), 16);
  return out;
}
function formatIpv6(bytes) {
  if (bytes.length !== 16) throw new Error("invalid-ipv6-length");
  const groups = [];
  for (let i = 0; i < 16; i += 2) groups.push((bytes[i] << 8 | bytes[i + 1]).toString(16));
  return groups.join(":");
}

// deploy/worker/src/protocols/trojan.ts
var MAX_HEADER_BYTES = 512;
var HASH_LENGTH = 56;
var CONNECT = 1;
var fail = (code) => ({ kind: "error", code });
var needMore = () => ({ kind: "need-more" });
function asciiBytes(text3) {
  return new TextEncoder().encode(text3.toLowerCase());
}
function parseTrojanRequest(input, expectedHash) {
  if (!/^[0-9a-f]{56}$/i.test(expectedHash)) return fail("config");
  if (input.length < HASH_LENGTH + 2) return needMore();
  const receivedHash = input.subarray(0, HASH_LENGTH);
  if (!constantTimeEqual(receivedHash, asciiBytes(expectedHash))) return fail("auth");
  if (input[56] !== 13 || input[57] !== 10) return fail("malformed");
  let offset = 58;
  if (input.length < offset + 2) return needMore();
  const command = input[offset];
  if (command !== CONNECT) return fail("unsupported-command");
  const addressType = input[offset + 1];
  offset += 2;
  let destination;
  if (addressType === 1) {
    if (offset + 4 > MAX_HEADER_BYTES) return fail("header-too-large");
    if (input.length < offset + 4) return needMore();
    destination = {
      host: [...input.subarray(offset, offset + 4)].join("."),
      port: 0,
      addressType: "ipv4"
    };
    offset += 4;
  } else if (addressType === 3) {
    if (input.length < offset + 1) return needMore();
    const length = input[offset];
    if (length === 0) return fail("invalid-address");
    offset += 1;
    if (offset + length > MAX_HEADER_BYTES) return fail("header-too-large");
    if (input.length < offset + length) return needMore();
    try {
      const host = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(
        input.subarray(offset, offset + length)
      );
      if (!host) return fail("invalid-address");
      destination = { host, port: 0, addressType: "domain" };
    } catch {
      return fail("invalid-address");
    }
    offset += length;
  } else if (addressType === 4) {
    if (offset + 16 > MAX_HEADER_BYTES) return fail("header-too-large");
    if (input.length < offset + 16) return needMore();
    destination = {
      host: formatIpv6(input.subarray(offset, offset + 16)),
      port: 0,
      addressType: "ipv6"
    };
    offset += 16;
  } else {
    return fail("invalid-address-type");
  }
  if (offset + 4 > MAX_HEADER_BYTES) return fail("header-too-large");
  if (input.length < offset + 4) return needMore();
  const port = input[offset] << 8 | input[offset + 1];
  if (port === 0) return fail("invalid-port");
  destination.port = port;
  if (input[offset + 2] !== 13 || input[offset + 3] !== 10) return fail("malformed");
  offset += 4;
  return { kind: "ok", value: { destination, payload: input.slice(offset) } };
}

// deploy/worker/src/protocols/vless.ts
var MAX_HEADER_BYTES2 = 512;
var VERSION = 0;
var COMMAND_TCP = 1;
function needMore2() {
  return { kind: "need-more" };
}
function fail2(code) {
  return { kind: "error", code };
}
function parseVlessRequest(input, expectedUuid) {
  if (input.length < 18) return needMore2();
  if (input[0] !== VERSION) return fail2("unsupported-version");
  let expected;
  try {
    expected = uuidToBytes(expectedUuid);
  } catch {
    return fail2("config");
  }
  if (!constantTimeEqual(input.subarray(1, 17), expected)) return fail2("auth");
  const addonsLength = input[17];
  let offset = 18 + addonsLength;
  if (offset + 4 > MAX_HEADER_BYTES2) return fail2("header-too-large");
  if (input.length < offset + 4) return needMore2();
  const command = input[offset];
  if (command !== COMMAND_TCP) return fail2("unsupported-command");
  const port = input[offset + 1] << 8 | input[offset + 2];
  const addressType = input[offset + 3];
  offset += 4;
  if (port === 0) return fail2("invalid-port");
  let destination;
  if (addressType === 1) {
    if (offset + 4 > MAX_HEADER_BYTES2) return fail2("header-too-large");
    if (input.length < offset + 4) return needMore2();
    const host = [...input.subarray(offset, offset + 4)].join(".");
    offset += 4;
    destination = { host, port, addressType: "ipv4" };
  } else if (addressType === 2) {
    if (input.length < offset + 1) return needMore2();
    const length = input[offset];
    if (length === 0) return fail2("invalid-address");
    offset += 1;
    if (offset + length > MAX_HEADER_BYTES2) return fail2("header-too-large");
    if (input.length < offset + length) return needMore2();
    try {
      const host = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(
        input.subarray(offset, offset + length)
      );
      if (!host) return fail2("invalid-address");
      destination = { host, port, addressType: "domain" };
    } catch {
      return fail2("invalid-address");
    }
    offset += length;
  } else if (addressType === 3) {
    if (offset + 16 > MAX_HEADER_BYTES2) return fail2("header-too-large");
    if (input.length < offset + 16) return needMore2();
    const host = formatIpv6(input.subarray(offset, offset + 16));
    offset += 16;
    destination = { host, port, addressType: "ipv6" };
  } else {
    return fail2("invalid-address-type");
  }
  if (offset > MAX_HEADER_BYTES2) return fail2("header-too-large");
  return {
    kind: "ok",
    value: {
      destination,
      payload: input.slice(offset),
      responseHeader: new Uint8Array([VERSION, 0])
    }
  };
}

// deploy/worker/src/transport/websocket.ts
async function eventBytes(data) {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data))
    return toBytes(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  if (data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
  return null;
}
function runWebSocketTunnel(options) {
  const { webSocket, parseFirstPacket, connectTcp, selfHost } = options;
  const maxFirstPacketBytes = options.maxFirstPacketBytes ?? 64 * 1024;
  let firstPacket = new Uint8Array();
  let socket = null;
  let writer = null;
  let stopped = false;
  let queue = Promise.resolve();
  const stop = (code = 1e3, reason = "closed") => {
    if (stopped) return;
    stopped = true;
    try {
      socket?.close();
    } catch {
    }
    try {
      webSocket.close(code, reason);
    } catch {
    }
  };
  const pumpDownstream = async (remote) => {
    const reader = remote.readable.getReader();
    try {
      while (!stopped) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value?.byteLength) webSocket.send(value);
      }
      if (!stopped) {
        try {
          webSocket.close(1e3, "remote-eof");
        } catch {
        }
      }
    } catch {
      stop(1011, "remote-error");
    } finally {
      reader.releaseLock();
    }
  };
  const handleMessage = async (data) => {
    if (stopped) return;
    const bytes = await eventBytes(data);
    if (!bytes) {
      stop(1003, "binary-required");
      return;
    }
    if (writer) {
      await writer.write(bytes);
      return;
    }
    firstPacket = concatBytes(firstPacket, bytes);
    if (firstPacket.byteLength > maxFirstPacketBytes) {
      stop(1009, "first-packet-too-large");
      return;
    }
    const parsed = parseFirstPacket(firstPacket);
    if (parsed.kind === "need-more") return;
    if (parsed.kind === "error") {
      stop(1008, "invalid-handshake");
      return;
    }
    try {
      socket = await connectTcp(parsed.value.destination, selfHost);
      writer = socket.writable.getWriter();
      if (parsed.value.responseHeader?.byteLength) webSocket.send(parsed.value.responseHeader);
      if (parsed.value.payload.byteLength) await writer.write(parsed.value.payload);
      firstPacket = new Uint8Array();
      void pumpDownstream(socket);
    } catch {
      stop(1011, "connect-failed");
    }
  };
  webSocket.addEventListener("message", (event) => {
    const data = typeof event === "object" && event !== null && "data" in event ? event.data : void 0;
    queue = queue.then(() => handleMessage(data)).catch(() => stop(1011, "tunnel-error"));
  });
  webSocket.addEventListener("close", () => {
    if (!stopped) {
      stopped = true;
      try {
        socket?.close();
      } catch {
      }
    }
  });
  webSocket.addEventListener("error", () => stop(1011, "websocket-error"));
}

// deploy/worker/src/routes/ws.ts
function text(status, message) {
  return new Response(message, { status, headers: { "cache-control": "no-store" } });
}
function cloudflareUpgrade(input) {
  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];
  server.accept();
  const tunnelSocket = {
    send: (data) => server.send(data),
    close: (code, reason) => server.close(code, reason),
    addEventListener: (type, listener) => {
      if (type === "message") server.addEventListener("message", (event) => listener(event));
      else if (type === "close") server.addEventListener("close", (event) => listener(event));
      else if (type === "error") server.addEventListener("error", (event) => listener(event));
    }
  };
  runWebSocketTunnel({
    webSocket: tunnelSocket,
    parseFirstPacket: input.parseFirstPacket,
    connectTcp: input.connectTcp,
    selfHost: input.selfHost
  });
  return new Response(null, { status: 101, webSocket: client });
}
async function handleWebSocketRoute(request, config, deps = {}) {
  const url = new URL(request.url);
  if (!config) {
    if (url.pathname === "/vless" || url.pathname === "/trojan")
      return text(503, "Owner setup required");
    return null;
  }
  let kind;
  let parseFirstPacket;
  let enabled;
  if (url.pathname === config.vless.path) {
    kind = "vless";
    enabled = config.vless.enabled;
    parseFirstPacket = (input2) => parseVlessRequest(input2, config.vless.uuid);
  } else if (url.pathname === config.trojan.path) {
    kind = "trojan";
    enabled = config.trojan.enabled;
    parseFirstPacket = (input2) => parseTrojanRequest(input2, config.trojan.passwordHash);
  } else {
    return null;
  }
  if (!enabled) return text(404, "Not found");
  if (request.method !== "GET") return text(405, "Method not allowed");
  if (request.headers.get("upgrade")?.toLowerCase() !== "websocket")
    return text(426, "WebSocket upgrade required");
  const input = {
    kind,
    parseFirstPacket,
    connectTcp: deps.connectTcp ?? openTcp,
    selfHost: url.hostname
  };
  return (deps.createUpgradeResponse ?? cloudflareUpgrade)(input);
}

// deploy/worker/src/transport/xhttp.ts
var response = (status, message) => new Response(message, {
  status,
  headers: { "cache-control": "no-store", "content-type": "text/plain; charset=utf-8" }
});
async function createXhttpStream(input) {
  const maxHandshakeBytes = input.maxHandshakeBytes ?? 64 * 1024;
  const bodyReader = input.body.getReader();
  let handshake = new Uint8Array();
  let parsed;
  while (true) {
    const next = await bodyReader.read();
    if (next.done) return response(400, "Incomplete XHTTP handshake");
    handshake = concatBytes(handshake, next.value);
    if (handshake.byteLength > maxHandshakeBytes) return response(413, "XHTTP handshake too large");
    parsed = input.parseFirstPacket(handshake);
    if (parsed.kind === "need-more") continue;
    if (parsed.kind === "error")
      return response(parsed.code === "auth" ? 403 : 400, "Invalid XHTTP handshake");
    break;
  }
  let socket;
  try {
    socket = await input.connectTcp(parsed.value.destination, input.selfHost);
  } catch {
    return response(502, "TCP destination unavailable");
  }
  const writer = socket.writable.getWriter();
  if (parsed.value.payload.byteLength) await writer.write(parsed.value.payload);
  const pumpUpload = async () => {
    try {
      while (true) {
        const next = await bodyReader.read();
        if (next.done) break;
        if (next.value.byteLength) await writer.write(next.value);
      }
    } catch {
      try {
        socket.close();
      } catch {
      }
    } finally {
      bodyReader.releaseLock();
      try {
        writer.releaseLock();
      } catch {
      }
    }
  };
  void pumpUpload();
  const responseHeader = parsed.value.responseHeader ?? new Uint8Array();
  const downstream = new ReadableStream({
    async start(controller) {
      if (responseHeader.byteLength) controller.enqueue(responseHeader);
      const reader = socket.readable.getReader();
      try {
        while (true) {
          const next = await reader.read();
          if (next.done) break;
          if (next.value.byteLength) controller.enqueue(next.value);
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
        try {
          socket.close();
        } catch {
        }
      }
    },
    cancel() {
      try {
        socket.close();
      } catch {
      }
    }
  });
  return new Response(downstream, {
    status: 200,
    headers: {
      "cache-control": "no-store",
      // Production semantics (P0 field fix): the Xray stream-one client sends
      // Content-Type: application/grpc, and Cloudflare's edge treats SSE-typed
      // responses to gRPC requests specially (buffering/mangling risk). Real
      // Xray servers answer SSE, which the official XHTTP discussion flags as
      // problematic through CDNs; field-proven Workers deployments answer with
      // application/octet-stream and disable edge buffering explicitly. The
      // Xray client never inspects this content-type, so this is safe.
      "content-type": "application/octet-stream",
      "x-accel-buffering": "no",
      "x-content-type-options": "nosniff"
    }
  });
}

// deploy/worker/src/routes/xhttp.ts
var text2 = (status, message) => new Response(message, { status, headers: { "cache-control": "no-store" } });
function normalizedBase(path) {
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
}
function isXhttpPath(pathname, configured) {
  const base = normalizedBase(configured);
  return pathname === base || pathname === `${base}/`;
}
async function handleXhttpRoute(request, config, deps = {}) {
  const url = new URL(request.url);
  if (!config) {
    if (isXhttpPath(url.pathname, "/xhttp")) return text2(503, "Owner setup required");
    return null;
  }
  if (!isXhttpPath(url.pathname, config.xhttp.path)) return null;
  if (!config.xhttp.enabled) {
    if (request.method === "POST") deps.onAttempt?.(404);
    return text2(404, "Not found");
  }
  if (request.method !== "POST") return text2(405, "Method not allowed");
  if (!request.body) {
    deps.onAttempt?.(400);
    return text2(400, "Request body required");
  }
  const response2 = await (deps.createStreamResponse ?? createXhttpStream)({
    body: request.body,
    parseFirstPacket: (bytes) => parseVlessRequest(bytes, config.vless.uuid),
    connectTcp: deps.connectTcp ?? openTcp,
    selfHost: url.hostname
  });
  deps.onAttempt?.(response2.status);
  return response2;
}

// deploy/worker/src/index.ts
var VERSION2 = "0.2.0";
var diagnosticsByKv = /* @__PURE__ */ new WeakMap();
function diagnosticsFor(env) {
  const existing = diagnosticsByKv.get(env.C);
  if (existing) return existing;
  const created = createXhttpDiagnostics(env.C);
  diagnosticsByKv.set(env.C, created);
  return created;
}
var json = (data, status = 200) => new Response(JSON.stringify(data, null, 2), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  }
});
var methodNotAllowed = () => json({ ok: false, error: "method-not-allowed" }, 405);
var index_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    let protocolConfig;
    try {
      protocolConfig = await loadProtocolConfig(env);
    } catch {
      return json({ ok: false, error: "invalid-server-config" }, 500);
    }
    const wsResponse = await handleWebSocketRoute(request, protocolConfig);
    if (wsResponse) return wsResponse;
    const diagnostics = diagnosticsFor(env);
    const xhttpResponse = await handleXhttpRoute(request, protocolConfig, {
      onAttempt: (status) => {
        diagnostics.record(status);
        const flush = diagnostics.flushIfNeeded();
        if (ctx?.waitUntil) ctx.waitUntil(flush);
      }
    });
    if (xhttpResponse) return xhttpResponse;
    const subscriptionResponse = await handleSubscriptionRoute(request, protocolConfig);
    if (subscriptionResponse) return subscriptionResponse;
    if (url.pathname === "/panel.js") {
      return request.method === "GET" ? javascriptResponse() : methodNotAllowed();
    }
    if (url.pathname === "/setup") {
      return request.method === "POST" ? handleSetupForm(request, env) : methodNotAllowed();
    }
    if (url.pathname === "/api/setup") {
      return request.method === "POST" ? handleAdminApiSetup(request, env) : methodNotAllowed();
    }
    if (url.pathname === "/health") {
      return request.method === "GET" ? json({ ok: true, version: VERSION2 }) : methodNotAllowed();
    }
    if (url.pathname === "/api/status") {
      if (request.method !== "GET") return methodNotAllowed();
      return json({
        ok: true,
        version: VERSION2,
        kv: true,
        protocols: protocolConfig ? publicProtocolStatus(protocolConfig) : "setup-required",
        xhttpDiag: await diagnostics.snapshot()
      });
    }
    if (url.pathname === "/") {
      return request.method === "GET" ? publicPanelResponse(protocolConfig) : methodNotAllowed();
    }
    return json({ ok: false, error: "not-found" }, 404);
  }
};
export {
  index_default as default
};
