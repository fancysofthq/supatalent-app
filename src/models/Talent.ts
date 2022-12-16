import {
  Blockifiable,
  Blockstore,
} from "@fancysofthq/supa-app/services/Web3Storage";
import { CID } from "multiformats/cid";
import { encode as encodeBlock, Block } from "multiformats/block";
import * as raw from "multiformats/codecs/raw";
import { sha256 } from "multiformats/hashes/sha2";
import { toIpfsUri, gatewayize } from "@fancysofthq/supa-app/services/ipfs";
import * as dagCbor from "@ipld/dag-cbor";
import * as dagPb from "@ipld/dag-pb";
import { markRaw, Ref, ref, ShallowRef } from "vue";
import { Account } from "@fancysofthq/supa-app/models/Account";
import { nanoid } from "nanoid";
import * as UnixFS from "@ipld/unixfs";
import { BigNumber } from "ethers";

async function read<T>(readable: ReadableStream<T>): Promise<T[]> {
  const chunks: T[] = [];
  const reader = readable.getReader();
  let { done, value } = await reader.read();

  while (!done) {
    chunks.push(value!);
    ({ done, value } = await reader.read());
  }

  return chunks;
}

export type Metadata = {
  name: string;
  description: string;
  image: URL | File | string;
  properties: {
    tags: string[];
    unit: string;
    content: string;
    location?: string;
  };
};

export type Chaindata = {
  createdAt: Date;
  royalty: number;
  finalized: boolean;
  expiredAt: Date;
  editions: number;
};

export class Talent implements Blockifiable {
  static memo = new Map<string, Talent>();

  static getOrCreate(
    cid: CID,
    author: Account,
    balance: Ref<BigNumber | undefined> = ref(undefined),
    metadata?: Metadata,
    chaindata?: Chaindata,
    resolve: boolean = false
  ): Talent {
    if (!this.memo.has(cid.toString())) {
      const talent = markRaw(
        new Talent(cid, author, balance, ref(metadata), ref(chaindata))
      );
      if (resolve) talent.resolve();
      this.memo.set(cid.toString(), talent);
    }

    return this.memo.get(cid.toString())!;
  }

  constructor(
    public readonly cid: CID,
    public readonly author: Account,
    public readonly balance: Ref<BigNumber | undefined>,
    public readonly metadata: Ref<Metadata | undefined>,
    public readonly chaindata: Ref<Chaindata | undefined>
  ) {}

  async resolve(): Promise<void> {
    await Promise.all([this.resolveMetadata()]);
  }

  async resolveMetadata(): Promise<void> {
    const metadataUrl = gatewayize(
      toIpfsUri(this.cid) + "metadata.json",
      "w3s.link"
    );

    this.metadata.value = await (await fetch(metadataUrl)).json();
  }

  get imageUrl(): URL | undefined {
    if (!this.metadata.value?.image) return undefined;

    if (this.metadata.value.image instanceof URL)
      return gatewayize(this.metadata.value.image, "w3s.link");

    if (this.metadata.value.image instanceof File)
      return new URL(URL.createObjectURL(this.metadata.value.image));

    return gatewayize(new URL(this.metadata.value.image), "w3s.link");
  }

  async blockify(): Promise<{
    json: Metadata;
    blockstore: Blockstore;
  }> {
    if (!this.metadata.value) throw new Error("Expected metadata to be set");

    if (!(this.metadata.value.image instanceof File))
      throw new Error("Expected image to be a File");

    const { readable, writable } = new TransformStream();
    const writer = UnixFS.createWriter({ writable });
    const rawBlocks = read<{ cid: CID; bytes: Uint8Array }>(readable);

    const imgFile = UnixFS.createFileWriter(writer);
    imgFile.write(
      new Uint8Array(await this.metadata.value.image.arrayBuffer())
    );
    const imgFileLink = await imgFile.close();

    const dir = UnixFS.createDirectoryWriter(writer);
    dir.set(this.metadata.value.image.name, imgFileLink);
    const dirLink = await dir.close();

    await writer.close();

    const blocks = (await rawBlocks).map(
      (block) => new Block({ cid: block.cid, bytes: block.bytes, value: null })
    );

    const json: Metadata = JSON.parse(JSON.stringify(this.metadata.value));
    json.image = toIpfsUri(dirLink.cid as CID) + this.metadata.value.image.name;

    return {
      json,
      blockstore: new Blockstore(dirLink.cid as CID, blocks),
    };
  }
}
