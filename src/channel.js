class Channel {
  constructor (handle, number) {
    this.handle = handle
    this.number = number
  }

  open () {
    return new Promise((resolve, reject) => {
      this.handle.once(`${this.number}:channel.open-ok`, resolve)
      this.handle.on(`${this.number}:channel.close`, () => {
        this.handle.channel['close-ok'](this.number, () => {
          this.handle.channel.open(this.number)
        })
      })
      this.handle.channel.open(this.number)
    })
  }

  close () {
    return new Promise((resolve, reject) => {
      this.handle.once(`${this.number}:close-ok`, resolve)
      this.handle.channel.close(this.number, 200, 'normal clearing')
    })
  }

  declareExchange (name, {
    type = '',
    passive = false,
    durable = true,
    autoDelete = false,
    internal = false,
    noWait = false,
    args = { },
  } = { }) {
    return new Promise((resolve, reject) => {
      this.handle.once(`${this.number}:exchange.declare-ok`, (channel, method, data) => resolve(data))
      this.handle.exchange.declare(
        this.number,
        name,
        type,
        passive,
        durable,
        autoDelete,
        internal,
        noWait,
        args,
        error => {
          if (error) {
            reject(error)
          }
        }
      )
    })
  }

  declareQueue (name, {
    passive = false,
    durable = true,
    exclusive = false,
    autoDelete = false,
    noWait = false,
    args = { },
  } = { }) {
    return new Promise((resolve, reject) => {
      this.handle.once(`${this.number}:queue.declare-ok`, (channel, method, data) => resolve(data))
      this.handle.queue.declare(
        this.number,
        name,
        passive,
        durable,
        exclusive,
        autoDelete,
        noWait,
        args,
        error => {
          if (error) {
            reject(error)
          }
        }
      )
    })
  }

  bindQueue (queue, exchange, {
    routingKey = '',
    noWait = false,
    args = { },
  } = { }) {
    return new Promise((resolve, reject) => {
      this.handle.once(`${this.number}:queue.bind-ok`, resolve)
      this.handle.queue.bind(
        this.number,
        queue,
        exchange,
        routingKey,
        noWait,
        args,
        error => {
          if (error) {
            reject(error)
          }
        }
      )
    })
  }

  publish (name, content, {
    routingKey = '',
    mandatory = true,
    immediate = false,
  } = { }) {
    return new Promise((resolve, reject) => {
      this.handle.basic.publish(
        this.number,
        name,
        routingKey,
        mandatory,
        immediate,
        error => {
          if (error) {
            return reject(error)
          }
          this.handle.content(
            this.number,
            'basic',
            { 'content-type': 'application/json' },
            content === undefined ? '{}' : JSON.stringify(content),
            error => {
              if (error) {
                reject(error)
              } else {
                resolve()
              }
            }
          )
        }
      )
    })
  }

  consume (name, consumer, {
    consumerTag = null,
    noLocal = false,
    noAck = false,
    exclusive = false,
    noWait = false,
    args = { },
  } = { }) {
    return new Promise((resolve, reject) => {
      this.handle.once(`${this.number}:basic.consume-ok`, () => {
        this.handle.on(`${this.number}:basic.deliver`, (channel, method, data) => {
          this.handle.once('content', (channel, className, properties, content) => {
            Promise.resolve().then(() => consumer(JSON.parse(content.toString() || '{}')))
              .then(() => this.handle.basic.ack(this.number, data['delivery-tag'], false))
              .catch(error => {
                this.handle.basic.nack(this.number, data['delivery-tag'], false)
                throw error
              })
          })
        })
      })
      this.handle.basic.consume(
        this.number,
        name,
        consumerTag,
        noLocal,
        noAck,
        exclusive,
        noWait,
        args,
        error => {
          if (error) {
            reject(error)
          } else {
            resolve()
          }
        }
      )
    })
  }
}

module.exports = Channel
