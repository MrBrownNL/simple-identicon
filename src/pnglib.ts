/**
 * A handy class to calculate color values.
 *
 * @version 1.0
 * @author Robert Eisele <robert@xarg.org>
 * @copyright Copyright (c) 2010, Robert Eisele
 * @link http://www.xarg.org/2010/03/generate-client-side-png-files-using-javascript/
 * @license http://www.opensource.org/licenses/bsd-license.php BSD License
 *
 * Converted to modern JavaScript module by Jeroen de Bruijn <jeroen@alphega.nl>
 *
 */

export class PngLib {
    private readonly width: number
    private readonly height: number
    private readonly depth: number

    private pixelSize = 0
    private dataSize = 0
    private ihdrOffset = 0
    private ihdrSize = 0
    private plteOffset = 0
    private plteSize = 0
    private trnsOffset = 0
    private trnsSize = 0
    private idatOffset = 0
    private idatSize = 0
    private iendOffset = 0
    private iendSize = 0
    private bufferSize = 0
    private buffer: string[] = []
    private palette: string[] = []
    private paletteIndex = 0
    private _crc32: number[] = []

    public constructor(width: number,height: number,depth: number) {
        this.width = width
        this.height = height
        this.depth = depth
        this.init()
    }

    // convert a color and build up the palette
    public color(red: number, green: number, blue: number, alpha: number) {
        alpha = alpha >= 0 ? alpha : 255;
        const color = (((((alpha << 8) | red) << 8) | green) << 8) | blue;

        if (typeof this.palette[color] === "undefined") {
            if (this.paletteIndex === this.depth) return "\x00";

            const index = this.plteOffset + 8 + 3 * this.paletteIndex;

            this.buffer[index] = String.fromCharCode(red);
            this.buffer[index + 1] = String.fromCharCode(green);
            this.buffer[index + 2] = String.fromCharCode(blue);
            this.buffer[this.trnsOffset+8+this.paletteIndex] = String.fromCharCode(alpha);

            this.palette[color] = String.fromCharCode(this.paletteIndex++);
        }
        return this.palette[color];
    }

    // output a PNG string, Base64 encoded
    public getBase64(): string {
        const s = this.getDump();
        const ch = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
        const l = s.length;
        let c1: number, c2: number, c3: number, e1: number, e2: number, e3: number, e4: number;
        let i = 0;
        let r = "";

        do {
            c1 = s.charCodeAt(i);
            e1 = c1 >> 2;
            c2 = s.charCodeAt(i+1);
            e2 = ((c1 & 3) << 4) | (c2 >> 4);
            c3 = s.charCodeAt(i+2);
            if (l < i + 2) { e3 = 64; } else { e3 = ((c2 & 0xf) << 2) | (c3 >> 6); }
            if (l < i + 3) { e4 = 64; } else { e4 = c3 & 0x3f; }
            r += ch.charAt(e1) + ch.charAt(e2) + ch.charAt(e3) + ch.charAt(e4);
        } while ((i += 3) < l);

        return r;
    }

