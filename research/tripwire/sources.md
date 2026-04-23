# Sources

Annotated bibliography for the tripwire bait-path list. Each source fed specific entries in [`patterns.md`](patterns.md).

## Wordlists and scanner corpora

### SecLists (Daniel Miessler)

- URL: <https://github.com/danielmiessler/SecLists>
- Relevant paths: `Discovery/Web-Content/common.txt`, `Discovery/Web-Content/raft-small-files.txt`, `Discovery/Web-Content/raft-large-directories.txt`, `Discovery/Web-Content/big.txt`, `Discovery/Web-Content/CMS/wp-plugins.fuzz.txt`.
- Role: the de facto corpus used by `gobuster`, `ffuf`, `dirb`, `wfuzz`. Scanners that imitate penetration testers draw from these lists. The top entries of `common.txt` are the first paths any `gobuster` run hits, which makes them reliable signal of automated probing. Our WordPress paths, config-file leaks, and generic admin-panel tokens are drawn from these lists.

### nuclei-templates (ProjectDiscovery)

- URL: <https://github.com/projectdiscovery/nuclei-templates>
- Relevant directories: `http/exposures/configs/`, `http/exposures/files/`, `http/exposures/backups/`, `http/vulnerabilities/`, `http/misconfiguration/`, `http/cves/`.
- Role: the templates drive the `nuclei` scanner, which is one of the most common sources of live probe traffic observed in honeypots since 2022. Templates include the exact HTTP paths and request patterns the scanner fires. Our `.env`, `.git/config`, Spring Boot actuator, and phpunit paths mirror active nuclei templates.

### OWASP CRS (Core Rule Set)

- URL: <https://github.com/coreruleset/coreruleset>
- Relevant files: `rules/REQUEST-913-SCANNER-DETECTION.conf`, `rules/REQUEST-930-APPLICATION-ATTACK-LFI.conf`, `rules/REQUEST-933-APPLICATION-ATTACK-PHP.conf`.
- Role: the ModSecurity rule set that ships with many WAFs. Its scanner-detection and LFI rules catalog the exact path fragments that indicate hostile probing. If CRS flags a request as a scanner probe, we want that request to get a gzip bomb instead of a 404.

## CVE and vulnerability references

### CVE-2017-9841 — phpunit eval-stdin

- URL: <https://nvd.nist.gov/vuln/detail/CVE-2017-9841>
- Vulnerable path: `/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php`.
- Role: unauthenticated remote code execution in phpunit versions shipped inside Composer packages. Still one of the most probed paths in 2024–2026 traffic. The path and its variants (`/vendor/phpunit/...`, `/lib/phpunit/...`, `/laravel/vendor/phpunit/...`) dominate the phpunit category.

### CVE-2021-41773 — Apache HTTP Server path traversal

- URL: <https://nvd.nist.gov/vuln/detail/CVE-2021-41773>
- Vulnerable paths: `/cgi-bin/%2e%2e/%2e%2e/etc/passwd`, `/icons/.%2e/%2e%2e/etc/passwd`.
- Role: path-traversal and RCE in Apache 2.4.49/2.4.50. Drives the `/cgi-bin/` and encoded-traversal probe traffic.

### CVE-2022-22965 — Spring4Shell

- URL: <https://nvd.nist.gov/vuln/detail/CVE-2022-22965>
- Role: RCE in Spring Framework. Triggers actuator-endpoint probing (`/actuator/env`, `/actuator/heapdump`, `/actuator/mappings`, `/env`, `/trace`) and generic Spring-Boot path scans.

### CVE-2021-44228 — Log4Shell

- URL: <https://nvd.nist.gov/vuln/detail/CVE-2021-44228>
- Role: the payload is an HTTP header, not a path. Relevant here because Log4Shell scanners also fingerprint endpoints that might reach vulnerable loggers. They probe `/actuator`, `/api`, login pages, and Solr admin paths to find a log-writing endpoint.

### CVE-2019-6340 — Drupalgeddon2 and friends

- URL: <https://nvd.nist.gov/vuln/detail/CVE-2019-6340>, <https://nvd.nist.gov/vuln/detail/CVE-2018-7600>
- Vulnerable paths: `/user/register`, `/node/add`, `/?q=user/password`.
- Role: Drupal RCE chains. Scanners fingerprint Drupal via `CHANGELOG.txt`, `/core/CHANGELOG.txt`, and `/user/login`.

### CVE-2018-1273 — Spring Data Commons

