import { ByteReader, ByteWriter } from './io';

const SEGMENT_BITS = 0x7F;
const CONTINUE_BIT = 0x80;

export const TagType = {
    End: 0,
    Byte: 1,
    Short: 2,
    Int: 3,
    Long: 4,
    Float: 5,
    Double: 6,
    ByteArray: 7,
    String: 8,
    List: 9,
    Compound: 10,
    IntArray: 11,
    LongArray: 12
} as const;

export type TagType = typeof TagType[keyof typeof TagType];

export const TVarInt = {
    read(stream: ByteReader): number {
        let value = 0;
        let position = 0;

        while (true) {
            const currentByte = stream.readByte();
            value |= (currentByte & SEGMENT_BITS) << position;

            if ((currentByte & CONTINUE_BIT) === 0) break;

            position += 7;
            if (position >= 32) throw new Error("VarInt is too big.");
        }
        return value;
    },

    write(stream: ByteWriter, value: number): void {
        let v = value >>> 0;
        while (true) {
            if ((v & ~SEGMENT_BITS) === 0) {
                stream.writeUByte(v);
                return;
            }
            stream.writeUByte((v & SEGMENT_BITS) | CONTINUE_BIT);
            v >>>= 7;
        }
    }
};

export const TVarLong = {
    read(stream: ByteReader): bigint {
        let value = 0n;
        let position = 0n;

        while (true) {
            const byteRead = stream.readByte();
            const currentByte = BigInt(byteRead);

            value |= (currentByte & BigInt(SEGMENT_BITS)) << position;

            if ((currentByte & BigInt(CONTINUE_BIT)) === 0n) break;

            position += 7n;
            if (position >= 64n) throw new Error("VarLong is too big.");
        }
        return value;
    },

    write(stream: ByteWriter, value: bigint): void {
        let v = value;
        const segmentBits = 0x7Fn;
        const continueBit = 0x80n;

        while (true) {
            if ((v & ~segmentBits) === 0n) {
                stream.writeUByte(Number(v));
                return;
            }
            stream.writeUByte(Number((v & segmentBits) | continueBit));
            v >>= 7n;
        }
    }
};
