import {
  AddEthereumChainParameter,
  useEth,
} from "@fancysofthq/supa-app/services/eth";
import { markRaw, ref, ShallowRef } from "vue";
import {
  NFTFair,
  NFTFair__factory,
  IPNFT1155Redeemable,
  IPNFT1155Redeemable__factory,
} from "@fancysoft/contracts/typechain";
import { Address } from "@fancysofthq/supa-app/models/Bytes";
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

export const talentContract: ShallowRef<IPNFT1155Redeemable | undefined> =
  ref();
export const nftFairContract: ShallowRef<NFTFair | undefined> = ref();
export const app = new Address(import.meta.env.VITE_APP_ADDRESS);

onConnect(async (provider) => {
  talentContract.value = markRaw(
    IPNFT1155Redeemable__factory.connect(
      import.meta.env.VITE_TALENT_ADDRESS,
      provider.getSigner()
    )
  );

  nftFairContract.value = markRaw(
    NFTFair__factory.connect(
      import.meta.env.VITE_NFTFAIR_ADDRESS,
      provider.getSigner()
    )
  );
});
