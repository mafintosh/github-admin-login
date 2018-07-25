const http = require('http')
const admin = require('./')

const login = admin({
  clientId: '.',
  clientSecret: '.'
})

const server = http.createServer(function (req, res) {
  login(req, res, function (err, username) {
    if (err) throw err
    console.log(login.decode(req))
    login.encode(res, 'mathias')
    res.end('hi')
  })
})

server.listen(3000)
