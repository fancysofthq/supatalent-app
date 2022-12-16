<script setup lang="ts">
import { XMarkIcon } from "@heroicons/vue/24/outline";
import CommonVue from "./Common.vue";

defineProps<{ open: boolean }>();
const emit = defineEmits(["close", "chooseTalent"]);
</script>

<template lang="pug">
CommonVue(:open="open" @close="emit('close')" panel-class="w-full max-w-xl")
  template(#title)
    span.ml-3.text-xl.font-bold Choose what to mint
    button.opacity-10.transition-opacity.hover__opacity-100(
      @click="emit('close')"
    )
      XMarkIcon.h-6.w-6

  template(#description)
    .grid.grid-cols-1.gap-3.sm__grid-cols-2
      .flex.cursor-pointer.flex-col.items-center.justify-center.rounded-xl.bg-white.p-8.transition.hover__bg-base-200.active__scale-95(
        @click="emit('chooseTalent'); emit('close')"
      )
        h2.text-lg.font-semibold Mint a talent
        p.text-center One can redeem an NFT in exchange for your talent.
      .flex.cursor-not-allowed.flex-col.items-center.justify-center.rounded-xl.bg-white.p-8.opacity-50
        h2.text-lg.font-semibold Mint a work (soon)
        p.text-center Mint your work as a collectible NFT.
</template>
