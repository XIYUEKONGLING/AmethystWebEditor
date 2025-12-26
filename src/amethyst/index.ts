import { ByteReader, ByteWriter } from './io';
import { TagCompound } from './tags';
import { TagType } from './types';

export * from './tags';
export * from './io';
export * from './types';

export class TagIO {
    /**
     * Reads a root TagCompound from a buffer.
     * @param buffer The input buffer (ArrayBuffer or Uint8Array).
     * @param isNetworkPacket
     * If true, adheres to 1.20.2+ Network NBT spec (Root Compound has no name).
     * If false, adheres to Disk/Standard spec (Root Compound has name).
     */
    public static read(buffer: ArrayBuffer | Uint8Array, isNetworkPacket: boolean = false): TagCompound {
        const stream = new ByteReader(buffer);

        const typeId = stream.readByte();
        if (typeId !== TagType.Compound) {
            throw new Error(`Root tag must be a TAG_Compound (ID 10), found ID ${typeId}.`);
        }

        const root = new TagCompound();

        if (!isNetworkPacket) {
            // Standard NBT: Read Root Name
            const nameLen = stream.readUShort();
            if (nameLen > 0) {
                const nameBytes = stream.readBytes(nameLen);
                root.name = new TextDecoder().decode(nameBytes);
            } else {
                root.name = "";
            }
        } else {
            // Network NBT: No name
            root.name = "";
        }

        root.readPayload(stream);
        return root;
    }

    /**
     * Writes a root TagCompound to a Uint8Array.
     */
    public static write(tag: TagCompound, isNetworkPacket: boolean = false): Uint8Array {
        const stream = new ByteWriter();

        // Write ID
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
