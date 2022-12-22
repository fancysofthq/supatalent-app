import { CID } from "multiformats/cid";
import * as Web3Auth from "@fancysofthq/supa-app/services/Web3Auth";
import { useEth } from "@fancysofthq/supa-app/services/eth";
import { CarReader, CarWriter } from "@ipld/car";
import { iteratorToBuffer } from "@fancysofthq/supa-app/utils/iterable";
import { Address, Bytes } from "@fancysofthq/supabase";
import * as server from "@fancysofthq/supatalent-api/server";

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

export async function getTalents(from?: Address): Promise<server.Talent[]> {
  const requestUrl = new URL(
    new URL(import.meta.env.VITE_API_URL) + "v1/talents"
  );
  if (from) requestUrl.searchParams.set("from", from.toString());

  const dtos = await (await fetch(requestUrl)).json();
  return Promise.all(
    dtos.map((dto: any) => getTalent(server.TalentId.fromJSON(dto).cid))
  );
}

export async function getTalent(cid: CID): Promise<server.Talent> {
  const dto = await (
    await fetch(
      new URL(import.meta.env.VITE_API_URL) + "v1/talents/" + cid.toString()
    )
  ).json();

  return server.Talent.fromJSON(dto);
}

export async function getTalentListings(
  talentCid: CID
): Promise<server.Listing[]> {
  const url = new URL(new URL(import.meta.env.VITE_API_URL) + "v1/listings");
  url.searchParams.set("talentCid", talentCid.toString());

  const dtos = await (await fetch(url)).json();

  return Promise.all(
    dtos.map((dto: any) => getListing(server.ListingId.fromJSON(dto).id))
  );
}

export async function getTalentHistory(
  talentCid: CID
): Promise<server.Event[]> {
  const dtos = await (
    await fetch(
      new URL(import.meta.env.VITE_API_URL) +
        "v1/talents/" +
        talentCid.toString() +
        "/history"
    )
  ).json();

  return dtos.map((dto: any) => server.Event.fromJSON(dto));
}

export async function getListing(
  listingId: Bytes<32>
): Promise<server.Listing> {
  const dto = await (
    await fetch(
      new URL(import.meta.env.VITE_API_URL) +
        "v1/listings/" +
        listingId.toString()
    )
  ).json();

  return server.Listing.fromJSON(dto);
}

export async function getAccountTalentBalance(
  account: Address,
  talentCid: CID
): Promise<server.TalentBalance> {
  const url = new URL(
    new URL(import.meta.env.VITE_API_URL) +
      "v1/accounts/" +
      account.toString() +
      "/talentBalance/" +
      talentCid.toString()
  );

  const dto = await (await fetch(url)).json();

  return server.TalentBalance.fromJSON(dto);
}

export async function accountActivity(
  account: Address
): Promise<server.Event[]> {
  const dtos = await (
    await fetch(
      new URL(import.meta.env.VITE_API_URL) +
        "v1/accounts/" +
        account.toString() +
        "/activity"
    )
  ).json();

  return dtos.map((dto: any) => server.Event.fromJSON(dto));
}
