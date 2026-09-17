import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { deflateSync } from "node:zlib";

const SIZE = 384;
const OUT = resolve("public/assets/avatar/reference");
const rgba = (hex, alpha = 255) => {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255, alpha];
};

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buffer) => {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};
const chunk = (name, data) => {
  const type = Buffer.from(name);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([type, data])));
  return Buffer.concat([length, type, data, crc]);
};

class Raster {
  pixels = Buffer.alloc(SIZE * SIZE * 4);

  blend(x, y, colour) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
    const index = (y * SIZE + x) * 4;
    const alpha = colour[3] / 255;
    const under = this.pixels[index + 3] / 255;
    const out = alpha + under * (1 - alpha);
    if (out === 0) return;
    for (let channel = 0; channel < 3; channel++) {
      this.pixels[index + channel] = Math.round(
        (colour[channel] * alpha + this.pixels[index + channel] * under * (1 - alpha)) / out,
      );
    }
    this.pixels[index + 3] = Math.round(out * 255);
  }

  rect(x, y, width, height, colour) {
    for (let py = y; py < y + height; py++) {
      for (let px = x; px < x + width; px++) this.blend(px, py, colour);
    }
  }

  ellipse(cx, cy, rx, ry, colour) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) this.blend(x, y, colour);
      }
    }
  }

  polygon(points, colour) {
    const minY = Math.floor(Math.min(...points.map(([, y]) => y)));
    const maxY = Math.ceil(Math.max(...points.map(([, y]) => y)));
    for (let y = minY; y <= maxY; y++) {
      const crossings = [];
      for (let i = 0; i < points.length; i++) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[(i + 1) % points.length];
        if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
          crossings.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
        }
      }
      crossings.sort((a, b) => a - b);
      for (let i = 0; i < crossings.length; i += 2) {
        for (let x = Math.ceil(crossings[i]); x <= Math.floor(crossings[i + 1]); x++) {
          this.blend(x, y, colour);
        }
      }
    }
  }

  png() {
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const header = Buffer.alloc(13);
    header.writeUInt32BE(SIZE, 0);
    header.writeUInt32BE(SIZE, 4);
    header[8] = 8;
    header[9] = 6;
    const scanlines = Buffer.alloc((SIZE * 4 + 1) * SIZE);
    for (let y = 0; y < SIZE; y++) {
      const target = y * (SIZE * 4 + 1);
      scanlines[target] = 0;
      this.pixels.copy(scanlines, target + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
    }
    return Buffer.concat([
      signature,
      chunk("IHDR", header),
      chunk("IDAT", deflateSync(scanlines, { level: 9 })),
      chunk("IEND", Buffer.alloc(0)),
    ]);
  }
}

const save = (name, draw) => {
  const raster = new Raster();
  draw(raster);
  const path = resolve(OUT, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, raster.png());
};

const outline = rgba("#4b3548");
const skin = rgba("#eeeeef");
const skinLight = rgba("#ffffff");
const cloth = rgba("#d8cbd5");
const clothDark = rgba("#8d718c");
const maskDark = rgba("#4b4b56");
const maskMid = rgba("#9b9ba5");
const maskLight = rgba("#e2e2e5");

const body = (model) => (raster) => {
  const shoulders = model === "male" ? 58 : 50;
  const hip = model === "male" ? 39 : 44;
  raster.ellipse(192, 103, 39, 43, outline);
  raster.ellipse(192, 101, 34, 38, skin);
  raster.ellipse(181, 88, 11, 8, skinLight);
  raster.rect(181, 133, 22, 19, skin);
  raster.polygon(
    [
      [192 - shoulders, 148],
      [192 + shoulders, 148],
      [192 + hip, 226],
      [192 - hip, 226],
    ],
    outline,
  );
  raster.polygon(
    [
      [192 - shoulders + 6, 153],
      [192 + shoulders - 6, 153],
      [192 + hip - 4, 221],
      [192 - hip + 4, 221],
    ],
    skin,
  );
  raster.polygon(
    [
      [134, 153],
      [150, 156],
      [154, 235],
      [140, 237],
    ],
    outline,
  );
  raster.polygon(
    [
      [250, 153],
      [234, 156],
      [230, 235],
      [244, 237],
    ],
    outline,
  );
  raster.polygon(
    [
      [140, 158],
      [147, 159],
      [149, 229],
      [143, 230],
    ],
    skin,
  );
  raster.polygon(
    [
      [244, 158],
      [237, 159],
      [235, 229],
      [241, 230],
    ],
    skin,
  );
  raster.ellipse(146, 239, 11, 13, skin);
  raster.ellipse(238, 239, 11, 13, skin);
  raster.polygon(
    [
      [155, 218],
      [192, 214],
      [182, 296],
      [152, 296],
    ],
    outline,
  );
  raster.polygon(
    [
      [192, 214],
      [229, 218],
      [232, 296],
      [202, 296],
    ],
    outline,
  );
  raster.polygon(
    [
      [160, 222],
      [187, 220],
      [178, 291],
      [158, 291],
    ],
    skin,
  );
  raster.polygon(
    [
      [197, 220],
      [224, 222],
      [226, 291],
      [206, 291],
    ],
    skin,
  );
  raster.rect(151, 286, 33, 14, outline);
  raster.rect(200, 286, 33, 14, outline);
};

