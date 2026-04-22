# Patterns

The canonical bait-path list. Every token here is either a literal path or a path fragment a scanner fires at. Entries are grouped by category. Each entry names the pattern, the reason attackers hit it, and at least one source from [`sources.md`](sources.md).

Notation: tokens beginning with `/` are exact path prefixes. Tokens without a leading slash are substrings suitable for a contains match. Tokens ending in `/` are directory prefixes.

## 1. CMS exploits

### WordPress

| Token | Why attackers hit this | Source |
| ----- | ---------------------- | ------ |
| `/wp-login.php` | Brute-force login, credential stuffing. Highest-volume bait path on any IPv4 address. | SecLists `common.txt`, Wordfence reports |
| `/wp-admin/` | Admin dashboard probe. Only after credential compromise, but fingerprinted constantly. | SecLists `common.txt` |
| `/wp-admin/admin-ajax.php` | Endpoint abused by many plugin CVEs. | nuclei-templates `http/vulnerabilities/wordpress/` |
| `/xmlrpc.php` | `system.multicall` amplifies brute force. Pingback enables reflected DDoS. | Wordfence 2015 post, Cloudflare WAF reports |
| `/wp-config.php` | If writable or backed up, leaks DB credentials. Variants: `/wp-config.php.bak`, `/wp-config.php.swp`, `/wp-config.php.old`. | SecLists `raft-small-files.txt`, nuclei `http/exposures/backups/` |
| `/wp-config.php.bak` | Backup left in webroot. | nuclei-templates |
| `/wp-content/debug.log` | Leaks stack traces with paths, DB names, plugin versions. | nuclei-templates |
| `/wp-content/uploads/` | Directory listing bait. Also bait for `.php` files uploaded via CVE. | Sucuri |
| `/wp-content/plugins/` | Plugin enumeration. Prefix for thousands of plugin-specific CVEs. | SecLists `CMS/wp-plugins.fuzz.txt` |
| `/wp-json/wp/v2/users` | REST API username disclosure, CVE-2017-5487. | nuclei-templates |
| `/wp-cron.php` | Can be hammered to DoS the site. | Wordfence |
| `/readme.html` | WordPress version fingerprinting. | nuclei-templates |
| `/license.txt` | WordPress version fingerprinting. | nuclei-templates |

### Drupal

| Token | Why attackers hit this | Source |
| ----- | ---------------------- | ------ |
| `/user/login` | Drupal admin login fingerprint. | SecLists `common.txt` |
| `/user/register` | CVE-2018-7600 (Drupalgeddon2) attack surface. | CVE-2018-7600, vulhub |
| `/?q=user/password` | CVE-2014-3704 (Drupageddon) SQL injection. | Exploit-DB |
| `/CHANGELOG.txt` | Drupal version disclosure. Also Joomla and generic. | nuclei-templates |
| `/core/CHANGELOG.txt` | Drupal 8+ version disclosure. | nuclei-templates |
| `/sites/default/files/` | Default file directory, fingerprints Drupal and probes for uploads. | SecLists |

### Joomla

| Token | Why attackers hit this | Source |
| ----- | ---------------------- | ------ |
| `/administrator/` | Joomla admin panel. Specific enough to not collide with generic admin routes. | SecLists `common.txt` |
| `/administrator/index.php` | Joomla admin login. | SecLists |
| `/components/com_users/` | Component path, fingerprints Joomla. | nuclei-templates |
| `/configuration.php-dist` | Dist file disclosure. | nuclei-templates |

### Magento

| Token | Why attackers hit this | Source |
| ----- | ---------------------- | ------ |
| `/magento_version` | Version disclosure endpoint. | nuclei-templates |
| `/downloader/` | Legacy Magento 1 installer path. | SecLists |
| `/admin/` (Magento 2) | Excluded here as too generic; see "Excluded" below. | — |

## 2. Framework and library exploits

### phpunit (CVE-2017-9841)

| Token | Why attackers hit this | Source |
| ----- | ---------------------- | ------ |
| `/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php` | Unauthenticated RCE when phpunit ships in production. Canonical path. | CVE-2017-9841, nuclei-templates |
| `/vendor/phpunit/phpunit/Util/PHP/eval-stdin.php` | Variant path in older phpunit versions. | nuclei-templates |
| `/lib/phpunit/phpunit/src/Util/PHP/eval-stdin.php` | Nested-install variant. | nuclei-templates |
| `/lib/phpunit/src/Util/PHP/eval-stdin.php` | Variant. | nuclei-templates |
| `/phpunit/src/Util/PHP/eval-stdin.php` | Top-level variant. | nuclei-templates |
| `/laravel/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php` | Laravel-specific variant. | nuclei-templates |
| `eval-stdin.php` | Substring match catches all variants in one rule. | CVE-2017-9841 |

