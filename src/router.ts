import { createRouter, createWebHashHistory } from "vue-router";
import { CID } from "multiformats/cid";
import { Account } from "@fancysofthq/supa-app/models/Account";
import { Address } from "@fancysofthq/supabase";

const Home = () => import("./pages/Home.vue");
const Talent = () => import("./pages/Talent.vue");
const Profile = () => import("./pages/Profile.vue");

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: "/",
      component: Home,
      meta: { doNotTerminateNProgress: true },
    },
    {
      path: "/talent/:cid",
      component: Talent,
      meta: { title: "Talent", doNotTerminateNProgress: true },
      props: (route) => ({
        cid: CID.parse(route.params.cid as string),
      }),
    },
    {
      path: "/:name(\\w+\\.eth|0x[0-9a-fA-F]{40})",
      component: Profile,
      meta: { title: "Profile", doNotTerminateNProgress: true },
      props: (route) => {
        if ((route.params.name as string).endsWith(".eth")) {
          return {
            profileAccount: Account.getOrCreateFromEnsName(
              route.params.name as string
            ),
            displayTitle: true,
            displayActivity: false,
          };
        } else {
          return {
            profileAccount: Account.getOrCreateFromAddress(
              Address.from(route.params.name as string)
            ),
            displayTitle: true,
            displayActivity: false,
          };
        }
      },
    },
  ],
});

export default router;
