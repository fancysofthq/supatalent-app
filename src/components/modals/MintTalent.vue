<script setup lang="ts">
import type { Account } from "@fancysofthq/supa-app/models/Account";
import {
  XMarkIcon,
  PhotoIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/vue/24/outline";
import { CheckCircleIcon, XCircleIcon } from "@heroicons/vue/24/solid";
import { useObjectUrl } from "@vueuse/core";
import CommonVue from "./Common.vue";
import {
  computed,
  type ComputedRef,
  ref,
  type Ref,
  type ShallowRef,
} from "vue";
import TagInput from "@fancysofthq/supa-app/components/TagInput.vue";
import FilePicker from "@fancysofthq/supa-app/components/FilePicker.vue";
import { app, talentContract, nftFairContract } from "@/services/eth";
import { BigNumber, ethers } from "ethers";
import { Talent, type Metadata, type Chaindata } from "@/models/Talent";
import TalentVue from "@/components/Talent.vue";
import { packIpnft } from "@fancysofthq/supa-app/services/Web3Storage";
import { IPFT } from "@nxsf/ipnft";
import { useEth } from "@fancysofthq/supa-app/services/eth";
import { Address } from "@fancysofthq/supa-app/models/Bytes";
import { indexOfMulti, Uint8 } from "@fancysofthq/supa-app/utils/uint8";
import Spinner from "@fancysofthq/supa-app/components/Spinner.vue";
import * as api from "@/services/api";
import { CID } from "multiformats/cid";
import { date2InputDate } from "@fancysofthq/supa-app/utils/html";
import { Config as ListingConfig } from "@fancysoft/contracts/src/NFTFair/Listing";

const now = new Date();

const props = defineProps<{ open: boolean; account: Account }>();
const emit = defineEmits(["close", "disconnect"]);

const previewImage: ShallowRef<File | undefined> = ref();
const previewImageUrl = useObjectUrl(previewImage);
const name: Ref<string> = ref("");
const description: Ref<string> = ref("");
const tags: ShallowRef<string[]> = ref([]);
const unit: Ref<string> = ref("");
const royalty: Ref<number | undefined> = ref();
const editions: Ref<number | undefined> = ref();
const priceNumber: Ref<number | undefined> = ref();
const finalize: Ref<boolean> = ref(false);
const expiresAt: Ref<Date | undefined> = ref();
const location: Ref<string> = ref("");
const content: Ref<string> = ref("");

const price: ComputedRef<BigNumber> = computed(() => {
  return ethers.utils.parseEther(priceNumber.value?.toString() || "0");
});

const canMint: ComputedRef<boolean> = computed(
  () =>
    name.value.length > 0 &&
    description.value.length > 0 &&
    unit.value.length > 0 &&
    editions.value !== undefined &&
    editions.value > 0 &&
    priceNumber.value !== undefined &&
    priceNumber.value > 0 &&
    royalty.value !== undefined &&
    expiresAt.value !== undefined &&
    expiresAt.value > now &&
    location.value.length > 0 &&
    content.value.length > 0 &&
    previewImage.value !== undefined
);

const hasContent: ComputedRef<boolean> = computed(
  () =>
    !!previewImage.value ||
    name.value.length > 0 ||
    description.value.length > 0 ||
    tags.value.length > 0 ||
    unit.value.length > 0 ||
    royalty.value !== undefined ||
    editions.value !== undefined ||
    expiresAt.value !== undefined ||
    location.value.length > 0 ||
    content.value.length > 0
);

enum Status {
  InProgress,
  Error,
  Complete,
}

const minting: Ref<Status | undefined> = ref();
const uploading: Ref<Status | undefined> = ref();
const txConfirmation: Ref<Status | undefined> = ref();

const mintButtonPressed = ref(false);

const inProgress = computed(
  () =>
    minting.value === Status.InProgress ||
    uploading.value === Status.InProgress ||
    txConfirmation.value === Status.InProgress
);

const isComplete = computed(
  () =>
    minting.value === Status.Complete &&
    uploading.value === Status.Complete &&
    txConfirmation.value === Status.Complete
);

const mintError = ref<any>();

const talentMetadata: ComputedRef<Metadata> = computed(() => ({
  name: name.value,
  description: description.value,
  image: previewImage.value!,
  properties: {
    tags: tags.value,
    unit: unit.value,
    location: location.value,
    content: content.value,
  },
}));

const talentChaindata: ComputedRef<Chaindata> = computed(() => ({
  // createdAt: now,
  royalty: new Uint8(royalty.value || 0).value / 255,
  finalized: finalize.value,
  expiredAt: expiresAt.value || now,
  editions: BigNumber.from(editions.value || 0),
}));

const talent: ComputedRef<Talent> = computed(
  () =>
    new Talent(
      talentCid.value!,
      props.account,
      ref(BigNumber.from(0)),
      talentMetadata,
      talentChaindata
    )
);

const talentCid: Ref<CID | undefined> = ref();

async function mint() {
  if (!talentContract.value) throw new Error("No contract");
  if (!canMint.value) throw new Error("Cannot mint");

  mintButtonPressed.value = true;
  mintError.value = undefined;
  minting.value = Status.InProgress;
  uploading.value = undefined;
  txConfirmation.value = undefined;

  const { provider } = useEth();

  const tag = new IPFT(
    (await provider.value!.getNetwork()).chainId,
    new Address(talentContract.value!.address).toString(),
    props.account.address.value!.toString()
  );

  const blockstore = await packIpnft(talent.value, tag);
  const cid = blockstore.rootCid;
  talentCid.value = cid;
  console.debug("Root CID", cid.toString());

  const currentAuthorOf = new Address(
    await talentContract.value.contentAuthorOf(
      BigNumber.from(cid.multihash.digest)
    )
  );

  if (currentAuthorOf.zero) {
    const tagOffset = indexOfMulti(blockstore.rootBlock.bytes, tag.toBytes());
    let tx;

    try {
      tx = await talentContract.value.multicall([
        talentContract.value.interface.encodeFunctionData("claim", [
          cid.multihash.digest,
          props.account.address.value!.toString(),
          blockstore.rootBlock.bytes,
          cid.code,
          tagOffset,
          royalty.value!,
        ]),
        talentContract.value.interface.encodeFunctionData("mint", [
          nftFairContract.value!.address,
          cid.multihash.digest,
          editions.value!,
          new ListingConfig(
            app.toString(),
            props.account.address.value!.toString(),
            price.value
          ).encode(),
          finalize.value,
          (expiresAt.value!.valueOf() / 1000).toFixed(0),
        ]),
      ]);
    } catch (e: any) {
      console.error(e);
      minting.value = Status.Error;
      mintError.value = new Error("Transaction failed");
      return;
    }

    console.debug("Minted", tx.hash);
    minting.value = Status.Complete;

    txConfirmation.value = Status.InProgress;

    try {
      await tx.wait(import.meta.env.PROD ? 2 : 1);
      txConfirmation.value = Status.Complete;
    } catch (e) {
      console.debug("Confirmation failed", e);
      txConfirmation.value = Status.Error;
      mintError.value = new Error("Confirmation failed");
      return;
    }

    uploading.value = Status.InProgress;

    try {
      const res = await api.storeTalentCar(blockstore.toCar(), tx.hash);

      if (!cid.equals(res)) {
        throw new Error("Root CID mismatch");
      }

      uploading.value = Status.Complete;
    } catch (e) {
      console.debug("Upload failed", e);
      uploading.value = Status.Error;
      mintError.value = new Error("Upload failed");
    }
  } else {
    // TODO: Mint again.
    minting.value = Status.Error;
    mintError.value = new Error("Already minted!");
    return;
  }
}

async function cleanup(): Promise<boolean> {
  if (inProgress.value) return false;
  if (hasContent.value && !isComplete.value && !confirm("Discard?")) {
    return false;
  }

  minting.value = undefined;
  uploading.value = undefined;
  txConfirmation.value = undefined;
  mintError.value = undefined;
  mintButtonPressed.value = false;

  name.value = "";
  description.value = "";
  tags.value = [];
  unit.value = "";
  expiresAt.value = undefined;
  finalize.value = false;
  royalty.value = undefined;
  editions.value = undefined;
  location.value = "";
  content.value = "";
  previewImage.value = undefined;

  return true;
}

async function tryClose(): Promise<void | null> {
  (await cleanup()) ? emit("close") : null;
}

function onExpiresAtChange(event: Event) {
  if (event.target instanceof HTMLInputElement) {
    expiresAt.value = event.target.valueAsDate || undefined;
  }
}
</script>

<template lang="pug">
CommonVue(:open="open" @close="tryClose" panel-class="w-full max-w-6xl")
  template(#title)
    span.text-lg.font-bold Mint a talent
    button.opacity-10.transition-opacity.hover__opacity-100(@click="tryClose")
      XMarkIcon.h-6.w-6

  template(#description)
    .grid.grid-cols-1.gap-y-3.sm__grid-cols-3.sm__gap-x-3
      .relative.flex.flex-col.rounded-xl.bg-white(
        :class="{ 'opacity-50': mintButtonPressed }"
      )
        ._step 1

        FilePicker.bg-checkerboard.flex.h-32.items-center.justify-center.overflow-hidden.rounded-t-lg.border-none(
          accept="image/jpg,image/jpeg"
          v-model:image="previewImage"
          :file="previewImage"
          @update:file="previewImage = $event"
          :disabled="mintButtonPressed"
          :class="{ 'cursor-pointer': !mintButtonPressed }"
        )
          img.aspect-square.h-full.object-cover(
            v-if="previewImage"
            :src="previewImageUrl"
          )
          .flex.aspect-square.h-full.select-none.flex-col.items-center.justify-center.bg-white(
            v-else
          )
            PhotoIcon.h-6.w-6
            span.text-sm.font-medium Select image

        .px-4.py-2
          label.my-label(for="name") Name
          input#name.w-full.rounded.border-none.p-0.placeholder__text-base-300.hover__bg-base-100(
            :disabled="mintButtonPressed"
            type="text"
            placeholder="Your talent"
            v-model="name"
          )

        .px-4.py-2
          label.my-label(for="description") Tags
          TagInput.tag-input.border-none(
            :disabled="mintButtonPressed"
            v-model="tags"
            placeholder="example-tag"
            v-slot="{ tag, onClick }"
            input-class="p-0 w-full rounded border-none hover__bg-base-100 placeholder__text-base-300"
          )
            .flex.cursor-pointer.items-center.rounded-full.border.px-2.py-1(
              @click="onClick"
            )
              span.text-xs.leading-none.text-base-600 \#{{ tag }}
              XMarkIcon.h-4.w-4

        .px-4.py-2
          label.my-label(for="description") Short description
          textarea#description.w-full.rounded.border-none.p-0.text-sm.placeholder__text-base-300.hover__bg-base-100(
            :disabled="mintButtonPressed"
            placeholder="Introduce the talent"
            v-model="description"
            rows="1"
          )

        .px-4.py-2
          label.my-label(for="unit") Token unit
          input#unit.w-full.rounded.border-none.p-0.placeholder__text-base-300.hover__bg-base-100(
            :disabled="mintButtonPressed"
            type="text"
            placeholder="E.g. 1 hour"
            v-model="unit"
          )

        .px-4.py-2
          label.my-label(for="location") Location
          input#location.w-full.shrink.rounded.border-none.p-0.placeholder__text-base-300.hover__bg-base-100(
            :disabled="mintButtonPressed"
            type="text"
            placeholder="E.g. New York"
            v-model="location"
          )

      .relative.flex.flex-col.rounded-xl.bg-white(
        :class="{ 'opacity-50': mintButtonPressed }"
      )
        ._step 2

        .px-4.py-2
          label.my-label(for="expiresAt") Expires at
          input#expiresAt.w-full.shrink.rounded.border-none.p-0.placeholder__text-base-300.hover__bg-base-100(
            :disabled="mintButtonPressed"
            type="date"
            @change="onExpiresAtChange"
            :value="date2InputDate(expiresAt)"
          )

        .px-4.py-2
          label.my-label(for="editions") Editions
          input#editions.w-full.shrink.rounded.border-none.p-0.placeholder__text-base-300.hover__bg-base-100(
            :disabled="mintButtonPressed"
            type="number"
            min="1"
            placeholder="How many editions?"
            v-model="editions"
          )

        .px-4.py-2
          label.my-label(for="price") Price per token
          input#price.w-full.shrink.rounded.border-none.p-0.placeholder__text-base-300.hover__bg-base-100(
            :disabled="mintButtonPressed"
            type="number"
            min="0.001"
            placeholder="0.001"
            v-model="priceNumber"
          )

        .px-4.py-2
          label.my-label(for="royalty") Royalty
          input#royalty.w-full.shrink.rounded.border-none.p-0.placeholder__text-base-300.hover__bg-base-100(
            :disabled="mintButtonPressed"
            type="number"
            min="0"
            max="255"
            placeholder="0-255"
            v-model="royalty"
          )

        .px-4.py-2
          label.my-label(for="content") Full description
          textarea#content.w-full.rounded.border-none.p-0.text-sm.placeholder__text-base-300.hover__bg-base-100(
            v-model="content"
            :disabled="mintButtonPressed"
            placeholder="_Markdown_ supported!"
          )

      .relative.flex.flex-col.gap-3
        .relative
          ._step 3
          TalentVue.gap-3.rounded-xl.bg-white.p-3(
            :talent="talent"
            :display-text="true"
          )

        .relative
          ._step 4

          .flex.flex-col.gap-2.rounded-xl.bg-white.p-3
            button.flex.w-full.items-center.justify-center.gap-1.rounded-lg.bg-gradient-to-r.from-purple-500.to-pink-500.px-5.text-center.text-white.transition.hover__bg-gradient-to-l.focus__outline-none.focus__ring-2.focus__ring-purple-200.active__scale-95.disabled__bg-gradient-to-l.disabled__focus__ring-0.disabled__active__scale-100(
              :disabled="!canMint || mintButtonPressed || isComplete"
              class="py-2.5"
              :class="{ 'opacity-50 cursor-not-allowed': !canMint, 'cursor-default': mintButtonPressed }"
              @click="mint"
            )
              span(v-if="!mintButtonPressed") Mint
              .flex.flex-col.items-start.p-1(
                v-else
                style="grid-template-columns: min-content auto"
              )
                .flex.h-7.items-center.gap-1
                  .flex.h-7.w-7.items-center.justify-center
                    CheckCircleIcon.h-7.w-7(v-if="minting === Status.Complete")
                    XCircleIcon.h-7.w-7(v-else-if="minting === Status.Error")
                    Spinner.h-5.w-5.animate-spin.fill-white.text-pink-500(
                      v-else-if="minting === Status.InProgress"
                    )
                    Spinner.h-5.w-5.fill-white(v-else)
                  span.font-medium
                    span Mint token
                    sup.ml-1 (eth)

                .flex.h-7.items-center.gap-1(
                  :class="{ 'opacity-50': !txConfirmation }"
                )
                  .flex.h-7.w-7.items-center.justify-center
                    CheckCircleIcon.h-7.w-7(
                      v-if="txConfirmation === Status.Complete"
                    )
                    XCircleIcon.h-7.w-7(
                      v-else-if="txConfirmation === Status.Error"
                    )
                    Spinner.h-5.w-5.animate-spin.fill-white.text-pink-500(
                      v-else-if="txConfirmation === Status.InProgress"
                    )
                    Spinner.h-5.w-5.fill-white(v-else)
                  span.font-medium Wait for tx

                .flex.h-7.items-center.gap-1(
                  :class="{ 'opacity-50': !uploading }"
                )
                  .flex.h-7.w-7.items-center.justify-center
                    CheckCircleIcon.h-7.w-7(
                      v-if="uploading === Status.Complete"
                    )
                    XCircleIcon.h-7.w-7(v-else-if="uploading === Status.Error")
                    Spinner.h-5.w-5.animate-spin.fill-white.text-pink-500(
                      v-else-if="uploading === Status.InProgress"
                    )
                    Spinner.h-5.w-5.fill-white(v-else)
                  span.font-medium
                    span Upload files
                    sup.ml-1 (web2)

                .mt-2.w-full(v-if="isComplete")
                  .flex.w-full.justify-center.rounded-lg.border-2.border-white.p-1.text-sm.font-medium
                    router-link.flex.cursor-pointer.gap-1.transition-transform.hover__underline.active__scale-95(
                      :to="'/talent/' + talentCid"
                      @click="tryClose"
                    )
                      span Visit talent page
                      ArrowTopRightOnSquareIcon.h-5.w-5

            .flex.flex-col(v-if="mintError")
              .flex.w-full.items-center.justify-center.gap-1.rounded-lg.bg-red-500.p-2.text-sm
                XCircleIcon.inline-block.h-6.w-6.text-white
                span.text-white {{ mintError }}
                button.ml-1.rounded.bg-white.px-2.py-1.text-xs.text-red-800.shadow-sm.transition.active__scale-95.active__shadow-none(
                  @click="mint"
                ) Try again
</template>

<style lang="scss" scoped>
.tag-input .tag {
  @apply rounded-full border;
}

.my-label {
  @apply text-xs leading-none text-base-600;
}

._step {
  @apply absolute z-20 -ml-2 -mt-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg font-bold shadow;
}

._util1 {
  @media (min-width: 640px) {
    border-style: none;
    border-left: inherit;
  }
}
</style>
