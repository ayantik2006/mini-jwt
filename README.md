# mini-jwt

A minimal JWT-like authentication token implementation built from scratch (HMAC-SHA256) for learning purposes.

## Install

```bash
npm install mini-jwt
```

## Usage

```js
import { sign, verify } from "mini-jwt";

const token = sign({ username: "abcd" }, "15m", "secret");

const payload = verify(token, "secret");
console.log(payload); // { username: "abcd", expiresAt: ... }
```

### `sign(payload, expiresIn, secret)`

Creates a signed token. `expiresIn` is a string like `"15m"`, `"1h"`, `"7d"`, `"1w"`, `"1M"`, or `"1y"`.

### `verify(token, secret)`

Verifies a token's signature and expiration, returning the decoded payload. Throws if the token is malformed, the signature is invalid, or the token has expired.

## Note

This is a learning project, not a production-hardened JWT library. Use a vetted library (e.g. `jsonwebtoken`, `jose`) for real-world auth.

## License

MIT
