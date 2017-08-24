const bramqp = require('bramqp')
const { EventEmitter } = require('events')
const { createConnection } = require('net')

const specification = 'rabbitmq/full/amqp0-9-1.stripped.extended'

class AmqpError extends Error {
  constructor (data) {
    super(data['reply-text'])
    Object.assign(this, data)
  }
}

class Connection extends EventEmitter {
  constructor (options) {
    super()
    this.options = typeof options === 'object'
      ? options
      : this.parseConnectionString(options)
  }

  getHandle () {
    return this.handlePromise || (this.handlePromise = new Promise((resolve, reject) => {
      const { host, port } = this.options
      bramqp.initialize(createConnection(port, host), specification, (error, handle) => {
        if (error) {
          return reject(error)
        }
        handle.on('error', error => this.emit('error', error))
        handle.on('connection.close', (channel, method, data) => {
          this.emit('error', new AmqpError(data))
        })
        handle.on('channel.close', (channel, method, data) => {
          this.emit('error', new AmqpError(data))
        })
        const { user, password, vhost } = this.options
        handle.openAMQPCommunication(user, password, true, vhost, error => {
          if (error) {
            reject(error)
          } else {
            resolve(handle)
          }
        })
      })
    }))
  }

  close () {
    if (!this.handlePromise) {
      return
    }
    return this.handlePromise.then(handle => new Promise((resolve, reject) => {
      handle.closeAMQPCommunication(error => {
        if (error) {
          reject(error)
        } else {
          handle.socket.end()
          process.nextTick(resolve)
        }
      })
    }))
  }

  parseConnectionString (connectionString = '') {
    const [
      user = 'guest',
      password = 'guest',
      host = 'localhost',
      port = '5672',
      vhost = '/',
    ] = connectionString.slice(7).split(/[:@\\/]/).filter(Boolean)
    return { user, password, host, port, vhost }
  }
}

module.exports = Connection
