# Connect fostinisguitars.com

The complete source, 3D models, textures, and images are uploaded to this repository. The app is already published at https://fostinis-design-review.bouncybow11.chatgpt.site, including faded bursts and the server-backed checkout.

The earlier DNS instructions pointed to GitHub Pages. This complete app is hosted on Sites with its existing server, database, and checkout configuration. GitHub stores the source; pushing to this repository does not automatically deploy the Sites host.

## GoDaddy DNS records

In your existing GoDaddy session, open the DNS records for **fostinisguitars.com**. Keep the current nameservers and email records.

1. Replace the four GitHub Pages A records at `@` (`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`) with the two A records below.
2. Change the `www` CNAME from `fostinisguitars-ux.github.io` to the value below.
3. Add the four TXT verification records below. These are host names relative to `fostinisguitars.com`; enter the Name exactly as shown. Use GoDaddy's default TTL.

| Type | Name | Value |
| --- | --- | --- |
| A | `@` | `162.159.143.30` |
| A | `@` | `172.66.3.26` |
| CNAME | `www` | `custom-domains.chatgpt.site` |
| TXT | `_openai-site-verification` | `openai-site-verification=UjSkuWirbFAsbCxZzIbPFqGVZPkjYgp0m8hi2ky39c0` |
| TXT | `_cf-custom-hostname` | `2966f092-5f54-4e63-9651-ca699e97cc21` |
| TXT | `_openai-site-verification.www` | `openai-site-verification=C3u9nrVVrylNXcS_gHBVL_UAcXVREFn22DfXGJpK3-E` |
| TXT | `_cf-custom-hostname.www` | `b1559dc4-4df6-4fed-a87f-370929307f50` |

Leave MX, SPF, DKIM, DMARC, and other unrelated records unchanged. If the website A or CNAME records already match the table, keep them and add any missing verification records.

## Completion

Both `fostinisguitars.com` and `www.fostinisguitars.com` were confirmed active by Sites on October 17, 2026, with active HTTPS certificates. The complete site is published as version 49. The records above are the current working configuration; no further DNS changes are needed.

The old GitHub repository state is preserved in branch `backup-before-showroom-2026-10-17`.
