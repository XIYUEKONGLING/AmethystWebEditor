import { ByteReader, ByteWriter } from './io';
import { TagCompound } from './tags';
import { TagType } from './types';
import { decompress } from './compression';

export * from './tags';
export * from './io';
export * from './types';
export * from './compression';

export class TagIO {
    /**
     * Reads a root TagCompound from a buffer.
     * **Note:** This method is synchronous and assumes the data is ALREADY decompressed.
     * Use `readAsync` if you need automatic decompression.
     */
    public static read(buffer: ArrayBuffer | Uint8Array, isNetworkPacket: boolean = false): TagCompound {
        const stream = new ByteReader(buffer);

        const typeId = stream.readByte();
        if (typeId !== TagType.Compound) {
            throw new Error(`Root tag must be a TAG_Compound (ID 10), found ID ${typeId}.`);
        }

        const root = new TagCompound();

        if (!isNetworkPacket) {
            const nameLen = stream.readUShort();
            if (nameLen > 0) {
                const nameBytes = stream.readBytes(nameLen);
                root.name = new TextDecoder().decode(nameBytes);
            } else {
                root.name = "";
            }
        } else {
            root.name = "";
        }

        root.readPayload(stream);
        return root;
    }

    /**
     * Automatically detects compression (GZip/ZLib) and reads the TagCompound.
     * This is the recommended method for reading files like level.dat or region chunks.
     */
    public static async readAsync(buffer: ArrayBuffer | Uint8Array, isNetworkPacket: boolean = false): Promise<TagCompound> {
        let uint8: Uint8Array;
        if ((buffer as any) instanceof Uint8Array) {
            uint8 = buffer as Uint8Array;
        } else {
            uint8 = new Uint8Array(buffer);
        }

        const cleanData = await decompress(uint8);
        return this.read(cleanData, isNetworkPacket);
    }

    /**
     * Writes a root TagCompound to a Uint8Array.
     */
    public static write(tag: TagCompound, isNetworkPacket: boolean = false): Uint8Array {
        const stream = new ByteWriter();

        stream.writeByte(TagType.Compound);

        if (!isNetworkPacket) {
            const name = tag.name || "";
            const nameBytes = new TextEncoder().encode(name);
            stream.writeUShort(nameBytes.length);
            stream.writeBytes(nameBytes);
        }

        tag.writePayload(stream);
        return stream.toUint8Array();
    }
}
