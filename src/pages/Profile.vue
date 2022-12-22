<script setup lang="ts">
import {
  ArrowRightOnRectangleIcon,
  DocumentDuplicateIcon,
  ClipboardDocumentCheckIcon,
} from "@heroicons/vue/24/outline";
import { useClipboard } from "@vueuse/core";
import { Account } from "@fancysofthq/supa-app/models/Account";
import { notNull } from "@fancysofthq/supa-app/utils/aux";
import { computed, onMounted, ref, type ShallowRef } from "vue";
import * as api from "@/services/api";
import PFP from "@fancysofthq/supa-app/components/PFP.vue";
import { Event as APIEvent } from "@fancysofthq/supatalent-api/server";
import { useEth } from "@fancysofthq/supa-app/services/eth";
import nProgress from "nprogress";
import { Talent } from "@/models/Talent";
import TalentVue from "@/components/Talent.vue";

const { account: connectedAccount, disconnect } = useEth();
const { copy, copied } = useClipboard();

const props = defineProps<{
  profileAccount: Account;
  displayTitle: boolean;
  displayActivity: boolean;
}>();
const emit = defineEmits(["exit"]);

const talents: ShallowRef<Talent[]> = ref([]);
const activity: ShallowRef<APIEvent[]> = ref([]);

const isSelf = computed(() =>
  connectedAccount.value?.address.value?.equals(
    props.profileAccount.address.value
  )
);

onMounted(async () => {
  const address = await props.profileAccount.resolveAddress();

  talents.value = await Promise.all(
    (
      await api.getTalents(address)
    ).map(async (dto) =>
      Talent.getOrCreate(
        dto.cid,
        Account.getOrCreateFromAddress(dto.author, true),
        ref((await api.getAccountTalentBalance(dto.author, dto.cid)).balance),
        undefined,
        dto,
        true
      )
    )
  );

  if (props.displayActivity) {
    activity.value = await api.accountActivity(address);
  }

  nProgress.done();
});
</script>

<template lang="pug">
.flex.w-full.max-w-2xl.flex-col.gap-2
  .flex.items-baseline.gap-1(v-if="displayTitle")
    h2.ml-4.text-lg.font-semibold Account
    router-link.hidden.text-sm.text-slate-400.hover__text-inherit.hover__underline.sm__block(
      :to="'/' + profileAccount.ensNameOrAddress()"
    ) {{ profileAccount.ensNameOrAddress() }}
    router-link.text-sm.text-slate-400.hover__text-inherit.hover__underline.sm__hidden(
      :to="'/' + profileAccount.ensNameOrAddress()"
    ) {{ profileAccount.ensNameOrAddress(true) }}

  .flex.flex-col.gap-2.rounded-xl.bg-gradient-to-r.from-purple-500.to-pink-500.p-4
    .flex.items-center.justify-between
      .flex.items-center.gap-1
        router-link.contents(
          :to="'/' + profileAccount.ensNameOrAddress()"
          @click="emit('exit')"
        )
          PFP.mr-1.h-12.w-12.rounded-full.bg-white.shadow.transition.active__scale-95.active__shadow-none(
            :account="profileAccount"
          )
          .select-none.rounded-lg.p-2.px-3.text-white.transition.hover__underline.active__scale-95(
            class="bg-black/10 hover__bg-black/20"
          ) {{ profileAccount.address.value?.toDisplayString() }}
        button.rounded-lg.p-2.transition.active__scale-95(
          class="hover__bg-black/20"
          @click="copy(notNull(profileAccount.address.value).toString())"
        )
          DocumentDuplicateIcon.h-6.w-6.text-white(v-if="!copied")
          ClipboardDocumentCheckIcon.h-6.w-6.text-white(v-else)
        .flex.items-center.gap-2.text-sm(v-if="profileAccount.ensName.value")
          span.text-white aka
          router-link.rounded-full.bg-gradient-to-r.from-red-500.to-orange-500.p-1.px-3.text-white.transition.active__scale-95(
            :to="'/' + profileAccount.ensName.value"
            @click="emit('exit')"
          ) {{ profileAccount.ensName.value }}

      button.rounded-lg.p-2.transition.active__scale-95(
        v-if="isSelf"
        @click="disconnect(); emit('exit')"
        class="hover__bg-black/20"
      )
        ArrowRightOnRectangleIcon.h-6.w-6.text-white

  h2.ml-4.font-semibold Talents
  template(v-if="talents.length")
    .flex.flex-col.gap-2
      TalentVue.gap-3.rounded-lg.bg-white.p-4.transition(
        v-for="talent in talents"
        :talent="talent"
        :display-details="true"
        @visit="emit('exit')"
      )
  p.text-center.text-base-400(v-else) {{  isSelf ? "You haven't minted any talents yet." : "This account doesn't have any talents."  }}

  template(v-if="displayActivity")
    h2.ml-4.font-semibold Activity
    template(v-if="activity.length")
    p.text-center.text-base-400(v-else) {{  isSelf ? "You don't have any activity yet." : "This account doesn't have any activity."  }}
</template>
