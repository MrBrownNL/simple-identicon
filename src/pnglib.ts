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
    private width: number
    private height: number
    private depth: number
    private pix_size = 0
    private data_size = 0
    private ihdr_offs = 0
    private ihdr_size = 0
    private plte_offs = 0
    private plte_size = 0
    private trns_offs = 0
    private trns_size = 0
    private idat_offs = 0
    private idat_size = 0
    private iend_offs = 0
    private iend_size = 0
    private buffer_size = 0
    private buffer: string[] = []
    private palette: string[] = []
    private pindex = 0
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
            if (this.pindex == this.depth) return "\x00";

            const ndx = this.plte_offs + 8 + 3 * this.pindex;

            this.buffer[ndx] = String.fromCharCode(red);
            this.buffer[ndx + 1] = String.fromCharCode(green);
            this.buffer[ndx + 2] = String.fromCharCode(blue);
            this.buffer[this.trns_offs+8+this.pindex] = String.fromCharCode(alpha);

            this.palette[color] = String.fromCharCode(this.pindex++);
        }
        return this.palette[color];
    }

    // output a PNG string, Base64 encoded
    public getBase64(): string {

        const s = this.getDump();

        var ch = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
        var c1, c2, c3, e1, e2, e3, e4;
        var l = s.length;
        var i = 0;
        var r = "";

        do {
            c1 = s.charCodeAt(i);
            e1 = c1 >> 2;
            c2 = s.charCodeAt(i+1);
            e2 = ((c1 & 3) << 4) | (c2 >> 4);
            c3 = s.charCodeAt(i+2);
            if (l < i+2) { e3 = 64; } else { e3 = ((c2 & 0xf) << 2) | (c3 >> 6); }
            if (l < i+3) { e4 = 64; } else { e4 = c3 & 0x3f; }
            r+= ch.charAt(e1) + ch.charAt(e2) + ch.charAt(e3) + ch.charAt(e4);
        } while ((i+= 3) < l);
        return r;
    }

    private init() {
        // pixel data and row filter identifier size
        this.pix_size = this.height * (this.width + 1);

        // deflate header, pix_size, block headers, adler32 checksum
        this.data_size = 2 + this.pix_size + 5 * Math.floor((0xfffe + this.pix_size) / 0xffff) + 4;

        // offsets and sizes of Png chunks
        this.ihdr_offs = 0; // IHDR offset and size
        this.ihdr_size = 4 + 4 + 13 + 4;
        this.plte_offs = this.ihdr_offs + this.ihdr_size; // PLTE offset and size
        this.plte_size = 4 + 4 + 3 * this.depth + 4;
        this.trns_offs = this.plte_offs + this.plte_size; // tRNS offset and size
        this.trns_size = 4 + 4 + this.depth + 4;
        this.idat_offs = this.trns_offs + this.trns_size; // IDAT offset and size
        this.idat_size = 4 + 4 + this.data_size + 4;
        this.iend_offs = this.idat_offs + this.idat_size; // IEND offset and size
        this.iend_size = 4 + 4 + 4;
        this.buffer_size  = this.iend_offs + this.iend_size; // total PNG size

        this._crc32 = [];

        // initialize buffer with zero bytes
        for (var i = 0; i < this.buffer_size; i++) {
            this.buffer[i] = "\x00";
        }

        // initialize non-zero elements
        PngLib.write(this.buffer, this.ihdr_offs, PngLib.byte4(this.ihdr_size - 12), 'IHDR', PngLib.byte4(this.width), PngLib.byte4(this.height), "\x08\x03");
        PngLib.write(this.buffer, this.plte_offs, PngLib.byte4(this.plte_size - 12), 'PLTE');
        PngLib.write(this.buffer, this.trns_offs, PngLib.byte4(this.trns_size - 12), 'tRNS');
        PngLib.write(this.buffer, this.idat_offs, PngLib.byte4(this.idat_size - 12), 'IDAT');
        PngLib.write(this.buffer, this.iend_offs, PngLib.byte4(this.iend_size - 12), 'IEND');

        // initialize deflate header
        let header = ((8 + (7 << 4)) << 8) | (3 << 6);
        header += 31 - (header % 31);

        PngLib.write(this.buffer, this.idat_offs + 8, PngLib.byte2(header));

        // initialize deflate block headers
        for (i = 0; (i << 16) - 1 < this.pix_size; i++) {
            var size, bits;
            if (i + 0xffff < this.pix_size) {
                size = 0xffff;
                bits = "\x00";
            } else {
                size = this.pix_size - (i << 16) - i;
                bits = "\x01";
            }
            PngLib.write(this.buffer, this.idat_offs + 8 + 2 + (i << 16) + (i << 2), bits, PngLib.byte2lsb(size), PngLib.byte2lsb(~size));
        }

        /* Create crc32 lookup table */
        for (i = 0; i < 256; i++) {
            var c = i;
            for (var j = 0; j < 8; j++) {
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
    private static write(buffer: Array<string> = [], offs: number, ...rest: string[]) {
        for (var i = 2; i < arguments.length; i++) {
            for (var j = 0; j < arguments[i].length; j++) {
                buffer[offs++] = arguments[i].charAt(j);
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
        return this.idat_offs + 8 + 2 + 5 * Math.floor((i / 0xffff) + 1) + i;
    }

    // output a PNG string
    private getDump() {
        // compute adler32 of output pixels + row filter bytes
        const BASE = 65521; /* largest prime smaller than 65536 */
        const NMAX = 5552; /* NMAX is the largest n such that 255n(n+1)/2 + (n+1)(BASE-1) <= 2^32-1 */
        let s1 = 1;
        let s2 = 0;
        let n = NMAX;

        for (var y = 0; y < this.height; y++) {
            for (var x = -1; x < this.width; x++) {
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
        PngLib.write(this.buffer, this.idat_offs + this.idat_size - 8, PngLib.byte4((s2 << 16) | s1));


        this.crc32(this.buffer, this.ihdr_offs, this.ihdr_size);
        this.crc32(this.buffer, this.plte_offs, this.plte_size);
        this.crc32(this.buffer, this.trns_offs, this.trns_size);
        this.crc32(this.buffer, this.idat_offs, this.idat_size);
        this.crc32(this.buffer, this.iend_offs, this.iend_size);

        // convert PNG to string
        return "\x89PNG\r\n\x1a\n" + this.buffer.join('');
    }

    // compute crc32 of the PNG chunks
    private crc32(png: string[], offs: number, size: number) {
        var crc = -1;
        for (var i = 4; i < size-4; i += 1) {
            crc = this._crc32[(crc ^ png[offs+i].charCodeAt(0)) & 0xff] ^ ((crc >> 8) & 0x00ffffff);
        }
        PngLib.write(png, offs+size-4, PngLib.byte4(crc ^ -1));
    }
}
