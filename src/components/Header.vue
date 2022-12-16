<script setup lang="ts">
import { WalletIcon } from "@heroicons/vue/24/outline";
import { useEth } from "@fancysofthq/supa-app/services/eth";
import { ref } from "vue";
import Spinner from "@fancysofthq/supa-app/components/Spinner.vue";
import Chip from "@fancysofthq/supa-app/components/Chip.vue";
import ChooseMint from "./modals/ChooseMint.vue";
import MintTalent from "./modals/MintTalent.vue";
import Profile from "./modals/Profile.vue";

const { account, isConnecting, disconnect } = useEth();

const profileOpen = ref(false);
const chooseMintOpen = ref(false);
const mintTalentOpen = ref(false);

function connect() {
  useEth().connect();
}
</script>

<template lang="pug">
header.flex.h-16.w-full.items-center.justify-between.border-b.border-base-200.py-4.px-4.sm__px-8
  .flex.max-w-max.items-center.gap-2.sm__gap-4
    router-link.transition-transform.active__scale-95(to="/")
      .hidden.text-3xl.uppercase.sm__flex
        span Supa
        span.font-medium Talent
      .flex.text-3xl.uppercase.sm__hidden
        span S
        span.font-medium T
    button.rounded-xl.px-3.py-2.uppercase.transition.hover__bg-base-200.active__scale-95(
      v-if="account"
      @click="chooseMintOpen = true"
    ) Mint
  .flex.items-center.gap-2(v-if="account")
    Chip.cursor-pointer.gap-1.rounded-xl.bg-white.px-4.py-1.transition.hover__bg-base-200.active__scale-95(
      class="py-2.5"
      :account="account"
      pfp-class="h-6 w-6 rounded-full bg-base-100"
      @click="profileOpen = true"
    )
  button.flex.items-center.justify-center.gap-2.rounded-lg.bg-gradient-to-r.from-purple-500.to-pink-500.px-5.text-center.text-white.transition-transform.hover__bg-gradient-to-l.active__scale-95.disabled__bg-gradient-to-l.disabled__opacity-50.disabled__active__scale-100(
    class="py-2.5"
    @click="connect"
    :disabled="isConnecting"
    v-else
  )
    WalletIcon.h-5.w-5(v-if="!isConnecting")
    Spinner.h-5.w-5.animate-spin.text-purple-500.text-white(v-else)
    span Connect wallet

Teleport(to="body")
  ChooseMint(
    :open="chooseMintOpen"
    @close="chooseMintOpen = false"
    @choose-talent="mintTalentOpen = true"
  )
  MintTalent(
    v-if="account"
    :account="account"
    :open="mintTalentOpen"
    @close="mintTalentOpen = false"
  )
  Profile(
    v-if="account"
    :account="account"
    :open="profileOpen"
    @close="profileOpen = false"
  )
</template>
