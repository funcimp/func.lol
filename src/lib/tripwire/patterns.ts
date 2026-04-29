// src/lib/tripwire/patterns.ts

export const BOMB_KINDS = ["html", "json", "yaml", "env"] as const
export type BombKind = (typeof BOMB_KINDS)[number]

export const TRIPWIRE_EVENT_NAMES = ["tripwire.hit", "tripwire.throttled"] as const
export type TripwireEventName = (typeof TRIPWIRE_EVENT_NAMES)[number]

export interface TripwireEvent {
  event: TripwireEventName
  // cuid2, generated in src/proxy.ts. Optional because legacy events (and
  // logs from before this field was added) lack it; sync tool falls back
  // to a synthesized id from log.id + ts for those.
  req_id?: string
  ts: string
  path: string
  pattern: string
  ip: string
  query?: string
  category?: Category
  bomb?: BombKind
  ua_raw?: string
  ua_family?: string
}

export function isTripwireEvent(v: unknown): v is TripwireEvent {
  if (!v || typeof v !== "object") return false
  const e = (v as { event?: unknown }).event
  return e === "tripwire.hit" || e === "tripwire.throttled"
}

export type Category =
  | "cms"
  | "framework"
  | "config"
  | "admin"
  | "actuator"
  | "cgi"
  | "metadata"
  | "webshell"

export type PatternShape = "prefix" | "substring"

export interface Pattern {
  token: string
  shape: PatternShape
  category: Category
  // Per-pattern override for the category's default bomb kind. Use when the
  // expected response MIME differs from the category default (e.g. a YAML
  // config file in the `config` category should get a YAML bomb, not env).
  bomb?: BombKind
}

export const categoryToBomb: Record<Category, BombKind> = {
  cms: "html",
  framework: "html",
  admin: "html",
  webshell: "html",
  cgi: "html",
  actuator: "json",
  metadata: "json",
  config: "env",
}

// Strict prefix match. Anything under these directories is never bait.
// Directory-style entries only (end in `/`) so `/_next/anything` is safe but
// `/robots.txt.backup` is not automatically safe via a `/robots.txt` prefix.
export const SAFE_PREFIXES: readonly string[] = [
  "/_next/",
  "/api/",
  "/.well-known/",
  "/x/",
  "/static/",
]

// Exact match only. File-style paths and health-check probes live here so
// they don't accidentally shadow similarly-named paths via prefix-matching.
// "/admin/something" may still be bait, "/admin" is not.
export const SAFE_EXACT_PATHS: readonly string[] = [
  "/",
  "/admin",
  "/login",
  "/signup",
  "/register",
  "/dashboard",
  "/robots.txt",
  "/sitemap.xml",
  "/favicon.ico",
  "/health",
  "/healthz",
  "/status",
  "/ping",
]

