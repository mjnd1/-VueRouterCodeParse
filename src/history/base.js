/*
 * @Description: 
 * @Version: 2.0
 * @Autor: ChenZhiWei
 * @Date: 2022-03-18 08:53:04
 * @LastEditors: Please set LastEditors
 * @LastEditTime: 2022-03-21 15:30:08
 */
/* @flow */

import { _Vue } from '../install'
import type Router from '../index'
import { inBrowser } from '../util/dom'
import { runQueue } from '../util/async'
import { warn } from '../util/warn'
import { START, isSameRoute, handleRouteEntered } from '../util/route'
import {
  flatten,
  flatMapComponents,
  resolveAsyncComponents
} from '../util/resolve-components'
import {
  createNavigationDuplicatedError,
  createNavigationCancelledError,
  createNavigationRedirectedError,
  createNavigationAbortedError,
  isError,
  isNavigationFailure,
  NavigationFailureType
} from '../util/errors'
import { handleScroll } from '../util/scroll'

export class History {
  router: Router // 准备跳转的下一个 router 对象
  base: string
  current: Route // 当前的 router 对象
  pending: ?Route
  cb: (r: Route) => void
  ready: boolean
  readyCbs: Array<Function>
  readyErrorCbs: Array<Function>
  errorCbs: Array<Function>
  listeners: Array<Function>
  cleanupListeners: Function

  // implemented by sub-classes
  +go: (n: number) => void
  +push: (loc: RawLocation, onComplete?: Function, onAbort?: Function) => void
  +replace: (
    loc: RawLocation,
    onComplete?: Function,
    onAbort?: Function
  ) => void
  +ensureURL: (push?: boolean) => void
  +getCurrentLocation: () => string
  +setupListeners: Function

  constructor (router: Router, base: ?string) {
    this.router = router
    this.base = normalizeBase(base)
    // start with a route object that stands for "nowhere"
    this.current = START
    this.pending = null
    this.ready = false
    this.readyCbs = []
    this.readyErrorCbs = []
    this.errorCbs = []
    this.listeners = []
  }

  listen (cb: Function) {
    this.cb = cb
  }

  onReady (cb: Function, errorCb: ?Function) {
    if (this.ready) {
      cb()
    } else {
      this.readyCbs.push(cb)
      if (errorCb) {
        this.readyErrorCbs.push(errorCb)
      }
    }
  }

  onError (errorCb: Function) {
    this.errorCbs.push(errorCb)
  }

	/**
	 * @description: 路由过渡函数
	 * @param {string} location 当前window窗口的URL地址
	 * @param {function} onComplete 监听函数之一 => 成功的回调函数
	 * @param {function} onAbort 监听函数之一 => 失败的回调函数
	 * @author: 快乐就完事
	 */
  transitionTo (
    location: RawLocation,
    onComplete?: Function,
    onAbort?: Function
  ) {
	  console.log("markChen>>>> 执行transitonTo函数", this);
	  console.log("markChen>>>> location为", location);
    let route
    // catch redirect option https://github.com/vuejs/vue-router/issues/3201
	// 捕获重定向选项
    try {
      route = this.router.match(location, this.current)
    } catch (e) {
      this.errorCbs.forEach(cb => {
        cb(e)
      })
      // Exception should still be thrown
      throw e
    }
    const prev = this.current
	console.log("markChen>>>> 当前的current对象-也就是当前的URL对象", this.current);
	console.log("markChen>>>> 当前的route对象-也就是准备跳转到的URL对象", route);
	// => 执行真正的切换操作
    this.confirmTransition(
      route,
	//   成功回调
      () => {
		console.log("markChen>>>> confirmTransition() 执行成功=> 路由准备切换");
        this.updateRoute(route)
        onComplete && onComplete(route)
        this.ensureURL()
        this.router.afterHooks.forEach(hook => {
	console.log("markChen>>>> confirmTransition() 执行成功=> hook", hook);
          hook && hook(route, prev)
        })

        // fire ready cbs once => 准备好 cbs 一次
        if (!this.ready) {
          this.ready = true
          this.readyCbs.forEach(cb => {
			console.log("markChen>>>> confirmTransition() 执行成功=> readyCbs => 准备好 cbs 一次");
            cb(route)
          })
        }
      },
	//   失败回调
      err => {
		console.log("markChen>>>> confirmTransition() 执行失败=> 路由不变化");
        if (onAbort) {
          onAbort(err)
        }
        if (err && !this.ready) {
          // Initial redirection should not mark the history as ready yet
          // because it's triggered by the redirection instead
          // https://github.com/vuejs/vue-router/issues/3225
          // https://github.com/vuejs/vue-router/issues/3331
			// 初始重定向不应将历史标记为就绪
			// 因为它是由重定向触发的
			console.log("markChen>>>> confirmTransition() 执行失败 => 重定向不触发");
          if (!isNavigationFailure(err, NavigationFailureType.redirected) || prev !== START) {
            this.ready = true
            this.readyErrorCbs.forEach(cb => {
              cb(err)
            })
          }
        }
      }
    )
  }

