const http = require('http')
const admin = require('./')

// dummy github app for testing
const login = admin({
  clientId: '9819fa962e193b7b0aad',
  clientSecret: 'a3377e51f17575dd7f25b51ac0d7a36db8153835',
  users: ['mafintosh']
})

const server = http.createServer(function (req, res) {
  login(req, res, function (err, username) {
    if (err) throw err
    res.end('hello ' + username)
  })
})

server.listen(3000)
