const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(width, height) {
  // Simple uncompressed PNG generator in pure Node without external deps
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // Deflate
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // No interlace
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Raw image scanlines
  const rowSize = width * 4 + 1;
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // No filter
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      // Gradient background (indigo to teal)
      const t = (x + y) / (width + height);
      rawData[pxOffset] = Math.round(79 * (1 - t) + 6 * t);     // R
      rawData[pxOffset + 1] = Math.round(70 * (1 - t) + 182 * t); // G
      rawData[pxOffset + 2] = Math.round(229 * (1 - t) + 212 * t); // B
      rawData[pxOffset + 3] = 255;                              // A
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(len + 12);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crc = crc32(chunk.subarray(4, len + 8));
  chunk.writeInt32BE(crc, len + 8);
  return chunk;
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c = (c >>> 8) ^ table[(c ^ buf[i]) & 0xFF];
  }
  return ~c;
}

const table = new Int32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
  }
  table[i] = c;
}

[16, 32, 48, 128].forEach(size => {
  const png = createPNG(size, size);
  fs.writeFileSync(path.join(__dirname, `icon${size}.png`), png);
});

console.log('Valid binary PNG icons (16, 32, 48, 128) generated!');
