# github-admin-login

HTTP auth module to require admin page users to be in a Github org

```
npm install github-admin-login
```

## Usage

``` js
const adminLogin = require('github-admin-login')
const http = require('http')

const login = adminLogin({
  clientId: githubOauthClientId,
  clientSecret: githubOauthClientSecret,
  users: [
    'mafintosh' // users that are allowd to login
  ]
})

http.createServer(function (req, res) {
  login(req, res, function (err, username) {
    if (err) throw err
    console.log('valid login from', username)
  })
}).listen(10000)
```

## API

#### `login = adminLogin(opts)`

Create a Github admin login http handler.

Options include:

```js
{
  clientId: githubOauthClientId,
  clientSecret: githubOauthClientSecret,
  users: optionalArrayOfValidUsers,
  organization: optionalValidGithubOrg
}
```

Only users in the `users` array of users who are in the org
specified will be allowed to login.

If a non valid user logs in the server will return a 403.

#### `username = login.decode(req)`

Returns the Github username of the current user logged in.

## License

MIT
