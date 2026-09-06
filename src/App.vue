<template>
  <div id="app">
    <div class="nav">
      <router-link to="home" class="logotype">Humperdinck</router-link>
      <div class="spacer" style="flex: 1"></div>

      <div class="nav-account">
        <router-link to="/">Home</router-link> |
        <router-link to="/about">About</router-link> |

        <a @click="login" v-if="user === null">
          Login
        </a>
        <a @click="logout" v-else-if="user">
          Logout
        </a>

      </div>
    </div>
    <div class="app-content">
      <router-view :user="user" />
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue';
import {Auth, User} from './model';

export default Vue.extend({
  name: 'App',
  data() {
    return {
      user: undefined as User|undefined|null,
    }
  },
  created() {
    Auth.addAuthStateListener(user => {
      this.user = user
    })
  },
  methods: {
    login(): void {
      Auth.login().catch(console.error);
    },
    logout(): void {
      Auth.logout().catch(console.error);
    },
  },
})
</script>


<style lang="scss">
* {
  box-sizing: border-box;
}
html, body {
  min-height: 100%;
  margin: 0;
  padding: 0;
}
#app {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #474747;
  min-height: 100%;
}
</style>

<style lang="scss" scoped>
.nav {
  height: 68px;
}
.app-content {
  padding-top: 68px;
  min-height: 100%;
}

.nav {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  display: flex;
  align-items: center;
  padding: 0 30px;
  background: #FFFFFF;
  box-shadow: 0 2px 0 0 rgba(0,0,0,0.44);
}
.logotype {
  font-size: 20px;
  letter-spacing: 0;
  text-decoration: none;
  text-transform: uppercase;
}
.nav a {
  font-weight: bold;
  color: inherit;
}

</style>
