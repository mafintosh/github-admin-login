const cookie = require('cookie')
const sodium = require('sodium-universal')

module.exports = login

function randomBytes (n) {
  const buf = Buffer.alloc(n)
  sodium.randombytes_buf(buf)
  return buf
}

function login (opts) {
  if (!opts) opts = {}
  if (!opts.clientId) opts.clientId = process.env.GITHUB_CLIENT_ID
  if (!opts.clientSecret) opts.clientSecret = process.env.GITHUB_CLIENT_SECRET

  if (!opts.clientId) throw new Error('opts.clientId is needed')
  if (!opts.clientSecret) throw new Error('opts.clientSecret is needed')

  var secrets = [randomBytes(32), randomBytes(32)]
  setInterval(rotate, 15 * 60 * 1000).unref()

  onrequest.encode = encode
  onrequest.decode = decode

  return onrequest

  function rotate () {
    secrets[1] = secrets[0]
    secrets[0] = randomBytes(32)
  }

  function onrequest (req, res, next) {
    const username = decode(req)
    if (username) return next(null, username)

    console.log('needs login')
  }

  function hmac (username, n) {
    const ubuf = Buffer.from(username)
    const out = Buffer.alloc(32)
    sodium.crypto_generichash(out, ubuf, secrets[n])
    return out.toString('hex')
  }

  function encode (res, username) {
    username = hmac(username, 0) + '.' + username
    res.setHeader('Set-Cookie', cookie.serialize('gh_name', username))
  }

  function decode (req) {
    if (!req.headers.cookie) return null
    const parsed = cookie.parse(req.headers.cookie)
    const username = parsed.gh_name
    if (!username) return null
    const name = username.slice(64 + 1)
    if ((hmac(name, 0) + '.' + name) !== username) {
      if ((hmac(name, 1) + '.' + name) !== username) {
        return null
      }
    }
    return name
  }
}
