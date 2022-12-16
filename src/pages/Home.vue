<script setup lang="ts">
import nProgress from "nprogress";
import { onMounted, ref, type ShallowRef } from "vue";
import * as api from "@/services/api";
import { Talent } from "@/models/Talent";
import { Account } from "@fancysofthq/supa-app/models/Account";
import TalentVue from "@/components/Talent.vue";
import RedeemVue from "@/components/modals/Redeem.vue";
import { BigNumber } from "ethers";
import { useEth } from "@fancysofthq/supa-app/services/eth";

const { account } = useEth();

const talents: ShallowRef<Talent[]> = ref([]);
const redeemModal: ShallowRef<Talent | undefined> = ref();

onMounted(async () => {
  await Promise.all(
    (
      await api.getTalents()
    ).map(async (talent) => {
      talents.value.push(
        Talent.getOrCreate(
          talent.cid,
          Account.getOrCreateFromAddress(talent.author, true),
          ref(
            account.value
              ? await api.getAccountTalentBalance(
                  account.value.address.value!,
                  talent.cid
                )
              : BigNumber.from(0)
          ),
          undefined,
          {
            createdAt: talent.createdAt,
            royalty: talent.royalty,
            finalized: talent.finalized,
            expiredAt: talent.expiredAt,
            editions: talent.editions,
          },
          true
        )
      );
    })
  );

  nProgress.done();
});
</script>

<template lang="pug">
.flex.w-full.max-w-2xl.flex-col.gap-3
  TalentVue.gap-3.rounded-xl.bg-white.p-4(
    v-for="talent in talents"
    :talent="talent"
    :displayDetails="true"
    :displayText="false"
    :displayRedeemButton="true"
    @clickRedeem="redeemModal = talent"
  )

  RedeemVue(
    :open="redeemModal !== undefined"
    :talent="redeemModal"
    @close="redeemModal = undefined"
  )
</template>
