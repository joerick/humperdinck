<template>
  <div id="app">
    <div id="nav">
      <router-link to="/">Home</router-link> |
      <router-link to="/about">About</router-link> |
      <a @click="login" v-if="user === null">
        Login
      </a>
      <a @click="logout" v-else-if="user">
        Logout
      </a>
    </div>
    <router-view :user="user" />
  </div>
</template>

<script>
import {Auth} from './model';

export default {
  name: 'App',
  data() {
    return {
      user: undefined,
    }
  },
  beforeCreate() {
    Auth.addAuthStateListener(user => {
      console.log({user})
      this.user = user
    })
  },
  methods: {
    login() {
      Auth.login().catch(console.error);
    },
    logout() {
      Auth.logout().catch(console.error);
    },
  },
}
</script>


<style>
#app {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}
#nav {
  padding: 30px;
}

#nav a {
  font-weight: bold;
  color: #2c3e50;
}

#nav a.router-link-exact-active {
  color: #42b983;
}
</style>
