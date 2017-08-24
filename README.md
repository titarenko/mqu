# mqu

```bash
npm i mqu
```

## Example

```js
const mqu = require('mqu')('amqp://guest:guest@localhost:5672')

mqu.on('error', error => {
  console.error('oh my, error!!', error)
  process.kill(process.pid)
})

mqu.consumeJob('j', data => console.log('worker 1', data))
mqu.consumeJob('j', data => console.log('worker 2', data))

mqu.consumeEvent('e', data => console.log('\thandler 1', data))
mqu.consumeEvent('e', data => console.log('\thandler 2', data))
mqu.consumeEvent('e', data => console.log('\thandler 3', data))

const jobInterval = setInterval(() => {
  const job = new Date().toISOString() + '-job'
  mqu.publishJob('j', job).then(() => console.log('published job', job))
}, 2000)

const eventInterval = setInterval(() => {
  const ev = new Date().toISOString() + '-event'
  mqu.publishEvent('e', ev).then(() => console.log('published event', ev))
}, 1500)

process.on('SIGINT', () => {
  clearInterval(jobInterval)
  clearInterval(eventInterval)
  mqu.close().then(() => console.log('closed!'))
})
```

## Why?

Because best [RabbitMQ](https://www.rabbitmq.com/) client for [node.js](https://nodejs.org) is [bramqp](https://github.com/bakkerthehacker/bramqp), but it's too verbose to be used directly for:

- round robin distribution of jobs between workers
- fanout distribution of events to listeners

## License

MIT