- URL: <https://nvd.nist.gov/vuln/detail/CVE-2018-1273>
- Role: RCE via property binding. Contributes to the Spring-bait category.

### CVE-2019-3396, CVE-2022-26134 — Atlassian Confluence

- URL: <https://nvd.nist.gov/vuln/detail/CVE-2022-26134>
- Vulnerable paths: `/pages/createpage-entervariables.action`, `/wiki/rest/...`.
- Role: Confluence RCE. Less generic than WordPress but seen in broad scans.

### ThinkPHP RCE (2018-2024)

- URL: <https://github.com/vulhub/vulhub/tree/master/thinkphp>
- Vulnerable paths: `/index.php?s=/Index/\\think\\app/invokefunction`, `/public/index.php?s=...`.
- Role: ThinkPHP is widely deployed in Chinese-origin hosting; its RCE paths show up heavily in global scan traffic.

### WordPress xmlrpc.php

- URL: <https://wordpress.org/documentation/article/xml-rpc/>, <https://www.wordfence.com/blog/2015/10/brute-force-attacks-multicall/>
- Vulnerable path: `/xmlrpc.php`.
- Role: amplifies brute-force attempts via `system.multicall` and enables pingback-based DDoS. One of the top five most-probed paths on any WordPress-adjacent site.

## Honeypot and traffic analysis

### GreyNoise Labs blog

- URL: <https://www.greynoise.io/blog>
- Role: GreyNoise runs a global sensor network and publishes regular writeups on mass scanning activity. Posts on `/.env` probing, CVE-2022-46169 (Cacti), and post-disclosure scanner bursts informed the credential-leak and admin-panel categories.

### Cloudflare Radar and Threat Intelligence

- URL: <https://radar.cloudflare.com/>, <https://blog.cloudflare.com/>
- Role: Cloudflare sees a meaningful fraction of global HTTP traffic. Their 2023–2024 posts on WAF-blocked requests confirm that `.env`, `wp-login.php`, `xmlrpc.php`, and phpunit paths dominate hostile probe volume.

### SANS Internet Storm Center

- URL: <https://isc.sans.edu/>
- Role: daily handler diaries since 2001, many covering specific probe paths observed in honeypots. Cited for long-tail paths like `/shell.php`, `/r57.php`, `/c99.php`, and the IIS/CGI legacy category.

### Rapid7 AttackerKB and research posts

- URL: <https://attackerkb.com/>, <https://www.rapid7.com/blog/>
- Role: per-CVE analysis with reproduction HTTP requests. Source for the Atlassian, F5 BIG-IP, and Citrix ADC categories.

### Sucuri and Wordfence threat reports

- URL: <https://blog.sucuri.net/>, <https://www.wordfence.com/blog/>
- Role: WordPress-specific. Quarterly reports identify the plugin, theme, and core paths attackers hit most. Source for the WordPress-plugin category (`/wp-content/plugins/<plugin>/...`).

### VulnCheck and independent honeypot researchers

- URL: <https://vulncheck.com/blog>, various
- Role: post-CVE exploit-in-the-wild tracking. Useful for knowing which freshly disclosed CVEs are being scanned at scale.

## Defense techniques and prior art

### Ache — "HTML Zip Bomb"

- URL: <https://ache.one/notes/html_zip_bomb>
- Role: wraps the bomb in a valid HTML5 document with a multi-gigabyte HTML comment. Compression ratio ~1:1030 (e.g., ~10KB on disk, ~10GB decompressed). Effective against Selenium, headless Chrome, and any scanner that begins HTML parsing before size checks. The article pairs the bomb with a `robots.txt` disallow — the same consent-based shape we use. Motivated as a defense against LLM crawlers that ignore `robots.txt`.

## Reference indexes

### Exploit Database (Offensive Security)

- URL: <https://www.exploit-db.com/>
- Role: canonical exploit archive. PoC URLs in published exploits become scanner templates within days. Many entries in [`patterns.md`](patterns.md) trace back to specific EDB IDs.

### MITRE CVE

- URL: <https://cve.mitre.org/>, <https://nvd.nist.gov/>
- Role: authoritative CVE descriptions. Every named exploit in [`patterns.md`](patterns.md) resolves to a CVE here.

### Wikipedia, selectively

- URL: <https://en.wikipedia.org/wiki/Log4Shell>, <https://en.wikipedia.org/wiki/Heartbleed>
- Role: accessible context for the biggest named vulnerabilities. Not a primary technical source.
