import Vue from 'vue';
import Router from 'vue-router';
import Home from './views/Home.vue';
import { Auth } from './model';

Vue.use(Router);

// const Home = () => import(/* webpackChunkName: "home" */ './views/Home.vue')
const About = () => import(/* webpackChunkName: "about" */ './views/About.vue')
const Repo = () => import(/* webpackChunkName: "repo" */ './views/Repo.vue')

export default new Router({
  mode: 'history',
  base: process.env.BASE_URL,
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
        path: '/:owner/:repo',
        name: 'repo',
        beforeEnter(to, from, next) {
            Auth.currentUser().then(user => {
                if (!user) {
                    throw new Error('Log in to view this page');
                }
                return user.getRepo(to.params.owner, to.params.repo);
            }).then(repo => {
                next({name: 'repo-branch', params: {
                    owner: repo.ownerUsername,
                    repo: repo.name,
                    branch: repo.defaultBranchName,
                }});
            }).catch(error => {
                next(error);
            })
        }
    },
    {
        path: '/:owner/:repo/branches/:branch',
        name: 'repo-branch',
        component: Repo
    },
  ],
});
