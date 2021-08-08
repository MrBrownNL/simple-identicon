import {PngLib} from './pnglib'

export function generate(seed: string): string {
    const generator = new PngLib(100,100,16)
    return generator.getBase64()
}
