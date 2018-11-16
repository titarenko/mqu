const bramqp = require('bramqp')
const url = require('url')
const { EventEmitter } = require('events')
const { createConnection } = require('net')
const { connect: createSecureConnection } = require('tls')

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
      const socket = this.options.tls
        ? createSecureConnection(this.options)
        : createConnection(this.options)
      socket.on('error', error => this.emit('error', error))
      bramqp.initialize(socket, specification, (error, handle) => {
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
    const { auth, hostname, port, pathname, protocol } = url.parse(connectionString)
    const [user = 'guest', password = 'guest'] = auth ? auth.split(':') : []
    return {
      user,
      password,
      servername: hostname || 'localhost',
      host: hostname || 'localhost',
      port: port || '5672',
      vhost: pathname ? pathname.slice(1) : '/',
      tls: protocol === 'amqps:',
    }
  }
}

module.exports = Connection
