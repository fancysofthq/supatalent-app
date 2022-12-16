<script setup lang="ts">
import HeaderVue from "./components/Header.vue";
import { useEth } from "@fancysofthq/supa-app/services/eth";
import { computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import nProgress from "nprogress";
import { useTitle } from "@vueuse/core";
import { chain } from "./services/eth";

const { init } = useEth();
const route = useRoute();

const title = computed(() => {
  return route.meta.title ? route.meta.title + " | SupaTalent" : "SupaTalent";
});

useTitle(title);

nProgress.configure({ showSpinner: false });

onMounted(() => {
  init(chain, "generic", true);

  useRouter().beforeEach(() => {
    nProgress.start();
  });

  useRouter().afterEach((to) => {
    if (!to.meta.doNotTerminateNProgress) {
      nProgress.done();
    }
  });
});
</script>

<template lang="pug">
HeaderVue
.flex.w-full.justify-center.p-4(class="sm:p-8")
  RouterView(v-slot="{ Component }")
    Transition(name="fade" mode="out-in")
      Component(:is="Component" :key="route.path")
.sr-only.hidden.animate-pulse.bg-slate-300
</template>

<style lang="scss">
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.1s ease-out;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
