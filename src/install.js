/*
 * @Description: 注册路由
 * @Version: 2.0
 * @Autor: ChenZhiWei
 * @Date: 2022-03-18 08:53:04
 * @LastEditors: Please set LastEditors
 * @LastEditTime: 2022-03-18 10:08:11
 */
import View from './components/view'
import Link from './components/link'

export let _Vue

// install => 向Vue中注入router插件
export function install (Vue) {
  if (install.installed && _Vue === Vue) return
  install.installed = true

  _Vue = Vue

  const isDef = v => v !== undefined

  const registerInstance = (vm, callVal) => {
    let i = vm.$options._parentVnode
    if (isDef(i) && isDef(i = i.data) && isDef(i = i.registerRouteInstance)) {
      i(vm, callVal)
    }
  }

  // 把 beforeCreate 和 destroyed 钩子函数注入到每一个组件中
  Vue.mixin({
    beforeCreate () {
		console.log(">>>>", this);
      if (isDef(this.$options.router)) {
        this._routerRoot = this
        this._router = this.$options.router
        this._router.init(this)
        Vue.util.defineReactive(this, '_route', this._router.history.current)
      } else {
        this._routerRoot = (this.$parent && this.$parent._routerRoot) || this
      }
      registerInstance(this, this)
    },
    destroyed () {
      registerInstance(this)
    }
  })

  Object.defineProperty(Vue.prototype, '$router', {
    get () { return this._routerRoot._router }
  })

  Object.defineProperty(Vue.prototype, '$route', {
    get () { return this._routerRoot._route }
  })

  // 使用 component 定义全局的 <router-link> / <router-view> 组件
  Vue.component('RouterView', View)
  Vue.component('RouterLink', Link)

  const strats = Vue.config.optionMergeStrategies
  // use the same hook merging strategy for route hooks
  // 对路由挂钩使用相同的挂钩合并策略
  strats.beforeRouteEnter = strats.beforeRouteLeave = strats.beforeRouteUpdate = strats.created
}