### Laravel

| Token | Why attackers hit this | Source |
| ----- | ---------------------- | ------ |
| `/.env` | Laravel writes secrets to `.env`. Covered in credential-leak category below; also the single most-probed bait path in 2024 honeypot traffic. | GreyNoise, nuclei |
| `/_ignition/execute-solution` | CVE-2021-3129, Laravel debug-mode RCE via Ignition. | CVE-2021-3129, nuclei-templates |
| `/telescope/` | Debug panel. Leaks requests, queries, logs. | nuclei-templates |
| `/storage/logs/laravel.log` | Log disclosure. | nuclei-templates |

### Symfony

| Token | Why attackers hit this | Source |
| ----- | ---------------------- | ------ |
| `/app_dev.php` | Debug front controller. Leaks config and enables profiler access. | nuclei-templates |
| `/_profiler/` | Symfony profiler, leaks everything about a request. | nuclei-templates |
| `/config.php` | Symfony web-installer. | nuclei-templates |

### ThinkPHP (RCE chain)

| Token | Why attackers hit this | Source |
| ----- | ---------------------- | ------ |
| `/index.php?s=/Index/\\think\\app/invokefunction` | ThinkPHP 5.x RCE. Seen in huge volumes globally. | vulhub, nuclei-templates |
| `/public/index.php?s=/Index/\\think\\app/invokefunction` | Variant. | nuclei-templates |
| `invokefunction` | Substring match for all variants. | nuclei-templates |

### Yii / Zend

| Token | Why attackers hit this | Source |
| ----- | ---------------------- | ------ |
| `/index.php?r=site/login` | Yii login fingerprint. | SecLists |
| `/ZendServer/` | Zend Server console. | SecLists |

## 3. Credential and config leaks

| Token | Why attackers hit this | Source |
| ----- | ---------------------- | ------ |
| `/.env` | Laravel, Rails, Node, Python all write secrets here. Highest-value target per-request. | GreyNoise, nuclei `http/exposures/configs/` |
| `/.env.local` | Local overrides, often committed by mistake. | nuclei-templates |
| `/.env.production` | Production secrets. | nuclei-templates |
| `/.env.backup` | Backup copies left in webroot. | nuclei-templates |
| `/.env.save` | Editor save file. | nuclei-templates |
| `/.env.dev` | Dev credentials, often reused. | nuclei-templates |
| `/.git/config` | Leaks remote URL and branch info. Root of a `git` dump attack. | nuclei `http/exposures/configs/git-config.yaml` |
| `/.git/HEAD` | Confirms `.git` directory exposure. | nuclei-templates |
| `/.git/index` | Tree index, enables full repo reconstruction. | nuclei-templates |
| `/.gitignore` | Hints at what other secret files might exist. | SecLists |
| `/.svn/entries` | Legacy SVN metadata. | SecLists |
| `/.hg/hgrc` | Mercurial metadata. | nuclei-templates |
| `/.DS_Store` | macOS directory listing. Reveals filenames. | nuclei-templates |
| `/.aws/credentials` | AWS access keys. | nuclei-templates |
| `/.aws/config` | AWS config. | nuclei-templates |
| `/.ssh/id_rsa` | Private SSH keys. Rare in webroot but attackers still check. | SecLists |
| `/.ssh/authorized_keys` | Account takeover if writable. | SecLists |
| `/.npmrc` | npm auth tokens. | nuclei-templates |
| `/.htpasswd` | Basic-auth password hashes. | SecLists `common.txt` |
| `/.htaccess` | Apache config, reveals rewrite rules and hidden paths. | SecLists |
| `/config.yaml` | Generic app config. | nuclei-templates |
| `/config.yml` | Generic app config variant. | nuclei-templates |
| `/config.json` | Generic app config variant. | nuclei-templates |
| `/docker-compose.yml` | Infrastructure layout and service credentials. | nuclei-templates |
| `/Dockerfile` | Build-time secrets. | nuclei-templates |
| `/backup.sql` | Database dump. | SecLists `raft-small-files.txt` |
| `/db.sql` | Database dump variant. | SecLists |
| `/dump.sql` | Database dump variant. | SecLists |
| `/backup.zip` | Generic backup archive. | SecLists |
| `/backup.tar.gz` | Generic backup archive. | SecLists |
| `/site.tar.gz` | Full-site archive. | SecLists |
| `/wp-config.php.bak` | Covered above under WordPress. | — |
| `/.vscode/sftp.json` | SFTP credentials from VS Code extension. | nuclei-templates |
| `/.idea/workspace.xml` | JetBrains project metadata; can leak paths and DB connections. | nuclei-templates |

