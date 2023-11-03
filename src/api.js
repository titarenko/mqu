const Connection = require('./connection')
const ChannelPool = require('./channel-pool')
const { EventEmitter } = require('events')

class Api extends EventEmitter {
  constructor (options) {
    super()
    if (typeof options !== 'object') {
      options = { connection: options }
    }
    this.options = Object.assign({
      toExchangeName: (...args) => args.join(':'),
      toQueueName: (...args) => args.join(':'),
    }, options)
    this.connection = new Connection(this.options.connection)
    this.connection.on('error', error => this.emit('error', error))
    this.connection.on('connect', (...args) => this.emit('connect', ...args))
    this.pool = new ChannelPool(this.connection)
    this.pool.on('error', error => this.emit('error', error))
  }

  close () {
    return this.connection.close()
  }

  publishEvent (name, content, options) {
    const exchange = this.options.toExchangeName(name)
    return this.pool.use(channel =>
      channel.declareExchange(exchange, { type: 'fanout' })
        .then(() => channel.publish(exchange, content, options))
    )
  }

  consumeEvent (...args) {
    return this.consumeTransientEvent(...args)
  }

  consumeTransientEvent (name, consumer, options) {
    const exchange = this.options.toExchangeName(name)
    const args = options && options.args
    return this.pool.acquire().then(channel =>
      channel.declareExchange(exchange, { type: 'fanout' })
        .then(() => channel.declareQueue('', Object.assign({ autoDelete: true }, args && { args })))
        .then(data => channel.bindQueue(data.queue, exchange).then(() => data))
        .then(configureQos(channel, options))
        .then(data => channel.consume(data.queue, consumer, options))
    )
  }

  consumePersistentEvent (eventName, consumerName, consumer, options) {
    const exchange = this.options.toExchangeName(eventName)
    const queue = this.options.toQueueName(eventName, consumerName)
    const args = options && options.args
    return this.pool.acquire().then(channel =>
      channel.declareExchange(exchange, { type: 'fanout' })
        .then(() => channel.declareQueue(queue, args && { args }))
        .then(data => channel.bindQueue(data.queue, exchange).then(() => data))
        .then(configureQos(channel, options))
        .then(data => channel.consume(data.queue, consumer, options))
    )
  }

  publishJob (name, content, options) {
    const queue = this.options.toQueueName(name)
    const args = options && options.args
    return this.pool.use(channel =>
      channel.declareQueue(queue, args && { args })
        .then(() => channel.publish('', content, { routingKey: queue }))
    )
  }

  consumeJob (name, consumer, options) {
    const queue = this.options.toQueueName(name)
    const args = options && options.args
    return this.pool.acquire().then(channel =>
      channel.declareQueue(queue, args && { args })
        .then(configureQos(channel, options))
        .then(() => channel.consume(queue, consumer, options))
    )
  }
}

module.exports = Api

function configureQos (channel, options) {
  return data => {
    if (options && options.qos) {
      return channel
        .qos(options.qos.size || 0, options.qos.count, options.qos.global || false)
        .then(() => data)
    }
    return data
  }
}
