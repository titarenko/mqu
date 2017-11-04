const bramqp = require('bramqp')
const url = require('url')
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
        this.handlePromise = null
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
    const { auth, hostname, port, pathname } = url.parse(connectionString)
    const [user = 'guest', password = 'guest'] = auth ? auth.split(':') : []
    return {
      user,
      password,
      host: hostname || 'localhost',
      port: port || '5672',
      vhost: pathname ? pathname.slice(1) : '/',
    }
  }
}

module.exports = Connection