## 4. Admin panels

| Token | Why attackers hit this | Source |
| ----- | ---------------------- | ------ |
| `/phpmyadmin/` | MySQL admin UI. Massive install base, many unpatched. | SecLists `common.txt` |
| `/phpMyAdmin/` | Case variant; some servers are case-sensitive. | SecLists |
| `/pma/` | Common alias. | SecLists |
| `/phpmyadmin/index.php` | Direct login. | SecLists |
| `/adminer.php` | Single-file DB admin. | SecLists |
| `/adminer/` | Directory variant. | SecLists |
| `/manager/html` | Tomcat Manager. CVE-2017-12617 and default-cred abuse. | SecLists, nuclei |
| `/host-manager/html` | Tomcat Host Manager. | SecLists |
| `/solr/` | Apache Solr admin, multiple RCEs. | nuclei-templates |
| `/jenkins/` | Jenkins UI. Script console RCE if auth weak. | SecLists |
| `/jenkins/script` | Groovy script console, direct RCE. | nuclei-templates |
| `/kibana/` | Kibana UI, CVE-2019-7609 RCE. | nuclei-templates |
| `/_cat/` | Elasticsearch cat API, version disclosure. | nuclei-templates |
| `/server-status` | Apache mod_status, leaks every active request URL. | SecLists, nuclei |
| `/server-info` | Apache mod_info. | SecLists |
| `/cacti/` | Cacti monitoring, CVE-2022-46169 RCE. | nuclei-templates, GreyNoise |
| `/zabbix/` | Zabbix frontend. | SecLists |
| `/grafana/` | Grafana. CVE-2021-43798 path traversal. | nuclei-templates |
| `/nagios/` | Nagios web UI. | SecLists |
| `/webadmin/` | Generic but narrow enough; Webmin and variants. | SecLists |
| `/webmin/` | Webmin admin. | SecLists |
| `/login.rsp` | RouterOS login. | SecLists |
| `/cgi-bin/luci` | OpenWRT LuCI interface. | SecLists |

## 5. Spring / Java actuator and deployment bait

| Token | Why attackers hit this | Source |
| ----- | ---------------------- | ------ |
| `/actuator/` | Spring Boot actuator root. Index of all exposed endpoints. | nuclei `http/misconfiguration/springboot/` |
| `/actuator/env` | Environment variables including secrets. | nuclei-templates |
| `/actuator/heapdump` | Heap dump; secrets live in memory strings. | nuclei-templates |
| `/actuator/mappings` | Full route map of the app. | nuclei-templates |
| `/actuator/gateway/routes` | Spring Cloud Gateway routes, CVE-2022-22947 RCE. | nuclei-templates |
| `/actuator/health` | Liveness endpoint, also fingerprints Spring. | nuclei-templates |
| `/actuator/httptrace` | Recent requests with headers. | nuclei-templates |
| `/env` | Pre-2.0 Spring Boot actuator endpoint. | nuclei-templates |
| `/trace` | Pre-2.0 actuator endpoint. | nuclei-templates |
| `/heapdump` | Pre-2.0 actuator endpoint. | nuclei-templates |
| `/mappings` | Pre-2.0 actuator endpoint. | nuclei-templates |
| `/jmx-console/` | JBoss JMX console, historical RCE. | SecLists |
| `/invoker/readonly` | JBoss invoker abuse. | SecLists |
| `/web-console/` | JBoss web console. | SecLists |
| `/hudson/` | Hudson, Jenkins precursor. | SecLists |
| `/struts/` | Struts RCE probes (CVE-2017-5638 and family). | nuclei-templates |

## 6. Legacy CGI, shell, IIS

