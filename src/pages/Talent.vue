<script setup lang="ts">
import { CID } from "multiformats/cid";
import nProgress from "nprogress";
import { onMounted, type Ref, ref, type ShallowRef } from "vue";
import * as api from "@/services/api";
import { Talent } from "@/models/Talent";
import { Account } from "@fancysofthq/supa-app/models/Account";
import TalentVue from "@/components/Talent.vue";
import { displayCid } from "@fancysofthq/supa-app/services/ipfs";
import { ethers, BigNumber } from "ethers";
import Chip from "@fancysofthq/supa-app/components/Chip.vue";
import {
  IdentificationIcon,
  SparklesIcon,
  ShoppingBagIcon,
  BuildingStorefrontIcon,
  TicketIcon,
} from "@heroicons/vue/24/outline";
import { chain, talentContract } from "@/services/eth";
import PurchaseVue from "@/components/modals/Purchase.vue";
import { formatDistance } from "date-fns";
import {
  Event as APIEvent,
  Listing,
  ListEvent,
  PurchaseEvent,
  TransferEvent,
} from "@fancysofthq/supatalent-api/server";
import RedeemVue from "@/components/modals/Redeem.vue";
import { notNull } from "@fancysofthq/supa-app/utils/aux";
import { useEth } from "@fancysofthq/supa-app/services/eth";
import { Address, Bytes } from "@fancysofthq/supabase";

const { account } = useEth();

const props = defineProps<{ cid: CID }>();
const talent: ShallowRef<Talent | undefined> = ref();
const listings: ShallowRef<Listing[]> = ref([]);
const history: ShallowRef<APIEvent[]> = ref([]);

const purchaseModal: Ref<Listing | undefined> = ref();
const redeemModal = ref(false);

onMounted(async () => {
  await Promise.all([
    api.getTalent(props.cid).then(async (dto) => {
      talent.value = Talent.getOrCreate(
        dto.cid,
        Account.getOrCreateFromAddress(dto.author, true),
        account.value
          ? ref(
              (
                await api.getAccountTalentBalance(
                  account.value.address.value!,
                  dto.cid
                )
              ).balance
            )
          : undefined,
        undefined,
        dto,
        true
      );
    }),

    api.getTalentListings(props.cid).then((dto) => {
      listings.value = dto;
    }),

    api.getTalentHistory(props.cid).then((dtos) => {
      history.value = dtos;
    }),
  ]);

  nProgress.done();
});
</script>

