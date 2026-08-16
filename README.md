# MiniJWT

MiniJWT is a JWT-like authentication token implementation built from scratch, without relying on an existing JWT library, in order to understand how token-based authentication actually works under the hood.

This is an educational project. It is not intended for production authentication and should not be used to protect real systems or user data as-is.

## Why I Built This

JWTs are used everywhere in modern authentication, but most developers only ever interact with them through a library's `sign()`/`verify()` calls. This project exists to open that black box and implement the underlying mechanics directly:

- Base64URL encoding of structured data
- HMAC-SHA256 as a message authentication code
- Constructing a signed token from a header and payload
- Verifying a token's signature
- Detecting tampering via signature mismatch
- Encoding and checking token expiration

## How It Works

A token is built by encoding a header and payload, concatenating them, and signing the result:

```text
Header + Payload
       ↓
   Base64URL
       ↓
Header.Payload
       ↓
HMAC-SHA256 + Secret
       ↓
   Signature
       ↓
Header.Payload.Signature
```

**Signing (`sign`)**

1. A fixed header object (`{ type: "miniJwt", algo: "HS250" }`) is JSON-stringified and Base64URL-encoded.
2. The caller's payload is merged with an `expiresAt` timestamp (computed from `expiresIn`), then JSON-stringified and Base64URL-encoded.
3. The encoded header and payload are joined with a `.` to form `header.payload`.
4. `header.payload` is signed with HMAC-SHA256 using the caller-supplied secret, producing a Base64URL-encoded signature.
5. The final token is `header.payload.signature`.

**Verification (`verify`)**

1. The token is split into three parts on `.`. If there aren't exactly three parts, it's rejected.
2. The header is decoded and its `algo` field is checked against `"HS250"`. A mismatch is rejected.
3. `header.payload` is re-signed with HMAC-SHA256 using the provided secret, and the result is compared against the signature from the token. A mismatch is rejected.
4. The payload is decoded and its `expiresAt` timestamp is compared against the current time. An expired token is rejected.
5. If all checks pass, `expiresAt` is stripped from the decoded payload and the remaining payload object is returned.

## Token Structure

```text
header.payload.signature
```

- **header** — a fixed JSON object identifying the token type and algorithm, Base64URL-encoded.
- **payload** — the caller's data plus an injected `expiresAt` timestamp, Base64URL-encoded.
- **signature** — the HMAC-SHA256 output over `header.payload`, keyed with the secret, Base64URL-encoded.

Base64URL is **encoding, not encryption**. The header and payload are fully readable by anyone who has the token — decoding requires no secret. Only the signature requires the secret, and only the signature is what prevents undetected tampering.

## Cryptography

- **Base64URL** — a URL-safe variant of Base64 (`+`/`/` replaced with `-`/`_`, padding removed). It's a reversible encoding, used here (via `Buffer.toString("base64url")`) purely so the JSON header/payload can be safely embedded in a `.`-delimited string.
- **SHA-256** — a cryptographic hash function producing a fixed-size 256-bit digest from arbitrary input.
- **HMAC** — Hash-based Message Authentication Code. It combines a secret key with the input data through a hash function so that producing a valid output requires knowledge of the key, not just the data.
- **HMAC-SHA256 / HS256** — HMAC constructed using SHA-256 as the underlying hash. This is what `crypto.createHmac("sha256", secret)` computes in `hmacSHA256()`. Note that the header's `algo` field in this implementation is literally the string `"HS250"` (not the conventional `"HS256"`) — this is an internal, non-standard label used only to self-identify MiniJWT tokens, not an indication of a different algorithm.
- **Why the secret is required** — without it, anyone could recompute a valid signature for arbitrary data. The secret is the only thing that makes the signature meaningful.
- **Why tampering is detected** — changing even one byte of the payload changes its Base64URL encoding, which changes `header.payload`, which changes the HMAC-SHA256 output. Since an attacker without the secret cannot compute the new correct signature, `verify()`'s signature comparison fails and the token is rejected.

## Expiration

`sign()` takes an `expiresIn` string consisting of a number followed by a single unit letter:

| Suffix | Unit    |
| ------ | ------- |
| `s`    | seconds |
| `m`    | minutes |
| `h`    | hours   |
| `d`    | days    |
| `w`    | weeks   |
| `M`    | months  |
| `y`    | years   |

Examples: `"15s"`, `"15m"`, `"2h"`, `"7d"`.

Internally, the unit is converted to milliseconds and added to the current time to produce `expiresAt`, which is embedded in the token's encoded payload segment (it is visible to anyone who decodes that segment, secret or no secret). `verify()` uses `expiresAt` to check validity but removes it from the object it returns, so callers only ever see their original claims back.

`s`, `m`, `h`, `d`, and `w` behave as their names suggest. `M` and `y`, however, do not currently mean "month" and "year" in the calendar sense: due to how their millisecond values are derived in the code, `M` actually resolves to **210 days** and `y` to **2520 days** (~6.9 years), not 30 days or 365 days. This is a known quirk of the current implementation rather than an intentional design choice — treat `M` and `y` as unreliable until this is fixed.

