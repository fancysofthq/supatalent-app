<script setup lang="ts">
import Markdown from "vue3-markdown-it";
import Placeholder from "@fancysofthq/supa-app/components/Placeholder.vue";
import Chip from "@fancysofthq/supa-app/components/Chip.vue";
import { Talent } from "@/models/Talent";
import {
  BriefcaseIcon,
  GlobeAltIcon,
  CalendarIcon,
} from "@heroicons/vue/24/outline";
import { formatDistance } from "date-fns";
import { chain } from "@/services/eth";

const {
  talent,
  displayDetails = false,
  displayText = false,
  displayPurchaseButton = false,
  displayRedeemButton = false,
} = defineProps<{
  talent: Talent;
  displayDetails?: boolean;
  displayText?: boolean;
  displayPurchaseButton?: boolean;
  displayRedeemButton?: boolean;
}>();

const emit = defineEmits(["visit", "clickRedeem"]);
</script>

<template lang="pug">
.app-talent.grid.grid-cols-5
  router-link.app-talent-image.col-span-1(
    :to="talent.cid ? '/talent/' + talent.cid.toString() : ''"
    @click.exact="emit('visit')"
  )
    template(v-if="talent.imageUrl")
      img.bg-checkerboard.aspect-square.w-full.rounded.bg-fixed.object-cover.hover__opacity-80(
        :src="talent.imageUrl.toString()"
      )
    Placeholder.aspect-square.w-full.rounded(v-else)

  .app-talent-details.col-span-4.flex.flex-col.gap-1
    router-link.contents(
      :to="talent.cid ? '/talent/' + talent.cid.toString() : ''"
      @click.exact="emit('visit')"
    )
      span.w-max.font-medium.leading-none.hover__underline(
        v-if="talent.metadata.value?.name"
      ) {{ talent.metadata.value.name }}
      Placeholder.h-5.w-full.rounded(v-else)

    .mt-1.flex.flex-wrap.gap-1(
      v-if="talent.metadata.value?.properties.tags.length"
    )
      span.rounded-full.border.px-2.text-xs.font-medium.text-base-500(
        v-for="tag in talent.metadata.value.properties.tags"
      ) \#{{ tag }}

    span.text-base-content-900.text-sm(
      v-if="talent.metadata.value?.description"
    ) {{ talent.metadata.value.description }}
    .my-1.flex.flex-col.gap-1(v-else)
      Placeholder.h-3.w-full.rounded
      Placeholder.h-3.w-full.rounded

    .flex.flex-wrap.items-start.gap-x-1.leading-none
      .flex.items-center.gap-1
        BriefcaseIcon.h-6.w-6.text-base-300
        span.text-xs.font-medium.text-base-500(
          v-if="talent.metadata.value?.properties.unit"
        ) {{ talent.metadata.value?.properties.unit }} / token
        Placeholder.h-3.w-12.rounded(v-else)
      .flex.items-center.gap-1
        GlobeAltIcon.h-6.w-6.text-base-300
        span.text-xs.font-medium.text-base-500(
          v-if="talent.metadata.value?.properties.location"
        ) {{ talent.metadata.value?.properties.location }}
        Placeholder.h-3.w-12.rounded(v-else)
      .flex.items-center.gap-1
        CalendarIcon.h-6.w-6.text-base-300
        span.text-xs.font-medium.text-base-500(
          v-if="talent.chaindata.value?.expiredAt"
        ) Exp. {{ formatDistance(talent.chaindata.value.expiredAt, new Date(), { addSuffix: true }) }}
        Placeholder.h-3.w-12.rounded(v-else)

    .mt-1.flex.w-full.gap-3(
      v-if="displayPurchaseButton || displayRedeemButton"
    )
      router-link._btn(
        v-if="displayPurchaseButton"
        :to="'/talent/' + talent.cid"
      ) Purchase from 0.01 {{ chain.nativeCurrency.symbol }}
      button._btn(
        v-if="displayRedeemButton"
        :disabled="talent.balance.value?.eq(0)"
        @click="emit('clickRedeem')"
      ) Redeem (you have {{ talent.balance.value }})

    .mt-1.flex.flex-wrap.gap-1.text-xs.text-base-400(v-if="displayDetails")
      router-link(
        :to="'/' + talent.author.ensNameOrAddress()"
        @click.exact="emit('visit')"
      )
        Chip.cursor-pointer.gap-1.hover__underline(
          :account="talent.author"
          v-if="talent.author"
          pfp-class="h-4 w-4 rounded-full bg-slate-100"
        )

      //- template(v-if="talent.chaindata.value?.createdAt")
      //-   span &middot;
      //-   span created {{ formatDistance(talent.chaindata.value.createdAt, new Date(), { addSuffix: true }) }}

      template(v-if="talent.chaindata.value?.editions")
        span &middot;
        span {{ talent.chaindata.value.editions }} edition(s)

      template(v-if="talent.chaindata.value?.royalty")
        span &middot;
        span {{ (talent.chaindata.value.royalty * 100).toFixed(2) }}% royalty

  .app-talent-text.col-span-5(v-if="displayText")
    Markdown.prose.leading-tight(
      v-if="talent.metadata.value?.properties.content"
      :source="talent.metadata.value.properties.content"
      :linkify="true"
    )
    Placeholder.h-5.w-full.rounded(v-else)
</template>

<style lang="scss">
._btn {
  @apply flex grow items-center justify-center rounded-xl bg-base-100 p-2 text-sm transition hover__bg-base-200 active__scale-95 disabled__cursor-not-allowed disabled__opacity-50 disabled__hover__bg-base-100 disabled__active__scale-100;
}

.app-talent {
  container-type: inline-size;

  // .app-talent-image {
  //   @container (min-width: 300px) {
  //     @apply col-span-1;
  //   }
  // }

  // .app-talent-details {
  //   @container (min-width: 300px) {
  //     @apply col-span-4;
  //   }
  // }
}

.prose {
  @apply flex flex-col gap-2 leading-snug;

  h1 {
    @apply text-2xl font-bold;
  }

  h2 {
    @apply text-xl font-bold;
  }

  h3 {
    @apply text-lg font-bold;
  }

  h4 {
    @apply text-base font-bold;
  }

  h5 {
    @apply text-sm font-bold;
  }

  h6 {
    @apply text-xs font-bold;
  }

  blockquote {
    @apply my-1 border-l-4 border-slate-300 pl-2;
  }

  a {
    @apply inline-block underline;
  }

  pre {
    @apply my-1 overflow-x-auto rounded bg-slate-100 p-2;
  }

  code {
    @apply inline-block rounded bg-slate-100 px-1;
  }

  ul {
    @apply my-1 ml-4 list-disc;
  }
}
</style>
