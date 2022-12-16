<script setup lang="ts">
import type { Account } from "@fancysofthq/supa-app/models/Account";
import { XMarkIcon } from "@heroicons/vue/24/outline";
import CommonVue from "./Common.vue";
import ProfileVue from "@/pages/Profile.vue";

defineProps<{ open: boolean; account: Account }>();
const emit = defineEmits(["close"]);
</script>

<template lang="pug">
CommonVue(:open="open" @close="emit('close')" panel-class="w-full max-w-xl")
  template(#title)
    span.ml-3.text-lg.font-bold Account
    button.opacity-10.transition-opacity(
      @click="emit('close')"
      class="hover:opacity-100"
    )
      XMarkIcon.h-6.w-6

  template(#description)
    .flex.flex-col.gap-2
      ProfileVue(
        :profile-account="account"
        @exit="emit('close')"
        :display-title="false"
        :display-activity="false"
      )
</template>