    private init() {
        // pixel data and row filter identifier size
        this.pixelSize = this.height * (this.width + 1);

        // deflate header, pixelSize, block headers, adler32 checksum
        this.dataSize = 2 + this.pixelSize + 5 * Math.floor((0xfffe + this.pixelSize) / 0xffff) + 4;

        // offsets and sizes of Png chunks
        this.ihdrOffset = 0; // IHDR offset and size
        this.ihdrSize = 4 + 4 + 13 + 4;
        this.plteOffset = this.ihdrOffset + this.ihdrSize; // PLTE offset and size
        this.plteSize = 4 + 4 + 3 * this.depth + 4;
        this.trnsOffset = this.plteOffset + this.plteSize; // tRNS offset and size
        this.trnsSize = 4 + 4 + this.depth + 4;
        this.idatOffset = this.trnsOffset + this.trnsSize; // IDAT offset and size
        this.idatSize = 4 + 4 + this.dataSize + 4;
        this.iendOffset = this.idatOffset + this.idatSize; // IEND offset and size
        this.iendSize = 4 + 4 + 4;
        this.bufferSize  = this.iendOffset + this.iendSize; // total PNG size

        this._crc32 = [];

        // initialize buffer with zero bytes
        for (let i = 0; i < this.bufferSize; i++) {
            this.buffer[i] = "\x00";
        }

        // initialize non-zero elements
        PngLib.write(this.buffer, this.ihdrOffset, PngLib.byte4(this.ihdrSize - 12), 'IHDR', PngLib.byte4(this.width), PngLib.byte4(this.height), "\x08\x03");
        PngLib.write(this.buffer, this.plteOffset, PngLib.byte4(this.plteSize - 12), 'PLTE');
        PngLib.write(this.buffer, this.trnsOffset, PngLib.byte4(this.trnsSize - 12), 'tRNS');
        PngLib.write(this.buffer, this.idatOffset, PngLib.byte4(this.idatSize - 12), 'IDAT');
        PngLib.write(this.buffer, this.iendOffset, PngLib.byte4(this.iendSize - 12), 'IEND');

        // initialize deflate header
        let header = ((8 + (7 << 4)) << 8) | (3 << 6);
        header += 31 - (header % 31);

        PngLib.write(this.buffer, this.idatOffset + 8, PngLib.byte2(header));

        // initialize deflate block headers
        for (let i = 0; (i << 16) - 1 < this.pixelSize; i++) {
            let size: number
            let bits: string

            if (i + 0xffff < this.pixelSize) {
                size = 0xffff;
                bits = "\x00";
            } else {
                size = this.pixelSize - (i << 16) - i;
                bits = "\x01";
            }
            PngLib.write(this.buffer, this.idatOffset + 8 + 2 + (i << 16) + (i << 2), bits, PngLib.byte2lsb(size), PngLib.byte2lsb(~size));
        }

        /* Create crc32 lookup table */
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let j = 0; j < 8; j++) {
                if (c & 1) {
                    c = -306674912 ^ ((c >> 1) & 0x7fffffff);
                } else {
                    c = (c >> 1) & 0x7fffffff;
                }
            }
            this._crc32[i] = c;
        }
    }

    // helper functions for that ctx
    private static write(buffer: Array<string> = [], offset: number, ...rest: string[]) {
        for (let i = 0; i < rest.length; i++) {
            for (let j = 0; j < rest[i].length; j++) {
                buffer[offset++] = rest[i].charAt(j);
            }
        }
    }

    private static byte2(w: number) {
        return String.fromCharCode((w >> 8) & 255, w & 255);
    }

    private static byte4(w: number) {
        return String.fromCharCode((w >> 24) & 255, (w >> 16) & 255, (w >> 8) & 255, w & 255);
    }

    private static byte2lsb(w: number) {
        return String.fromCharCode(w & 255, (w >> 8) & 255);
    }

    // compute the index into a png for a given pixel
    private index(x: number, y: number) {
        const i = y * (this.width + 1) + x + 1;
        return this.idatOffset + 8 + 2 + 5 * Math.floor((i / 0xffff) + 1) + i;
    }

    // output a PNG string
    private getDump() {
        // compute adler32 of output pixels + row filter bytes
        const BASE = 65521; /* largest prime smaller than 65536 */
        const NMAX = 5552; /* NMAX is the largest n such that 255n(n+1)/2 + (n+1)(BASE-1) <= 2^32-1 */
        let s1 = 1;
        let s2 = 0;
        let n = NMAX;

        for (let y = 0; y < this.height; y++) {
            for (let x = -1; x < this.width; x++) {
                s1 += this.buffer[this.index(x, y)].charCodeAt(0);
                s2 += s1;
                if ((n-= 1) == 0) {
                    s1%= BASE;
                    s2%= BASE;
                    n = NMAX;
                }
            }
        }
        s1 %= BASE;
        s2 %= BASE;
        PngLib.write(this.buffer, this.idatOffset + this.idatSize - 8, PngLib.byte4((s2 << 16) | s1));


        this.crc32(this.buffer, this.ihdrOffset, this.ihdrSize);
        this.crc32(this.buffer, this.plteOffset, this.plteSize);
        this.crc32(this.buffer, this.trnsOffset, this.trnsSize);
        this.crc32(this.buffer, this.idatOffset, this.idatSize);
        this.crc32(this.buffer, this.iendOffset, this.iendSize);

        // convert PNG to string
        return "\x89PNG\r\n\x1a\n" + this.buffer.join('');
    }

    // compute crc32 of the PNG chunks
    private crc32(png: string[], offs: number, size: number) {
        let crc = -1;
        for (let i = 4; i < size-4; i += 1) {
            crc = this._crc32[(crc ^ png[offs+i].charCodeAt(0)) & 0xff] ^ ((crc >> 8) & 0x00ffffff);
        }
        PngLib.write(png, offs+size-4, PngLib.byte4(crc ^ -1));
    }
}
