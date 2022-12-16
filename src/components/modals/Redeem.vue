<script setup lang="ts">
import { XMarkIcon } from "@heroicons/vue/24/outline";
import { XCircleIcon } from "@heroicons/vue/24/solid";
import CommonVue from "./Common.vue";
import { computed, type Ref, ref } from "vue";
import { talentContract } from "@/services/eth";
import { Talent } from "@/models/Talent";
import Spinner from "@fancysofthq/supa-app/components/Spinner.vue";
import { useEth } from "@fancysofthq/supa-app/services/eth";

const { account } = useEth();

const props = defineProps<{
  open: boolean;
  talent?: Talent;
}>();

const emit = defineEmits(["close"]);

const amount = ref(1);
const txInProgress = ref(false);
const txError: Ref<string | undefined> = ref();

const mayTransact = computed(() => {
  return (
    account.value?.address.value &&
    amount.value &&
    amount.value > 0 &&
    props.talent?.balance.value?.gte(amount.value)
  );
});

async function transact() {
  txError.value = undefined;
  txInProgress.value = true;

  try {
    const tx = await talentContract.value?.safeTransferFrom(
      account.value!.address.value!.toString(),
      talentContract.value!.address,
      props.talent!.cid.multihash.digest,
      amount.value,
      []
    );

    console.log("tx", tx);
    props.talent?.balance.value?.sub(amount.value);

    const receipt = await tx?.wait();
    console.log("receipt", receipt);
  } catch (e: any) {
    console.error(e);
    txError.value = "Transaction failed";
  } finally {
    txInProgress.value = false;
  }
}
</script>

<template lang="pug">
CommonVue(:open="open" @close="emit('close')" panel-class="w-full max-w-xl")
  template(#title)
    span.text-lg.font-bold Redeem tokens
    button.opacity-10.transition-opacity(
      @click="emit('close')"
      class="hover:opacity-100"
    )
      XMarkIcon.h-6.w-6

  template(#description)
    .flex.flex-col.gap-3
      p.text-base-500 Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
      input.form-input.rounded-xl.border-none.py-3.px-5(
        type="number"
        placeholder="Amount"
        min="1"
        :max="talent?.balance.value?.toNumber()"
        v-model="amount"
      )
      button.btn-web3.flex.items-center.justify-center.gap-2.rounded-xl.p-3.active__scale-95.disabled__cursor-not-allowed.disabled__opacity-50.disabled__active__scale-100(
        :disabled="!mayTransact || txInProgress"
        @click="transact"
      )
        template(v-if="txError")
          XCircleIcon.h-6.w-6
          span.text-white {{ txError }}, try again
        span(v-else-if="!txInProgress") Redeem {{ amount }} tokens
        template(v-else)
          Spinner.h-5.w-5.animate-spin.fill-white.text-purple-500
          span Redeeming…
</template>

<style lang="scss">
.btn-web3 {
  @apply bg-gradient-to-r from-purple-500 to-pink-500 text-white transition hover__bg-gradient-to-l;
}
</style>