`verify()` compares `expiresAt` against `Date.now()` and throws `"Token Expired"` if the token is no longer valid.

## Installation

```bash
npm install @ayantik2006/mini-jwt
```

Or clone the repository directly to read/modify the source:

```bash
git clone https://github.com/ayantik2006/mini-jwt.git
```

## Usage

```js
import { sign, verify } from "@ayantik2006/mini-jwt";
```

### `sign(payload, expiresIn, JWT_SECRET)`

Creates a signed token.

- `payload` — a plain object with the claims to encode.
- `expiresIn` — a string like `"15m"`, `"2h"`, `"7d"` (see [Expiration](#expiration)).
- `JWT_SECRET` — the HMAC signing secret.

Returns the token as a `header.payload.signature` string.

### `verify(token, JWT_SECRET)`

Verifies a token's structure, algorithm, signature, and expiration, and returns the original payload object (with `expiresAt` removed).

Throws an `Error` if:

- the token does not have exactly three `.`-separated parts (`"Invalid token"`)
- the header's `algo` is not `"HS250"` (`"Invalid algorithm"`)
- the recomputed signature does not match (`"Invalid token"`)
- the token has expired (`"Token Expired"`)

## Example

```js
import { sign, verify } from "@ayantik2006/mini-jwt";

const JWT_SECRET = "secret";

const token = sign({ username: "abcd" }, "15m", JWT_SECRET);
console.log(token);
// eyJ0eXBlIjoibWluaUp3dCIsImFsZ28iOiJIUzI1MCJ9.eyJ1c2VybmFtZSI6ImFiY2QiLCJleHBpcmVzQXQiOjE3ODY5MDM5MTQ4MzR9.7hyWk2ofKU2Uava4GdfoTWAgNlBEj1B3fA9AXFZX_oo
// (the payload segment and signature will differ on each run, since expiresAt is based on the current time)

const payload = verify(token, JWT_SECRET);
console.log(payload);
// { username: 'abcd' }
```

## Security

This implementation is educational and demonstrates the core mechanics of token signing and verification. It is **not** a production-ready replacement for established libraries like `jsonwebtoken` or `jose`, and it should not currently be used to authenticate real users or protect real data. Specific limitations in the current code:

- **Non-constant-time signature comparison.** `verify()` compares signatures with `!==`, a standard `String` comparison that can short-circuit on the first differing character. Production implementations use a constant-time comparison (e.g. `crypto.timingSafeEqual`) to reduce the risk of timing side-channel attacks.
- **Single fixed algorithm.** Only one algorithm (HMAC-SHA256, under the non-standard label `"HS250"`) is supported — there is no algorithm negotiation and no `alg: "none"`-style downgrade risk, but also no flexibility to use asymmetric signing (RS256/ES256) or to rotate algorithms.
- **No input validation.** `sign()` assumes `expiresIn` is a well-formed string and `payload` is a plain object; malformed input (e.g. an unrecognized unit letter) will silently produce `NaN` in `expiresAt` rather than throwing a clear error.
- **No standard claim handling.** There is no support for standard JWT registered claims (`iss`, `sub`, `aud`, `nbf`, `iat`, etc.) — only the custom `expiresAt` field is enforced.
- **No key management.** The secret is passed directly into `sign()`/`verify()` on every call; there is no support for key rotation or multiple active keys.
- **Not standards-compliant.** The token format is deliberately inspired by JWT (header.payload.signature, Base64URL, HMAC-SHA256) but does not follow the JWT/JWS RFCs and is not interoperable with standard JWT libraries.

## Project Structure

```text
Mini JWT/
├── src/
│   └── index.js       # sign() and verify() implementation
├── package.json
├── package-lock.json
└── README.md
```

## Learning Outcomes

Working through this project covers:

- How a JWT-style token is structurally assembled from a header, payload, and signature
- Why Base64URL is used for encoding, and why encoding is not the same as encryption
- How HMAC provides message authentication using a shared secret
- How signature verification detects payload tampering
- How token expiration can be embedded in the payload and enforced at verification time
- The gap between a minimal, functionally correct implementation and a standards-compliant, production-grade one

## Future Improvements

- Constant-time signature comparison using `crypto.timingSafeEqual`
- Standard JWT/JWS compatibility (correct `"HS256"` algorithm label, RFC 7519 registered claims)
- Stricter input validation (reject malformed `expiresIn`, non-object payloads, etc.)
- Support for additional signing algorithms (e.g. RS256/ES256)
- Key management and rotation support
- A comprehensive automated test suite

Issues and suggestions can be filed at [github.com/ayantik2006/mini-jwt/issues](https://github.com/ayantik2006/mini-jwt/issues).

## License

MIT — see [LICENSE](https://github.com/ayantik2006/mini-jwt/blob/main/LICENSE) or the `license` field in [package.json](package.json).
