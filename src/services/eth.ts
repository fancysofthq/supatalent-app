import {
  AddEthereumChainParameter,
  useEth,
} from "@fancysofthq/supa-app/services/eth";
import { markRaw, ref, ShallowRef } from "vue";
import type { IpftRedeemable } from "contracts/IpftRedeemable";
import { IpftRedeemableFactory } from "contracts/IpftRedeemableFactory";
import type { OpenStore } from "contracts/OpenStore";
import { OpenStoreFactory } from "contracts/OpenStoreFactory";
import { Address } from "@fancysofthq/supa-app/services/eth/Address";
import { ethers, BigNumberish, BytesLike } from "ethers";

export class ListingConfig {
  constructor(
    public readonly existingListingId: BigNumberish,
    public readonly seller: string,
    public readonly app: string,
    public readonly price: BigNumberish
  ) {}

  encode(): BytesLike {
    return ethers.utils.defaultAbiCoder.encode(
      ["uint256", "address", "address", "uint256"],
      [this.existingListingId, this.seller, this.app, this.price]
    );
  }
}

const { onConnect } = useEth();

export const chain: AddEthereumChainParameter = JSON.parse(
  import.meta.env.VITE_CHAIN
);

export const talentContract: ShallowRef<IpftRedeemable | undefined> = ref();
export const openStoreContract: ShallowRef<OpenStore | undefined> = ref();
export const app = new Address(import.meta.env.VITE_APP_ADDRESS);

onConnect(async (provider) => {
  talentContract.value = markRaw(
    IpftRedeemableFactory.connect(
      import.meta.env.VITE_TALENT_ADDRESS,
      provider.getSigner()
    )
  );

  openStoreContract.value = markRaw(
    OpenStoreFactory.connect(
      import.meta.env.VITE_OPEN_STORE_ADDRESS,
      provider.getSigner()
    )
  );
});