// Populated in Task 1b from research/tripwire/patterns.md.
export const PATTERNS: Pattern[] = [
  // CMS: WordPress
  { token: "/wp-login.php",            shape: "prefix",    category: "cms" },
  { token: "/wp-admin/",               shape: "prefix",    category: "cms" },
  { token: "/wp-admin/admin-ajax.php", shape: "prefix",    category: "cms" },
  { token: "/xmlrpc.php",              shape: "prefix",    category: "cms" },
  { token: "/wp-config.php",           shape: "prefix",    category: "cms" },
  { token: "/wp-config.php.bak",       shape: "prefix",    category: "cms" },
  { token: "/wp-content/debug.log",    shape: "prefix",    category: "cms" },
  { token: "/wp-content/uploads/",     shape: "prefix",    category: "cms" },
  { token: "/wp-content/plugins/",     shape: "prefix",    category: "cms" },
  { token: "/wp-json/wp/v2/users",     shape: "prefix",    category: "cms" },
  { token: "/wp-cron.php",             shape: "prefix",    category: "cms" },
  { token: "/readme.html",             shape: "prefix",    category: "cms" },
  { token: "/license.txt",             shape: "prefix",    category: "cms" },

  // CMS: Drupal
  { token: "/user/login",              shape: "prefix",    category: "cms" },
  { token: "/user/register",           shape: "prefix",    category: "cms" },
  { token: "/?q=user/password",        shape: "prefix",    category: "cms" },
  { token: "/CHANGELOG.txt",           shape: "prefix",    category: "cms" },
  { token: "/core/CHANGELOG.txt",      shape: "prefix",    category: "cms" },
  { token: "/sites/default/files/",    shape: "prefix",    category: "cms" },

  // CMS: Joomla
  { token: "/administrator/",          shape: "prefix",    category: "cms" },
  { token: "/administrator/index.php", shape: "prefix",    category: "cms" },
  { token: "/components/com_users/",   shape: "prefix",    category: "cms" },
  { token: "/configuration.php-dist",  shape: "prefix",    category: "cms" },

  // CMS: Magento
  { token: "/magento_version",         shape: "prefix",    category: "cms" },
  { token: "/downloader/",             shape: "prefix",    category: "cms" },

  // Framework: phpunit (CVE-2017-9841) - substring catches all variants
  { token: "eval-stdin.php",           shape: "substring", category: "framework" },
  { token: "/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php",         shape: "prefix", category: "framework" },
  { token: "/vendor/phpunit/phpunit/Util/PHP/eval-stdin.php",             shape: "prefix", category: "framework" },
  { token: "/lib/phpunit/phpunit/src/Util/PHP/eval-stdin.php",            shape: "prefix", category: "framework" },
  { token: "/lib/phpunit/src/Util/PHP/eval-stdin.php",                    shape: "prefix", category: "framework" },
  { token: "/phpunit/src/Util/PHP/eval-stdin.php",                        shape: "prefix", category: "framework" },
  { token: "/laravel/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php", shape: "prefix", category: "framework" },

  // Framework: Laravel
  { token: "/_ignition/execute-solution", shape: "prefix", category: "framework" },
  { token: "/telescope/",              shape: "prefix",    category: "framework" },
  { token: "/storage/logs/laravel.log", shape: "prefix",    category: "framework" },

  // Framework: Symfony
  { token: "/app_dev.php",             shape: "prefix",    category: "framework" },
  { token: "/_profiler/",              shape: "prefix",    category: "framework" },
  { token: "/config.php",              shape: "prefix",    category: "framework" },

  // Framework: ThinkPHP (RCE chain)
  { token: "invokefunction",           shape: "substring", category: "framework" },
  { token: "/index.php?s=/Index/\\think\\app/invokefunction",        shape: "prefix", category: "framework" },
  { token: "/public/index.php?s=/Index/\\think\\app/invokefunction", shape: "prefix", category: "framework" },

  // Framework: Yii / Zend
  { token: "/index.php?r=site/login",  shape: "prefix",    category: "framework" },
  { token: "/ZendServer/",             shape: "prefix",    category: "framework" },

  // Config leaks: .env family
  { token: "/.env",                    shape: "prefix",    category: "config" },
  { token: "/.env.local",              shape: "prefix",    category: "config" },
  { token: "/.env.production",         shape: "prefix",    category: "config" },
  { token: "/.env.backup",             shape: "prefix",    category: "config" },
  { token: "/.env.save",               shape: "prefix",    category: "config" },
  { token: "/.env.dev",                shape: "prefix",    category: "config" },

  // Config leaks: VCS metadata
  { token: "/.git/config",             shape: "prefix",    category: "config" },
  { token: "/.git/HEAD",               shape: "prefix",    category: "config" },
  { token: "/.git/index",              shape: "prefix",    category: "config" },
  { token: "/.gitignore",              shape: "prefix",    category: "config" },
  { token: "/.svn/entries",            shape: "prefix",    category: "config" },
  { token: "/.hg/hgrc",                shape: "prefix",    category: "config" },

  // Config leaks: OS / editor artifacts
  { token: "/.DS_Store",               shape: "prefix",    category: "config" },
  { token: "/.vscode/sftp.json",       shape: "prefix",    category: "config" },
  { token: "/.idea/workspace.xml",     shape: "prefix",    category: "config" },

  // Config leaks: credentials and auth
  { token: "/.aws/credentials",        shape: "prefix",    category: "config" },
  { token: "/.aws/config",             shape: "prefix",    category: "config" },
  { token: "/.ssh/id_rsa",             shape: "prefix",    category: "config" },
  { token: "/.ssh/authorized_keys",    shape: "prefix",    category: "config" },
  { token: "/.npmrc",                  shape: "prefix",    category: "config" },
  { token: "/.htpasswd",               shape: "prefix",    category: "config" },
  { token: "/.htaccess",               shape: "prefix",    category: "config" },

  // Config leaks: generic app config
  { token: "/config.yaml",             shape: "prefix",    category: "config", bomb: "yaml" },
  { token: "/config.yml",              shape: "prefix",    category: "config", bomb: "yaml" },
  { token: "/config.json",             shape: "prefix",    category: "config", bomb: "json" },
  { token: "/docker-compose.yml",      shape: "prefix",    category: "config", bomb: "yaml" },
  { token: "/Dockerfile",              shape: "prefix",    category: "config" },

  // Config leaks: database / archive dumps
  { token: "/backup.sql",              shape: "prefix",    category: "config" },
  { token: "/db.sql",                  shape: "prefix",    category: "config" },
  { token: "/dump.sql",                shape: "prefix",    category: "config" },
  { token: "/backup.zip",              shape: "prefix",    category: "config" },
  { token: "/backup.tar.gz",           shape: "prefix",    category: "config" },
  { token: "/site.tar.gz",             shape: "prefix",    category: "config" },

  // Admin panels
  { token: "/phpmyadmin/",             shape: "prefix",    category: "admin" },
  { token: "/phpMyAdmin/",             shape: "prefix",    category: "admin" },
  { token: "/pma/",                    shape: "prefix",    category: "admin" },
  { token: "/phpmyadmin/index.php",    shape: "prefix",    category: "admin" },
  { token: "/adminer.php",             shape: "prefix",    category: "admin" },
  { token: "/adminer/",                shape: "prefix",    category: "admin" },
  { token: "/manager/html",            shape: "prefix",    category: "admin" },
  { token: "/host-manager/html",       shape: "prefix",    category: "admin" },
  { token: "/solr/",                   shape: "prefix",    category: "admin" },
  { token: "/jenkins/",                shape: "prefix",    category: "admin" },
  { token: "/jenkins/script",          shape: "prefix",    category: "admin" },
  { token: "/kibana/",                 shape: "prefix",    category: "admin" },
  { token: "/_cat/",                   shape: "prefix",    category: "admin" },
  { token: "/server-status",           shape: "prefix",    category: "admin" },
  { token: "/server-info",             shape: "prefix",    category: "admin" },
  { token: "/cacti/",                  shape: "prefix",    category: "admin" },
  { token: "/zabbix/",                 shape: "prefix",    category: "admin" },
  { token: "/grafana/",                shape: "prefix",    category: "admin" },
  { token: "/nagios/",                 shape: "prefix",    category: "admin" },
  { token: "/webadmin/",               shape: "prefix",    category: "admin" },
  { token: "/webmin/",                 shape: "prefix",    category: "admin" },
  { token: "/login.rsp",               shape: "prefix",    category: "admin" },
  { token: "/cgi-bin/luci",            shape: "prefix",    category: "admin" },

  // Actuator / Spring / deployment bait
  { token: "/actuator/",               shape: "prefix",    category: "actuator" },
  { token: "/actuator/env",            shape: "prefix",    category: "actuator" },
  { token: "/actuator/heapdump",       shape: "prefix",    category: "actuator" },
  { token: "/actuator/mappings",       shape: "prefix",    category: "actuator" },
  { token: "/actuator/gateway/routes", shape: "prefix",    category: "actuator" },
  { token: "/actuator/health",         shape: "prefix",    category: "actuator" },
  { token: "/actuator/httptrace",      shape: "prefix",    category: "actuator" },
  { token: "/env",                     shape: "prefix",    category: "actuator" },
  { token: "/trace",                   shape: "prefix",    category: "actuator" },
  { token: "/heapdump",                shape: "prefix",    category: "actuator" },
  { token: "/mappings",                shape: "prefix",    category: "actuator" },
  { token: "/jmx-console/",            shape: "prefix",    category: "actuator" },
  { token: "/invoker/readonly",        shape: "prefix",    category: "actuator" },
  { token: "/web-console/",            shape: "prefix",    category: "actuator" },
  { token: "/hudson/",                 shape: "prefix",    category: "actuator" },
  { token: "/struts/",                 shape: "prefix",    category: "actuator" },

  // Legacy CGI, shell, IIS
  { token: "/cgi-bin/",                shape: "prefix",    category: "cgi" },
  { token: "/cgi-bin/bash",            shape: "prefix",    category: "cgi" },
  { token: "/cgi-bin/.%2e/",           shape: "prefix",    category: "cgi" },
  { token: "/bin/sh",                  shape: "prefix",    category: "cgi" },
  { token: "/scripts/..%255c../winnt/system32/cmd.exe", shape: "prefix", category: "cgi" },
  { token: "/ida.dll",                 shape: "prefix",    category: "cgi" },
  { token: "/iisadmpwd/",              shape: "prefix",    category: "cgi" },
  { token: "/_vti_bin/",               shape: "prefix",    category: "cgi" },
  { token: "/_vti_pvt/",               shape: "prefix",    category: "cgi" },
  { token: "/owa/",                    shape: "prefix",    category: "cgi" },
  { token: "/aspnet_client/",          shape: "prefix",    category: "cgi" },
  { token: "/Trace.axd",               shape: "prefix",    category: "cgi" },
  { token: "/elmah.axd",               shape: "prefix",    category: "cgi" },

  // Cloud metadata / SSRF
  { token: "169.254.169.254",          shape: "substring", category: "metadata" },
  { token: "/latest/meta-data/",       shape: "prefix",    category: "metadata" },
  { token: "/computeMetadata/v1/",     shape: "prefix",    category: "metadata" },
  { token: "/metadata/instance",       shape: "prefix",    category: "metadata" },

  // Webshells / RCE filenames
  { token: "/shell.php",               shape: "prefix",    category: "webshell" },
  { token: "/c99.php",                 shape: "prefix",    category: "webshell" },
  { token: "/r57.php",                 shape: "prefix",    category: "webshell" },
  { token: "/wso.php",                 shape: "prefix",    category: "webshell" },
  { token: "/b374k.php",               shape: "prefix",    category: "webshell" },
  { token: "/alfa.php",                shape: "prefix",    category: "webshell" },
  { token: "/webshell.php",            shape: "prefix",    category: "webshell" },
  { token: "/cmd.php",                 shape: "prefix",    category: "webshell" },
  { token: "/backdoor.php",            shape: "prefix",    category: "webshell" },
  { token: "/upload.php",              shape: "prefix",    category: "webshell" },
  { token: "/filemanager.php",         shape: "prefix",    category: "webshell" },
  { token: "/up.php",                  shape: "prefix",    category: "webshell" },
  { token: "/install.php",             shape: "prefix",    category: "webshell" },
  { token: "/setup.php",               shape: "prefix",    category: "webshell" },
  { token: "/phpinfo.php",             shape: "prefix",    category: "webshell" },
  { token: "/info.php",                shape: "prefix",    category: "webshell" },
  { token: "/test.php",                shape: "prefix",    category: "webshell" },
]