const modesty = () => (raster) => {
  raster.polygon(
    [
      [155, 186],
      [229, 186],
      [224, 226],
      [160, 226],
    ],
    clothDark,
  );
  raster.polygon(
    [
      [162, 188],
      [222, 188],
      [216, 219],
      [168, 219],
    ],
    cloth,
  );
};

rmSync(resolve(OUT, "body-male.png"), { force: true });
rmSync(resolve(OUT, "body-female.png"), { force: true });
save("body-skin-male.png", body("male"));
save("body-skin-female.png", body("female"));
save("body-modesty-male.png", modesty());
save("body-modesty-female.png", modesty());

for (const model of ["male", "female"]) {
  for (let variant = 1; variant <= 4; variant++) {
    save(`face-${model}-${variant}.png`, (raster) => {
      const eyeY = 101 + (variant % 2) * 2;
      const spacing = variant > 2 ? 13 : 15;
      raster.rect(192 - spacing - 4, eyeY, 8, 7, outline);
      raster.rect(192 + spacing - 4, eyeY, 8, 7, outline);
      raster.rect(190, 112, 5, 7, rgba("#a9665b"));
      if (variant === 1) raster.rect(184, 124, 16, 3, outline);
      if (variant === 2)
        raster.polygon(
          [
            [183, 122],
            [192, 127],
            [201, 122],
            [198, 129],
            [186, 129],
          ],
          outline,
        );
      if (variant === 3) raster.rect(181, 122, 22, 4, rgba("#8c4e4d"));
      if (variant === 4)
        raster.polygon(
          [
            [184, 126],
            [192, 121],
            [200, 126],
            [197, 129],
            [187, 129],
          ],
          rgba("#8c4e4d"),
        );
    });
  }
}

const hairShapes = [
  (r) =>
    r.polygon(
      [
        [158, 97],
        [160, 70],
        [192, 58],
        [224, 70],
        [226, 98],
        [214, 82],
        [170, 82],
      ],
      maskMid,
    ),
  (r) =>
    r.polygon(
      [
        [158, 100],
        [162, 68],
        [205, 56],
        [226, 78],
        [212, 72],
        [180, 89],
      ],
      maskMid,
    ),
  (r) => {
    r.polygon(
      [
        [156, 94],
        [162, 62],
        [222, 65],
        [230, 104],
        [218, 145],
        [207, 111],
        [165, 106],
        [169, 145],
      ],
      maskMid,
    );
  },
  (r) => {
    for (const [x, y] of [
      [163, 76],
      [178, 64],
      [194, 62],
      [210, 67],
      [222, 82],
      [158, 94],
      [226, 99],
    ])
      r.ellipse(x, y, 15, 15, maskMid);
  },
  (r) =>
    r.polygon(
      [
        [174, 80],
        [182, 43],
        [193, 66],
        [207, 39],
        [214, 82],
      ],
      maskMid,
    ),
  (r) => {
    r.polygon(
      [
        [158, 95],
        [162, 65],
        [222, 65],
        [226, 99],
        [212, 84],
        [170, 84],
      ],
      maskMid,
    );
    r.polygon(
      [
        [218, 90],
        [231, 125],
        [220, 169],
        [211, 128],
      ],
      maskDark,
    );
  },
  (r) => {
    r.polygon(
      [
        [155, 100],
        [160, 67],
        [179, 56],
        [196, 65],
        [212, 55],
        [226, 75],
        [229, 107],
        [216, 90],
        [199, 96],
        [181, 85],
        [165, 105],
      ],
      maskMid,
    );
  },
  (r) => {
    r.polygon(
      [
        [158, 98],
        [164, 67],
        [220, 67],
        [226, 99],
        [211, 83],
        [173, 84],
      ],
      maskMid,
    );
    r.ellipse(192, 51, 20, 18, maskMid);
  },
  (r) =>
    r.polygon(
      [
        [157, 101],
        [162, 67],
        [223, 65],
        [228, 101],
        [212, 85],
        [198, 104],
        [184, 82],
        [168, 104],
      ],
      maskMid,
    ),
  (r) => {
    r.polygon(
      [
        [156, 98],
        [161, 63],
        [223, 63],
        [229, 101],
        [215, 88],
        [169, 88],
      ],
      maskMid,
    );
    r.polygon(
      [
        [158, 91],
        [171, 104],
        [169, 171],
        [157, 150],
      ],
      maskDark,
    );
    r.polygon(
      [
        [226, 91],
        [213, 104],
        [215, 171],
        [227, 150],
      ],
      maskDark,
    );
  },
];
hairShapes.forEach((shape, index) =>
  save(`hair-${index + 1}.png`, (raster) => {
    shape(raster);
    raster.rect(174, 67, 35, 7, maskLight);
  }),
);

