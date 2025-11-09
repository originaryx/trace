=== Originary Trace ===
Contributors: originary
Tags: analytics, bots, crawlers, ai, tracking, peac
Requires at least: 5.0
Tested up to: 6.4
Stable tag: 1.0.0
License: Apache-2.0
License URI: https://www.apache.org/licenses/LICENSE-2.0

Track AI crawler traffic and bot analytics directly from your WordPress site.

== Description ==

Originary Trace helps you understand which AI companies and bots are crawling your WordPress site. Get insights into GPTBot, ClaudeBot, Googlebot, and other crawlers.

**Features:**

* Track bot vs. human traffic
* Identify specific AI crawlers (GPTBot, ClaudeBot, etc.)
* Privacy-first (stores IP prefixes only)
* PEAC-compliant policy headers
* Real-time bot traffic widget
* No JavaScript required for core functionality

**Requirements:**

* Free Trace API key (get one at trace.originary.xyz)
* PHP 7.4 or higher
* WordPress 5.0 or higher

== Installation ==

1. Upload the `originary-trace` folder to `/wp-content/plugins/`
2. Activate the plugin through the 'Plugins' menu in WordPress
3. Go to Settings → Originary Trace
4. Enter your API key and secret from trace.originary.xyz
5. Save settings and start tracking!

== Frequently Asked Questions ==

= Do I need an Originary Trace account? =

Yes, you need a free API key from trace.originary.xyz. Sign up takes less than 1 minute.

= Is this plugin free? =

Yes! Both the plugin and Trace API are free and open source.

= What data is collected? =

We collect:
- URL path
- User agent
- IP prefix (not full IP - privacy-safe)
- Request timestamp
- Response status

We DO NOT collect:
- Full IP addresses
- Personal information
- Form data
- Cookies

= Does this affect site performance? =

No. Events are sent asynchronously and don't block page rendering.

= Is this GDPR compliant? =

Yes. We only store IP prefixes (/24 for IPv4, /48 for IPv6), not full IPs.

== Screenshots ==

1. Settings page - configure your API credentials
2. Bot traffic widget showing real-time statistics
3. Dashboard integration showing bot percentage

== Changelog ==

= 1.0.0 =
* Initial release
* Bot detection and tracking
* PEAC policy headers
* Admin settings page
* Optional bot traffic widget

== Upgrade Notice ==

= 1.0.0 =
Initial release.

== Privacy Policy ==

Originary Trace only stores privacy-safe IP prefixes (not full IPs) and basic request metadata. No personal information is collected. See trace.originary.xyz/privacy for details.
