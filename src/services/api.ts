import { CID } from "multiformats/cid";
import * as Web3Auth from "@fancysofthq/supa-app/services/Web3Auth";
import { useEth } from "@fancysofthq/supa-app/services/eth";
import { CarReader, CarWriter } from "@ipld/car";
import { iteratorToBuffer } from "@fancysofthq/supa-app/utils/iterable";
import { Address } from "@fancysofthq/supa-app/services/eth/Address";
import { BigNumber } from "ethers";

export type ShortTalentDTO = {
  cid: string;
};

export type TalentDTO = {
  cid: string;
  createdAt: number; // Timestamp in
  author: string;
  royalty: number; // 0-1

  // Dynamic info
  finalized: boolean;
  expiredAt: number; // Timestamp in seconds
  editions: number; // TODO: BigNumber
};

export type BasicEventDTO = {
  blockNumber: number;
  logIndex: number;
  timestamp: number; // In seconds
  txHash: string;
};

export type EventMintDTO = BasicEventDTO & {
  type: "mint";
  author: string; // Address
  amount: string; // BigNumber hex
};

export type EventListDTO = BasicEventDTO & {
  type: "list";
  listingId: string; // BigNumber hex
  seller: string; // Address
  amount: string; // BigNumber hex
  price: string; // BigNumber hex
};

export type EventPurchaseDTO = BasicEventDTO & {
  type: "purchase";
  listingId: string; // BigNumber hex
  buyer: string; // Address
  tokenAmount: string; // BigNumber hex
  income: string; // BigNumber hex
};

export type EventTransferDTO = BasicEventDTO & {
  type: "transfer";
  from: string; // Address
  to: string; // Address
  value: string; // BigNumber hex
};

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
  createdAt: Date;
  author: Address;
  royalty: number;
  finalized: boolean;
  expiredAt: Date;
  editions: number;
};

export async function getTalents(from?: Address): Promise<Talent[]> {
  const requestUrl = new URL(
    new URL(import.meta.env.VITE_API_URL) + "v1/talents"
  );
  if (from) requestUrl.searchParams.set("from", from.toString());

  const dtos: ShortTalentDTO[] = await (await fetch(requestUrl)).json();
  return Promise.all(dtos.map(async (dto) => getTalent(CID.parse(dto.cid))));
}

export async function getTalent(cid: CID): Promise<Talent> {
  const dto: TalentDTO = await (
    await fetch(
      new URL(import.meta.env.VITE_API_URL) + "v1/talents/" + cid.toString()
    )
  ).json();

  return {
    cid: CID.parse(dto.cid),
    createdAt: new Date(dto.createdAt * 1000),
    author: new Address(dto.author),
    royalty: dto.royalty,
    finalized: dto.finalized,
    expiredAt: new Date(dto.expiredAt * 1000),
    editions: dto.editions,
  };
}

export type Listing = {
  id: BigNumber;
  seller: Address;
  token: {
    contract: Address;
    id: BigNumber;
  };
  stockSize: BigNumber;
  price: BigNumber;
};

type BaseEvent = {
  timestamp: number;
  txHash: string;
};

export type List = BaseEvent & {
  type: "list";
  listingId: BigNumber;
  seller: Address;
  amount: BigNumber;
  price: BigNumber;
};

export type Mint = BaseEvent & {
  type: "mint";
  author: Address;
  amount: BigNumber;
};

export type Purchase = BaseEvent & {
  type: "purchase";
  listingId: BigNumber;
  buyer: Address;
  tokenAmount: BigNumber;
  income: BigNumber;
};

export type Transfer = BaseEvent & {
  type: "transfer";
  from: Address;
  to: Address;
  value: BigNumber;
};

export type ShortListingDTO = {
  id: string;
};

export type ListingDTO = {
  id: string; // BigNumber hex
  seller: string;
  token: {
    contract: string;
    id: string; // BigNumber hex
  };
  stockSize: string; // BigNumber hex
  price: string; // BigNumber hex
};

export async function getTalentListings(talentCid: CID): Promise<Listing[]> {
  const url = new URL(new URL(import.meta.env.VITE_API_URL) + "v1/listings");
  url.searchParams.set("talentCid", talentCid.toString());
  const dtos: ShortListingDTO[] = await (await fetch(url)).json();
  return Promise.all(dtos.map((dto) => getListing(BigNumber.from(dto.id))));
}

export async function getTalentHistory(
  talentCid: CID
): Promise<(List | Mint | Purchase | Transfer)[]> {
  const dtos: (
    | EventListDTO
    | EventMintDTO
    | EventPurchaseDTO
    | EventTransferDTO
  )[] = await (
    await fetch(
      new URL(import.meta.env.VITE_API_URL) +
        "v1/talents/" +
        talentCid.toString() +
        "/history"
    )
  ).json();

  return dtos.map((dto) => {
    switch (dto.type) {
      case "list":
        return {
          type: "list",
          timestamp: dto.timestamp,
          txHash: dto.txHash,
          listingId: BigNumber.from(dto.listingId),
          seller: new Address(dto.seller),
          amount: BigNumber.from(dto.amount),
          price: BigNumber.from(dto.price),
        };
      case "mint":
        return {
          type: "mint",
          timestamp: dto.timestamp,
          txHash: dto.txHash,
          author: new Address(dto.author),
          amount: BigNumber.from(dto.amount),
        };
      case "purchase":
        return {
          type: "purchase",
          timestamp: dto.timestamp,
          txHash: dto.txHash,
          listingId: BigNumber.from(dto.listingId),
          buyer: new Address(dto.buyer),
          tokenAmount: BigNumber.from(dto.tokenAmount),
          income: BigNumber.from(dto.income),
        };
      case "transfer":
        return {
          type: "transfer",
          timestamp: dto.timestamp,
          txHash: dto.txHash,
          from: new Address(dto.from),
          to: new Address(dto.to),
          value: BigNumber.from(dto.value),
        };
    }
  });
}

export async function getListing(listingId: BigNumber): Promise<Listing> {
  const dto: ListingDTO = await (
    await fetch(
      new URL(import.meta.env.VITE_API_URL) +
        "v1/listings/" +
        listingId.toString()
    )
  ).json();

  return {
    id: BigNumber.from(dto.id),
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
  const dtos: (EventListDTO | EventPurchaseDTO | EventTransferDTO)[] = await (
    await fetch(
      new URL(import.meta.env.VITE_API_URL) +
        "v1/accounts/" +
        account.toString() +
        "/activity"
    )
  ).json();

  return dtos.map((dto) => {
    switch (dto.type) {
      case "list":
        return {
          type: "list",
          timestamp: dto.timestamp,
          txHash: dto.txHash,
          listingId: BigNumber.from(dto.listingId),
          seller: new Address(dto.seller),
          amount: BigNumber.from(dto.amount),
          price: BigNumber.from(dto.price),
        };
      case "purchase":
        return {
          type: "purchase",
          timestamp: dto.timestamp,
          txHash: dto.txHash,
          listingId: BigNumber.from(dto.listingId),
          buyer: new Address(dto.buyer),
          tokenAmount: BigNumber.from(dto.tokenAmount),
          income: BigNumber.from(dto.income),
        };
      case "transfer":
        return {
          type: "transfer",
          timestamp: dto.timestamp,
          txHash: dto.txHash,
          from: new Address(dto.from),
          to: new Address(dto.to),
          value: BigNumber.from(dto.value),
        };
    }
  });
}
