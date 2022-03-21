/* @flow */

export function runQueue (queue: Array<?NavigationGuard>, fn: Function, cb: Function) {
	console.log("markChen>>>> runQueue() => 执行queue队列里的函数,执行完毕后执行cd()回调函数");
  const step = index => {
    if (index >= queue.length) {
      cb()
    } else {
      if (queue[index]) {
        fn(queue[index], () => {
          step(index + 1)
        })
      } else {
        step(index + 1)
      }
    }
  }
  step(0)
}