for (const model of ["male", "female"]) {
  const shift = model === "male" ? 0 : 3;
  save(`armour-heavy-${model}.png`, (raster) => {
    raster.polygon(
      [
        [126 + shift, 150],
        [155, 137],
        [192, 148],
        [229, 137],
        [258 - shift, 150],
        [239, 181],
        [229, 217],
        [155, 217],
        [145, 181],
      ],
      maskDark,
    );
    raster.polygon(
      [
        [145, 151],
        [172, 143],
        [192, 156],
        [212, 143],
        [239, 151],
        [224, 205],
        [160, 205],
      ],
      maskMid,
    );
    raster.rect(179, 158, 26, 48, maskLight);
    raster.polygon(
      [
        [153, 211],
        [188, 211],
        [181, 290],
        [153, 290],
      ],
      maskMid,
    );
    raster.polygon(
      [
        [196, 211],
        [231, 211],
        [231, 290],
        [203, 290],
      ],
      maskMid,
    );
    raster.rect(149, 283, 36, 17, maskDark);
    raster.rect(199, 283, 36, 17, maskDark);
  });
  save(`armour-light-${model}.png`, (raster) => {
    raster.polygon(
      [
        [143 + shift, 151],
        [170, 142],
        [192, 150],
        [214, 142],
        [241 - shift, 151],
        [226, 218],
        [158, 218],
      ],
      maskDark,
    );
    raster.polygon(
      [
        [155, 154],
        [181, 148],
        [192, 161],
        [203, 148],
        [229, 154],
        [216, 207],
        [168, 207],
      ],
      maskMid,
    );
    raster.polygon(
      [
        [157, 211],
        [187, 211],
        [180, 289],
        [157, 289],
      ],
      maskMid,
    );
    raster.polygon(
      [
        [197, 211],
        [227, 211],
        [227, 289],
        [204, 289],
      ],
      maskMid,
    );
    raster.rect(153, 285, 31, 15, maskDark);
    raster.rect(200, 285, 31, 15, maskDark);
  });
}

save("sword-back.png", (raster) => {
  raster.polygon(
    [
      [233, 234],
      [244, 238],
      [316, 86],
      [309, 67],
      [296, 82],
    ],
    maskDark,
  );
  raster.polygon(
    [
      [239, 227],
      [244, 229],
      [309, 88],
      [306, 82],
    ],
    maskLight,
  );
});
save("sword-front.png", (raster) => {
  raster.polygon(
    [
      [218, 226],
      [222, 218],
      [255, 233],
      [251, 242],
    ],
    maskDark,
  );
  raster.rect(232, 232, 10, 38, maskMid);
  raster.ellipse(237, 274, 10, 10, maskLight);
});

const white = rgba("#ffffff");
save("mask-body-male.png", (raster) => raster.rect(126, 55, 132, 245, white));
save("mask-body-female.png", (raster) => raster.rect(132, 55, 120, 245, white));
save("mask-face.png", (raster) => raster.rect(158, 75, 68, 61, white));
save("mask-hair.png", (raster) => raster.rect(145, 35, 94, 139, white));
save("mask-neck-seam.png", (raster) => raster.rect(177, 132, 30, 26, white));
save("mask-grip-socket.png", (raster) => raster.rect(218, 211, 39, 71, white));
save("mask-weapon.png", (raster) => raster.rect(205, 45, 125, 247, white));

console.log(`Built reference avatar PNGs in ${OUT}`);