  /**
   * @description: 执行路由的真正切换
   * @param {*} route 准备跳转到的 router 对象
   * @param {*} onComplete 成功的回调函数
   * @param {*} onAbort 失败的回调函数
   * @return {*}
   * @author: 快乐就完事
   */
  confirmTransition (route: Route, onComplete: Function, onAbort?: Function) {
    const current = this.current
    this.pending = route
    const abort = err => {
      // changed after adding errors with
      // https://github.com/vuejs/vue-router/pull/3047 before that change,
      // redirect and aborted navigation would produce an err == null
		// 添加错误后更改
		// https://github.com/vuejs/vue-router/pull/3047 在更改之前，
		// 重定向和中止导航会产生一个 err == null
      if (!isNavigationFailure(err) && isError(err)) {
        if (this.errorCbs.length) {
          this.errorCbs.forEach(cb => {
            cb(err)
          })
        } else {
          if (process.env.NODE_ENV !== 'production') {
            warn(false, 'uncaught error during route navigation:')
          }
          console.error(err)
        }
      }
      onAbort && onAbort(err)
    }
    const lastRouteIndex = route.matched.length - 1
    const lastCurrentIndex = current.matched.length - 1
    if (
      isSameRoute(route, current) &&
      // in the case the route map has been dynamically appended to
	  // => 如果路线图已动态附加到
      lastRouteIndex === lastCurrentIndex &&
      route.matched[lastRouteIndex] === current.matched[lastCurrentIndex]
    ) {
      this.ensureURL()
      if (route.hash) {
        handleScroll(this.router, current, route, false)
      }
      return abort(createNavigationDuplicatedError(current, route))
    }

    const { updated, deactivated, activated } = resolveQueue(
      this.current.matched,
      route.matched
    )
	console.log("markChen>>>> confirmTransition()方法 => uptaded对象", updated);
	console.log("markChen>>>> confirmTransition()方法 => deactivated对象=>准备销毁的路由对象数组", deactivated);
	console.log("markChen>>>> confirmTransition()方法 => activated对象=>准备进入的路由对象数组", activated);

    const queue: Array<?NavigationGuard> = [].concat(
      // in-component leave guards => 组件内的休假警卫
      extractLeaveGuards(deactivated),
      // global before hooks => 全局前置钩子 => 由组件自己里面添加的钩子函数
      this.router.beforeHooks,
      // in-component update hooks => 组件内更新挂钩
      extractUpdateHooks(updated),
      // in-config enter guards => 在配置中输入警卫 => beforeEnter 钩子函数，由组件自己添加的钩子函数
      activated.map(m => m.beforeEnter),
      // async components => 异步组件
      resolveAsyncComponents(activated)
    )

    /**
     * @description: 逐步执行 queue 函数队列 中的钩子函数
     * @param {*} hook 钩子函数
     * @param {*} next 进行下一个的函数调用
     */
    const iterator = (hook: NavigationGuard, next) => {
      if (this.pending !== route) {
        return abort(createNavigationCancelledError(current, route))
      }
      try {
		console.log("markChen>>>> iterator() => 路由对象和当前的路由对象", route, current);
        hook(route, current, (to: any) => {
			console.log("markChen>>>> hook() => hook()函数的回调", to);
          if (to === false) {
            // next(false) -> abort navigation, ensure current URL
			// => 中止导航，确保当前 URL
			console.log("markChen>>>> hook() => 不执行跳转", to);
            this.ensureURL(true)
            abort(createNavigationAbortedError(current, route))
          } else if (isError(to)) {
			console.log("markChen>>>> hook() => 跳转错误", to);
            this.ensureURL(true)
            abort(to)
          } else if (
            typeof to === 'string' ||
            (typeof to === 'object' &&
              (typeof to.path === 'string' || typeof to.name === 'string'))
          ) {
            // next('/') or next({ path: '/' }) -> redirect
			// => 重定向
            abort(createNavigationRedirectedError(current, route))
            if (typeof to === 'object' && to.replace) {
				console.log("markChen>>>> hook() => 替换当前路由=>重定向", to);
              this.replace(to)
            } else {
				console.log("markChen>>>> hook() => 进入路由到路由记录中=>push", to);
              this.push(to)
            }
          } else {
            // confirm transition and pass on the value
			// => 确认转换并传递值
			console.log("markChen>>>> hook() => 确定进行跳转", to);
            next(to)
          }
        })
      } catch (e) {
        abort(e)
      }
    }
	console.log("markChen>>>> confirmTransition() => runQueue()函数作用: 将queue保存的函数作为参数,传递给iterator()函数执行");
	console.log("markChen>>>> confirmTransition() => queue函数", queue);
    runQueue(queue, iterator, () => {
		console.log("markChen>>>> runQueue => 执行runQueue()的回调函数方法");
      // wait until async components are resolved before
	  // => 等到异步组件被解析之前
      // extracting in-component enter guards
	  // => 提取组件内输入守卫
      const enterGuards = extractEnterGuards(activated)
      const queue = enterGuards.concat(this.router.resolveHooks)
	  console.log("markChen>>>> runQueue => 准备把beforeRouteEnter()和beforeResolve()添加到queue中");
      runQueue(queue, iterator, () => {
        if (this.pending !== route) {
          return abort(createNavigationCancelledError(current, route))
        }
        this.pending = null
		console.log("markChen>>>> runQueue => 准备执行confirmTransition()的成功回调函数");
        onComplete(route)
        if (this.router.app) {
          this.router.app.$nextTick(() => {
			console.log("markChen>>>> $nextTick => 执行$nextTick的回调函数");
            handleRouteEntered(route)
          })
        }
      })
    })
  }

