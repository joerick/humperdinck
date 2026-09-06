import { createRouter, createWebHistory } from 'vue-router';
import { defineComponent } from 'vue';
import Home from './views/Home.vue';
import { Auth } from './model';

const About = () => import('./views/About.vue')
const Repo = () => import('./views/Repo.vue')
const RedirectView = defineComponent({render: () => null})

export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: Home,
    },
    {
      path: '/about',
      name: 'about',
      component: About,
    },
    {
        path: '/:owner/:repoName',
        name: 'repo',
        component: RedirectView,
        async beforeEnter(to) {
            const user = await Auth.currentUser();
            if (!user) {
                return {name: 'home'};
            }
            const repo = await user.getRepo(String(to.params.owner), String(to.params.repoName));
            return {name: 'repo-branch', params: {
                owner: repo.ownerUsername,
                repoName: repo.name,
                branch: repo.defaultBranchName,
            }};
        }
    },
    {
        path: '/:owner/:repoName/branches/:branch',
        name: 'repo-branch',
        component: Repo
    },
    {
        path: '/:owner/:repoName/branches/:branch/settings',
        name: 'repo-settings',
        component: Repo,
    },
  ],
});
