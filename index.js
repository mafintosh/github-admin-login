const cookie = require('cookie')
const sodium = require('sodium-universal')
const get = require('simple-get')
const url = require('url')
const qs = require('querystring')

module.exports = login

function randomBytes (n) {
  const buf = Buffer.alloc(n)
  sodium.randombytes_buf(buf)
  return buf
}

function validCode (code) {
  return /^[a-z0-9]+$/.test(code)
}

function login (opts) {
  if (!opts) opts = {}
  if (!opts.clientId) opts.clientId = process.env.GITHUB_CLIENT_ID
  if (!opts.clientSecret) opts.clientSecret = process.env.GITHUB_CLIENT_SECRET

  if (!opts.clientId) throw new Error('opts.clientId is needed')
  if (!opts.clientSecret) throw new Error('opts.clientSecret is needed')

  var protocol = opts.protocol || ''
  const check = getChecker()
  const secrets = [randomBytes(32), randomBytes(32)]
  setInterval(rotate, 15 * 60 * 1000).unref()

  onrequest.encode = encode
  onrequest.decode = decode

  return onrequest

  function form (q) {
    return 'client_id=' + opts.clientId + '&' +
      'client_secret=' + opts.clientSecret + '&' +
      'state=' + q.state + '&' +
      'code=' + q.code
  }

  function rotate () {
    secrets[1] = secrets[0]
    secrets[0] = randomBytes(32)
  }

  function onrequest (req, res, next) {
    const username = decode(req)
    if (username) return next(null, username)

    const u = url.parse(req.url, true)
    const state = verify(u.query.state)
    if (state === 'ping') return res.end()
    if (!validCode(u.query.code) || state !== 'login') return oauth(req, res)
    checkUser(u.query, req, res, next)
  }

  function oauth (req, res) {
    if (!protocol) return protocolAndOauth(req, res)
    redirect(res, authUrl(req))
  }

  function protocolAndOauth (req, res) {
    get.concat({
      url: 'https://' + req.headers.host + req.url.split('?')[0] + '?state=' + sign('ping'),
      headers: {
        'User-Agent': 'github-admin-login'
      },
      timeout: 10000
    }, function (err) {
      protocol = err ? 'http://' : 'https://'
      oauth(req, res)
    })
  }

  function checkUser (query, req, res, next) {
    get.concat({
      method: 'POST',
      url: 'https://github.com/login/oauth/access_token',
      headers: {
        'User-Agent': 'github-admin-login',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 10000,
      body: form(query)
    }, onpost)

    function onpost (err, _, body) {
      if (err) return next(err)

      const q = qs.parse(body.toString())
      if (!q.access_token) return next(new Error('Bad Github login reply'))

      github('/user', q.access_token, true, function (err, user) {
        if (err) return next(err)
        if (!user) return next(new Error('No Github user found'))

        check(q.access_token, user.login, function (err, valid) {
          if (err) return next(err)

          if (!valid) {
            res.statusCode = 403
            res.end()
            return
          }

          encode(res, user.login)
          redirect(res, req.url.replace(/[?&]code=[^&]+&state=[^&]+$/, ''))
        })
      })
    }
  }

  function getChecker () {
    if (opts.users) return checkUsers
    if (opts.organization) return checkOrg
    throw new Error('You need to pass opts.users or opts.organization')
  }

  function checkUsers (token, username, done) {
    if (opts.users.indexOf(username) > -1) return done(null, true)
    done(null, false)
  }

  function checkOrg (token, username, done) {
    github('/orgs/' + opts.organization + '/members/' + username, token, false, function (err, member) {
      if (err) return done(err)
      done(null, !!member)
    })
  }

  function github (path, token, json, cb) {
    get.concat({
      url: 'https://api.github.com' + path + '?access_token=' + token,
      headers: {
        'User-Agent': 'github-admin-login'
      },
      timeout: 10000,
      json
    }, function (err, res, body) {
      if (err) return cb(err)
      if (res.statusCode === 204) return cb(null, true)
      if (res.statusCode !== 200) return cb(null, null)
      cb(null, body)
    })
  }

  function redirect (res, url) {
    res.statusCode = 302
    res.setHeader('Location', url)
    res.end()
  }

  function authUrl (req) {
    const state = sign('login')
    return 'https://github.com/login/oauth/authorize' +
      '?client_id=' + opts.clientId +
      '&scope=user' +
      '&redirect_uri=' + encodeURIComponent(protocol + req.headers.host + req.url) +
      '&state=' + state
  }

  function hmac (username, n) {
    const ubuf = Buffer.from(username)
    const out = Buffer.alloc(32)
    sodium.crypto_generichash(out, ubuf, secrets[n])
    return out.toString('hex')
  }

  function encode (res, username) {
    res.setHeader('Set-Cookie', cookie.serialize('gh_name', sign(username)))
  }

  function sign (data) {
    return hmac(data, 0) + '.' + data
  }

  function verify (data) {
    if (!data) return null
    const val = data.slice(64 + 1)
    if ((hmac(val, 0) + '.' + val) !== data) {
      if ((hmac(val, 1) + '.' + val) !== data) {
        return null
      }
    }
    return val
  }

  function decode (req) {
    if (!req.headers.cookie) return null
    const parsed = cookie.parse(req.headers.cookie)
    return verify(parsed.gh_name)
  }
}