  updateRoute (route: Route) {
    this.current = route
    this.cb && this.cb(route)
  }

  setupListeners () {
    // Default implementation is empty
  }

  teardown () {
    // clean up event listeners
    // https://github.com/vuejs/vue-router/issues/2341
    this.listeners.forEach(cleanupListener => {
      cleanupListener()
    })
    this.listeners = []

    // reset current history route
    // https://github.com/vuejs/vue-router/issues/3294
    this.current = START
    this.pending = null
  }
}

function normalizeBase (base: ?string): string {
  if (!base) {
    if (inBrowser) {
      // respect <base> tag
      const baseEl = document.querySelector('base')
      base = (baseEl && baseEl.getAttribute('href')) || '/'
      // strip full URL origin
      base = base.replace(/^https?:\/\/[^\/]+/, '')
    } else {
      base = '/'
    }
  }
  // make sure there's the starting slash
  if (base.charAt(0) !== '/') {
    base = '/' + base
  }
  // remove trailing slash
  return base.replace(/\/$/, '')
}

function resolveQueue (
  current: Array<RouteRecord>,
  next: Array<RouteRecord>
): {
  updated: Array<RouteRecord>,
  activated: Array<RouteRecord>,
  deactivated: Array<RouteRecord>
} {
  let i
  const max = Math.max(current.length, next.length)
  for (i = 0; i < max; i++) {
    if (current[i] !== next[i]) {
      break
    }
  }
  return {
    updated: next.slice(0, i),
    activated: next.slice(i),
    deactivated: current.slice(i)
  }
}

/**
 * @description: 调用 路由的钩子 函数
 * @param {*} records 路由记录数组
 * @param {*} name 准备调用的钩子函数名称
 * @param {*} bind bindGuard()函数
 * @param {*} reverse 是否反转
 * @author: 快乐就完事
 */
function extractGuards (
  records: Array<RouteRecord>,
  name: string,
  bind: Function,
  reverse?: boolean
): Array<?Function> {
  const guards = flatMapComponents(records, (def, instance, match, key) => {
    const guard = extractGuard(def, name)
	console.log("markChen>>>> flatMapComponents()方法 => 钩子函数", guard);
	console.log("markChen>>>> flatMapComponents()方法 => 传入的钩子函数名称", name);
    if (guard) {
      return Array.isArray(guard)
        ? guard.map(guard => bind(guard, instance, match, key))
        : bind(guard, instance, match, key)
    }
  })
  console.log("markChen>>>> extractGuards()方法 => 钩子函数数组", guards);
  return flatten(reverse ? guards.reverse() : guards)
}

function extractGuard (
  def: Object | Function,
  key: string
): NavigationGuard | Array<NavigationGuard> {
  if (typeof def !== 'function') {
    // extend now so that global mixins are applied.
	// => 现在扩展，以便应用全局混合
    def = _Vue.extend(def)
  }
  return def.options[key]
}

function extractLeaveGuards (deactivated: Array<RouteRecord>): Array<?Function> {
	console.log("markChen>>>> extractLeaveGuards()方法");
  return extractGuards(deactivated, 'beforeRouteLeave', bindGuard, true)
}

function extractUpdateHooks (updated: Array<RouteRecord>): Array<?Function> {
  return extractGuards(updated, 'beforeRouteUpdate', bindGuard)
}

function bindGuard (guard: NavigationGuard, instance: ?_Vue): ?NavigationGuard {
  if (instance) {
    return function boundRouteGuard () {
      return guard.apply(instance, arguments)
    }
  }
}

function extractEnterGuards (
  activated: Array<RouteRecord>
): Array<?Function> {
	console.log("markChen>>>> extractEnterGuards() => 执行准备激活的路由的beforeRouteEnter钩子函数");
  return extractGuards(
    activated,
    'beforeRouteEnter',
    (guard, _, match, key) => {
      return bindEnterGuard(guard, match, key)
    }
  )
}

function bindEnterGuard (
  guard: NavigationGuard,
  match: RouteRecord,
  key: string
): NavigationGuard {
	console.log("markChen>>>> bindEnterGuard()");
  return function routeEnterGuard (to, from, next) {
	console.log("markChen>>>> routeEnterGuard()");
    return guard(to, from, cb => {
      if (typeof cb === 'function') {
        if (!match.enteredCbs[key]) {
          match.enteredCbs[key] = []
        }
        match.enteredCbs[key].push(cb)
      }
      next(cb)
    })
  }
}
