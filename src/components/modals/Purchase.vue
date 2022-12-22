<script setup lang="ts">
import { XMarkIcon } from "@heroicons/vue/24/outline";
import { XCircleIcon } from "@heroicons/vue/24/solid";
import CommonVue from "./Common.vue";
import { ethers } from "ethers";
import { computed, type Ref, ref } from "vue";
import { chain } from "@/services/eth";
import { type Listing } from "@fancysofthq/supatalent-api/server";
import Spinner from "@fancysofthq/supa-app/components/Spinner.vue";
import { nftFairContract } from "@/services/eth";
import { useEth } from "@fancysofthq/supa-app/services/eth";

const { account } = useEth();

const props = defineProps<{
  open: boolean;
  listing?: Listing;
}>();

const emit = defineEmits(["close"]);

const amount = ref(1);
const txInProgress = ref(false);
const txError: Ref<string | undefined> = ref();
const sum = computed(() => props.listing?.price.mul(amount.value || 0));

const mayTransact = computed(() => {
  return (
    props.listing &&
    amount.value &&
    amount.value > 0 &&
    amount.value <= props.listing.stockSize.toNumber()
  );
});

async function transact() {
  txError.value = undefined;
  txInProgress.value = true;

  try {
    const tx = await nftFairContract.value?.purchase(
      props.listing!.id.toString(),
      amount.value,
      account.value!.address.value!.toString(),
      {
        value: sum.value,
      }
    );

    console.log("tx", tx);
    const receipt = await tx?.wait();
    console.log("receipt", receipt);
  } catch (e: any) {
    console.error(e);
    txError.value = e.message;
  } finally {
    txInProgress.value = false;
  }
}
</script>

<template lang="pug">
CommonVue(:open="open" @close="emit('close')" panel-class="w-full max-w-xl")
  template(#title)
    span.text-lg.font-bold Purchase
    button.opacity-10.transition-opacity(
      @click="emit('close')"
      class="hover:opacity-100"
    )
      XMarkIcon.h-6.w-6

  template(#description)
    .flex.flex-col.gap-3
      p.text-base-500 Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
      .flex.gap-1.rounded-xl.bg-base-50.p-3.px-5
        span.font-semibold Price / token
        span(v-if="listing?.price") {{ ethers.utils.formatEther(listing.price) }} {{ chain.nativeCurrency.symbol }}
      input.form-input.rounded-xl.border-none.py-3.px-5(
        type="number"
        placeholder="Amount"
        min="1"
        :max="listing?.stockSize.toNumber()"
        v-model="amount"
      )
      button.btn-web3.flex.items-center.justify-center.gap-2.rounded-xl.p-3.active__scale-95.disabled__cursor-not-allowed.disabled__opacity-50.disabled__active__scale-100(
        :disabled="!mayTransact || txInProgress"
        @click="transact"
      )
        template(v-if="txError")
          XCircleIcon.h-6.w-6
          span.text-white {{ txError }}
          button.rounded-lg.border.border-white.px-2.py-1.text-sm Try again
        span(v-else-if="!txInProgress") Purchase for {{ sum ? ethers.utils.formatEther(sum) : "0" }} {{ chain.nativeCurrency.symbol }}
        template(v-else)
          Spinner.h-5.w-5.animate-spin.fill-white.text-purple-500
          span Purchasing…
</template>

<style lang="scss">
.btn-web3 {
  @apply bg-gradient-to-r from-purple-500 to-pink-500 text-white transition hover__bg-gradient-to-l;
}
</style>
