import { CID } from "multiformats/cid";
import * as Web3Auth from "@fancysofthq/supa-app/services/Web3Auth";
import { useEth } from "@fancysofthq/supa-app/services/eth";
import { CarReader, CarWriter } from "@ipld/car";
import { iteratorToBuffer } from "@fancysofthq/supa-app/utils/iterable";
import { BigNumber } from "ethers";
import { Address, Bytes, Hash } from "@fancysofthq/supa-app/models/Bytes";

async function jwt(): Promise<string> {
  const { provider, account } = useEth();

  return await Web3Auth.ensureAuth(
    provider.value!,
    `authjwt.${account.value!.address.value!.toString()}`,
    {
      expiresIn: "7d",
      statement: "Please sign this message to authenticate with the API server",
      domain: import.meta.env.DEV
        ? undefined
        : new URL(import.meta.env.VITE_API_URL).hostname,
    },
    async (signature) => {
      const response = await fetch(
        new URL(import.meta.env.VITE_API_URL) + "v1/auth",
        {
          method: "POST",
          headers: {
            Authorization: `Web3-Token ${signature}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to authenticate");
      } else {
        return response.text();
      }
    }
  );
}

export async function storeTalentCar(
  file: CarReader,
  tx: string
): Promise<CID> {
  const { writer: carWriter, out } = CarWriter.create(await file.getRoots());
  const buffer = iteratorToBuffer(out);

  for await (const block of file.blocks()) {
    await carWriter.put(block);
  }

  await carWriter.close();

  const request = new Request(
    new URL(import.meta.env.VITE_API_URL) + "v1/storeTalentCar",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await jwt()}`,
        "Content-Type": "application/vnd.ipld.car",
        "X-Web3-Tx": tx,
      },
      body: await buffer,
    }
  );

  const response = await fetch(request);

  if (!response.ok) {
    throw new Error("Failed to store Talent CAR");
  }

  return CID.parse(await response.text());
}

export type Talent = {
  cid: CID;
  claimEvent: {
    blockNumber: number;
    logIndex: number;
    txHash: Hash;
  };
  author: Address;
  royalty: number;
  finalized: boolean;
  expiredAt: Date;
  editions: BigNumber;
};

export async function getTalents(from?: Address): Promise<Talent[]> {
  const requestUrl = new URL(
    new URL(import.meta.env.VITE_API_URL) + "v1/talents"
  );
  if (from) requestUrl.searchParams.set("from", from.toString());

  const dtos: { cid: string }[] = await (await fetch(requestUrl)).json();
  return Promise.all(dtos.map(async (dto) => getTalent(CID.parse(dto.cid))));
}

export async function getTalent(cid: CID): Promise<Talent> {
  const dto: {
    cid: string;
    author: string;
    claimEvent: {
      blockNumber: number;
      logIndex: number;
      txHash: string;
    };
    royalty: number;
    finalized: boolean;
    expiredAt: number;
    editions: string;
  } = await (
    await fetch(
      new URL(import.meta.env.VITE_API_URL) + "v1/talents/" + cid.toString()
    )
  ).json();

  return {
    cid: CID.parse(dto.cid),
    claimEvent: {
      blockNumber: dto.claimEvent.blockNumber,
      logIndex: dto.claimEvent.logIndex,
      txHash: new Hash(dto.claimEvent.txHash),
    },
    author: new Address(dto.author),
    royalty: dto.royalty,
    finalized: dto.finalized,
    expiredAt: new Date(dto.expiredAt * 1000),
    editions: BigNumber.from(dto.editions),
  };
}

export type Listing = {
  id: Bytes<32>;
  seller: Address;
  token: {
    contract: Address;
    id: BigNumber;
  };
  stockSize: BigNumber;
  price: BigNumber;
};

type BaseEvent = {
  blockNumber: number;
  logIndex: number;
  txHash: Hash;
};

export type List = BaseEvent & {
  type: "talent_list";
  listingId: Bytes<32>;
  seller: Address;
  price: BigNumber;
  stockSize: BigNumber;
};

export type Mint = BaseEvent & {
  type: "talent_mint";
  operator: Address;
  to: Address;
  value: BigNumber;
};

export type Purchase = BaseEvent & {
  type: "talent_purchase";
  listingId: Bytes<32>;
  buyer: Address;
  tokenAmount: BigNumber;
  income: BigNumber;
};

export type Transfer = BaseEvent & {
  type: "talent_transfer";
  from: Address;
  to: Address;
  value: BigNumber;
};

export async function getTalentListings(talentCid: CID): Promise<Listing[]> {
  const url = new URL(new URL(import.meta.env.VITE_API_URL) + "v1/listings");
  url.searchParams.set("talentCid", talentCid.toString());
  const dtos: { id: string }[] = await (await fetch(url)).json();
  return Promise.all(dtos.map((dto) => getListing(new Bytes<32>(dto.id))));
}

export async function getTalentHistory(
  talentCid: CID
): Promise<(List | Mint | Purchase | Transfer)[]> {
  const dtos = await (
    await fetch(
      new URL(import.meta.env.VITE_API_URL) +
        "v1/talents/" +
        talentCid.toString() +
        "/history"
    )
  ).json();

  return dtos.map((dto: any): List | Mint | Purchase | Transfer => {
    switch (dto.type) {
      case "talent_list":
        return {
          blockNumber: dto.blockNumber,
          logIndex: dto.logIndex,
          txHash: dto.txHash,
          type: "talent_list",
          listingId: new Bytes<32>(dto.listingId),
          seller: new Address(dto.seller),
          price: BigNumber.from(dto.price),
          stockSize: BigNumber.from(dto.stockSize),
        };
      case "talent_mint":
        return {
          blockNumber: dto.blockNumber,
          logIndex: dto.logIndex,
          txHash: dto.txHash,
          type: "talent_mint",
          operator: new Address(dto.operator),
          to: new Address(dto.to),
          value: BigNumber.from(dto.value),
        };
      case "talent_purchase":
        return {
          blockNumber: dto.blockNumber,
          logIndex: dto.logIndex,
          txHash: dto.txHash,
          type: "talent_purchase",
          listingId: new Bytes<32>(dto.listingId),
          buyer: new Address(dto.buyer),
          tokenAmount: BigNumber.from(dto.tokenAmount),
          income: BigNumber.from(dto.income),
        };
      case "talent_transfer":
        return {
          blockNumber: dto.blockNumber,
          logIndex: dto.logIndex,
          txHash: dto.txHash,
          type: "talent_transfer",
          from: new Address(dto.from),
          to: new Address(dto.to),
          value: BigNumber.from(dto.value),
        };
      default:
        throw new Error("Unknown event type");
    }
  });
}

export async function getListing(listingId: Bytes<32>): Promise<Listing> {
  const dto = await (
    await fetch(
      new URL(import.meta.env.VITE_API_URL) +
        "v1/listings/" +
        listingId.toString()
    )
  ).json();

  return {
    id: new Bytes<32>(dto.id),
    seller: new Address(dto.seller),
    token: {
      contract: new Address(dto.token.contract),
      id: BigNumber.from(dto.token.id),
    },
    stockSize: BigNumber.from(dto.stockSize),
    price: BigNumber.from(dto.price),
  };
}

export async function getAccountTalentBalance(
  account: Address,
  talentCid: CID
): Promise<BigNumber> {
  const url = new URL(
    new URL(import.meta.env.VITE_API_URL) +
      "v1/accounts/" +
      account.toString() +
      "/talentBalance/" +
      talentCid.toString()
  );

  return BigNumber.from(await (await fetch(url)).text());
}

export async function accountActivity(
  account: Address
): Promise<(List | Purchase | Transfer)[]> {
  const dtos = await (
    await fetch(
      new URL(import.meta.env.VITE_API_URL) +
        "v1/accounts/" +
        account.toString() +
        "/activity"
    )
  ).json();

  return dtos.map((dto: any): List | Purchase | Transfer => {
    switch (dto.type) {
      case "talent_list":
        return {
          blockNumber: dto.blockNumber,
          logIndex: dto.logIndex,
          txHash: dto.txHash,
          type: "talent_list",
          listingId: new Bytes<32>(dto.listingId),
          seller: new Address(dto.seller),
          price: BigNumber.from(dto.price),
          stockSize: BigNumber.from(dto.stockSize),
        };
      case "talent_purchase":
        return {
          blockNumber: dto.blockNumber,
          logIndex: dto.logIndex,
          txHash: dto.txHash,
          type: "talent_purchase",
          listingId: new Bytes<32>(dto.listingId),
          buyer: account,
          tokenAmount: BigNumber.from(dto.tokenAmount),
          income: BigNumber.from(dto.income),
        };
      case "talent_transfer":
        return {
          blockNumber: dto.blockNumber,
          logIndex: dto.logIndex,
          txHash: dto.txHash,
          type: "talent_transfer",
          from: new Address(dto.from),
          to: new Address(dto.to),
          value: BigNumber.from(dto.value),
        };
      default:
        throw new Error("Unknown event type");
    }
  });
}
