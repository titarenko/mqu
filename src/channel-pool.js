const Channel = require('./channel')
const genericPool = require('generic-pool')

class ChannelPool {
  constructor (connection) {
    let newChannelNumber = 2
    this.pool = genericPool.createPool({
      create: () => connection.getHandle().then(handle => {
        const channel = new Channel(handle, newChannelNumber++)
        return channel.open().then(() => channel)
      }),
      destroy: channel => channel.close(),
    }, {
      min: 0,
      max: Number.MAX_SAFE_INTEGER,
    })
  }

  acquire () {
    return this.pool.acquire()
  }

  use (user) {
    return this.pool.acquire()
      .then(channel => Promise.resolve()
        .then(() => user(channel))
        .then(() => this.pool.release(channel))
        .catch(() => this.pool.release(channel))
      )
  }
}

module.exports = ChannelPool