<template lang="pug">
.flex.w-full.max-w-2xl.flex-col.gap-2
  .ml-5.flex.items-baseline.gap-2
    h1.text-lg.font-semibold Talent
    router-link.text-sm.text-base-500.hover__underline(:to="'/talent/' + cid") {{ displayCid(cid) }}

  TalentVue.gap-4.rounded-xl.bg-white.p-5(
    v-if="talent"
    :talent="talent"
    :display-details="true"
    :display-text="true"
    :display-redeem-button="true"
    @click-redeem="redeemModal = true"
  )

  h1.ml-5.text-lg.font-semibold Listings
  .w-full.overflow-scroll
    table.w-full.table-auto.rounded-xl.bg-white
      thead.border-b
        tr
          th.whitespace-nowrap.p-4.px-5.text-left Seller
          th.whitespace-nowrap.p-4.px-5 Price
          th.whitespace-nowrap.p-4.px-5 Stock Size
          th.whitespace-nowrap.p-4.px-5.text-right Actions
      tbody.divide-y
        tr(v-for="listing in listings" :key="listing.id.toString()")
          td.py-2.px-5.text-left
            router-link.hover__underline(:to="'/' + listing.seller.toString()")
              Chip.inline-flex.gap-2.align-middle(
                :account="Account.getOrCreateFromAddress(listing.seller, true)"
                pfp-class="w-6 h-6 bg-base-100 rounded-full"
              )
            IdentificationIcon.ml-1.inline-block.h-6.w-6.text-base-600(
              title="Seller is the author"
              v-if="listing.seller.equals(talent?.author.address.value)"
            )
          td.py-2.px-5.text-center {{ ethers.utils.formatEther(listing.price) }} {{ chain.nativeCurrency.symbol }}
          td.py-2.px-5.text-center {{ listing.stockSize }}
          td.py-2.px-5.text-center
            button._btn.w-full(
              :disabled="listing.stockSize.isZero()"
              @click="purchaseModal = listing"
            )
              | Purchase

  h1.ml-5.text-lg.font-semibold History
  .w-full.overflow-scroll
    table.w-full.table-auto.rounded-xl.bg-white
      tbody.divide-y
        tr(v-for="event in history")
          template(v-if="event instanceof ListEvent && true")
            td.p-5.text-sm
              router-link.inline-flex.align-baseline.hover__underline(
                :to="'/' + event.seller.toString()"
              )
                Chip.inline-flex.items-baseline.gap-2(
                  :account="Account.getOrCreateFromAddress(event.seller, true)"
                  pfp-class="w-5 h-5 self-center bg-base-100 rounded-full"
                )
              BuildingStorefrontIcon.mx-2.-mt-1.inline-block.h-6.w-6.align-middle.text-base-600
              span.text-base-500 Listed {{ event.stockSize }} token(s) for {{ ethers.utils.formatEther(event.price) }} {{ chain.nativeCurrency.symbol }} each
            //- td.p-5.text-right.text-sm {{ formatDistance(new Date(event.timestamp * 1000), new Date()) }} ago

          template(
            v-else-if="event instanceof TransferEvent && event.from.zero"
          )
            td.p-5.text-sm
              router-link.inline-flex.align-baseline.hover__underline(
                :to="'/' + event.to.toString()"
              )
                Chip.inline-flex.items-baseline.gap-2(
                  :account="Account.getOrCreateFromAddress(event.operator, true)"
                  pfp-class="w-5 h-5 self-center bg-base-100 rounded-full"
                )
              SparklesIcon.mx-2.-mt-1.inline-block.h-6.w-6.align-middle.text-base-600
              span.text-base-500 Minted {{ event.value }} token(s)
            //- td.p-5.text-right.text-sm {{ formatDistance(new Date(event.timestamp * 1000), new Date()) }} ago

          template(v-else-if="event instanceof PurchaseEvent && true")
            td.p-5.text-sm
              router-link.inline-flex.align-baseline.hover__underline(
                :to="'/' + event.buyer.toString()"
              )
                Chip.inline-flex.items-baseline.gap-2(
                  :account="Account.getOrCreateFromAddress(event.buyer, true)"
                  pfp-class="w-5 h-5 self-center bg-base-100 rounded-full"
                )
              ShoppingBagIcon.mx-2.-mt-1.inline-block.h-6.w-6.align-middle.text-base-600
              span.text-base-500 Purchased {{ event.tokenAmount }} token(s) for {{ ethers.utils.formatEther(event.income) }} {{ chain.nativeCurrency.symbol }}
            //- td.p-5.text-right.text-sm {{ formatDistance(new Date(event.timestamp * 1000), new Date()) }} ago

          //- TODO: Use .equals.
          template(
            v-else-if="event instanceof TransferEvent && event.to.toString().toUpperCase() == notNull(talentContract).address.toUpperCase()"
          )
            td.p-5.text-sm
              router-link.inline-flex.align-baseline.hover__underline(
                :to="'/' + event.from.toString()"
              )
                Chip.inline-flex.items-baseline.gap-2(
                  :account="Account.getOrCreateFromAddress(event.from, true)"
                  pfp-class="w-5 h-5 self-center bg-base-100 rounded-full"
                )
              TicketIcon.mx-2.-mt-1.inline-block.h-6.w-6.align-middle.text-base-600
              span.text-base-500 Redeemed {{ event.value }} token(s)
            //- td.p-5.text-right.text-sm {{ formatDistance(new Date(event.timestamp * 1000), new Date()) }} ago

  PurchaseVue(
    :open="purchaseModal !== undefined"
    :listing="purchaseModal"
    @close="purchaseModal = undefined"
  )

  RedeemVue(:open="redeemModal" :talent="talent" @close="redeemModal = false")
</template>