| Token | Why attackers hit this | Source |
| ----- | ---------------------- | ------ |
| `/cgi-bin/` | CVE-2014-6271 (Shellshock), CVE-2021-41773 traversal. | CVE, SANS ISC |
| `/cgi-bin/bash` | Shellshock direct probe. | SANS ISC |
| `/cgi-bin/.%2e/` | CVE-2021-41773 encoded traversal. | CVE-2021-41773 |
| `/bin/sh` | Generic shell-path probe. | SecLists |
| `/scripts/..%255c../winnt/system32/cmd.exe` | Classic IIS Unicode vulnerability (MS00-078). | SecLists |
| `/ida.dll` | IIS ISAPI legacy. | SecLists |
| `/iisadmpwd/` | IIS admin password utility. | SecLists |
| `/_vti_bin/` | FrontPage Server Extensions. | SecLists |
| `/_vti_pvt/` | FrontPage private directory. | SecLists |
| `/owa/` | Outlook Web Access. Probed heavily post CVE-2021-26855 (ProxyLogon). | nuclei-templates |
| `/aspnet_client/` | Legacy ASP.NET path. | SecLists |
| `/Trace.axd` | ASP.NET trace viewer. | nuclei-templates |
| `/elmah.axd` | ELMAH error-log viewer, often exposed. | nuclei-templates |

## 7. Cloud metadata and SSRF probes

SSRF probes arrive as query-parameter values more often than URL paths, but these path fragments do show up in scans that look for open proxies and misconfigured gateways.

| Token | Why attackers hit this | Source |
| ----- | ---------------------- | ------ |
| `169.254.169.254` | AWS/GCP/Azure metadata IP. Appears in URL paths when a server is probed as a proxy. | nuclei `http/vulnerabilities/generic/ssrf-via-proxy.yaml` |
| `/latest/meta-data/` | AWS IMDS path. | nuclei-templates |
| `/computeMetadata/v1/` | GCP metadata path. | nuclei-templates |
| `/metadata/instance` | Azure IMDS path. | nuclei-templates |

Caveat: these are useful as substring matches inside query strings and in paths on proxy-style endpoints. Bare hits on a Next.js origin are likely SSRF scans from scanners who assume everything is a proxy.

## 8. Shell and RCE-as-a-service paths

These are the filenames attackers upload as webshells. Scanners probe them to find existing backdoors on already-compromised sites, which lets them piggyback.

| Token | Why attackers hit this | Source |
| ----- | ---------------------- | ------ |
| `/shell.php` | Generic webshell filename. | SecLists, SANS ISC |
| `/c99.php` | c99 shell, classic PHP webshell. | SecLists |
| `/r57.php` | r57 shell, classic. | SecLists |
| `/wso.php` | WSO shell. | SecLists |
| `/b374k.php` | b374k shell. | SecLists |
| `/alfa.php` | AlfaShell. | SecLists |
| `/webshell.php` | Generic. | SecLists |
| `/cmd.php` | Generic. | SecLists |
| `/backdoor.php` | Generic. | SecLists |
| `/upload.php` | Upload endpoint, often abused. | SecLists |
| `/filemanager.php` | File-manager plugin probe. | SecLists |
| `/up.php` | Short upload filename. | SecLists |
| `/adminer.php` | Listed under admin panels; also used as a planted backdoor. | — |
| `/install.php` | Fresh-install pages often skip auth. | SecLists |
| `/setup.php` | Variant. | SecLists |
| `/phpinfo.php` | Info disclosure. | SecLists `common.txt` |
| `/info.php` | Info disclosure variant. | SecLists |
| `/test.php` | Generic debug endpoint. | SecLists |

## Excluded

Paths we considered and rejected because the collision risk with legitimate traffic on a Next.js site is too high:

- `/admin` and `/admin/` alone. Many SaaS products and small apps legitimately serve a route at `/admin`. Keep the specific CMS admin paths (`/wp-admin`, `/administrator`, `/phpmyadmin`) and skip the bare ones.
- `/api/`. Next.js uses this prefix. Any blanket rule here would poison legitimate API traffic.
- `/login`, `/signup`, `/register`, `/dashboard`. Generic UI routes. Real apps use them.
- `/backup/` as a directory prefix. Too broad. Keep the specific filenames (`/backup.sql`, `/backup.zip`) which imply a left-behind artifact.
- `/config/` as a directory prefix. Next.js config and public config tooling may serve under this prefix on some apps. Keep the specific config filenames.
- `/robots.txt` and `/sitemap.xml`. These are the honest crawler signals. Do not trap them.
- `/favicon.ico` and friends. Universal.
- `/.well-known/` and its children. Legitimate protocol-defined paths (ACME, WebFinger, security.txt). Never trap.
- `/_next/` and anything under it. Next.js internals.
- Generic `.bak` and `.old` suffix-only matching. Too broad. Keep the specific `/wp-config.php.bak` style entries where the base name itself is suspicious.
- Bare `.php` matching. Legitimate in some deployments. Match on specific filenames only.
- `/status`, `/health`, `/healthz`, `/ping`. Load balancer and observability probes use these. Keep `/server-status` (Apache-specific) and `/actuator/health` (Spring-specific) instead.
