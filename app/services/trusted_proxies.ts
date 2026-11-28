/**
 * The `trustProxy` setting of the HTTP server from TRUSTED_PROXIES
 * (D-479): a comma-separated list of addresses or CIDR ranges, normally
 * only nginx's address on the Compose network. nginx takes the client
 * address from Cloudflare's `CF-Connecting-IP` and sends it on as the
 * only `X-Forwarded-For` value, so request.ip() is the pupil's or
 * teacher's real IP.
 *
 * Empty or unset trusts nobody: request.ip() is the socket address and
 * every X-Forwarded-* header is ignored. (The framework default trusts
 * loopback, which would let anything on the host forge an IP.)
 */
export function trustedProxies(value: string | undefined): string[] | false {
  const list = (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
  return list.length > 0 ? list : false
}