function hasSafePrefix(pathname: string): boolean {
  for (const prefix of SAFE_PREFIXES) {
    if (pathname.startsWith(prefix)) return true
  }
  return false
}

function isSafeExact(pathname: string): boolean {
  return SAFE_EXACT_PATHS.includes(pathname)
}

function matchesPrefix(needle: string, token: string): boolean {
  if (needle.startsWith(token)) return true
  // Directory-style tokens (trailing slash) also match the slashless form so
  // scanners that probe /phpmyadmin (no slash) get bombed the same as those
  // that probe /phpmyadmin/. Only match if the slashless form is followed by
  // end-of-string or a query (?) — never by more path characters, because
  // that would collide with similarly-named paths (e.g. /phpmyadminbackup).
  if (token.endsWith("/")) {
    const stripped = token.slice(0, -1)
    if (needle === stripped) return true
    if (needle.startsWith(stripped + "?")) return true
  }
  return false
}

// Pre-lowered tokens reused across every request. Tokens are static data;
// lowercasing them once at module load avoids ~149 toLowerCase() calls per
// matched request inside matchBait's hot loop.
const LOWERED_PATTERNS: ReadonlyArray<{ pattern: Pattern; token: string }> =
  PATTERNS.map((p) => ({ pattern: p, token: p.token.toLowerCase() }))

export function matchBait(url: URL): Pattern | null {
  if (hasSafePrefix(url.pathname)) return null
  // Safe-exact applies only when there is no query string. Scanner probes
  // like /?q=user/password (Drupageddon, CVE-2014-3704) share pathname "/"
  // with legitimate root traffic, so we can't short-circuit on pathname
  // alone when a query is present.
  if (!url.search && isSafeExact(url.pathname)) return null

  const needle = (url.pathname + url.search).toLowerCase()

  for (const { pattern, token } of LOWERED_PATTERNS) {
    if (pattern.shape === "prefix" && matchesPrefix(needle, token)) return pattern
    if (pattern.shape === "substring" && needle.includes(token)) return pattern
  }

  return null
}
