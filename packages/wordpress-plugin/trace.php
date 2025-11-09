<?php
/**
 * Plugin Name: OriginaryTrace
 * Plugin URI: https://trace.originary.xyz
 * Description: Track AI crawler traffic and bot analytics directly from your WordPress site.
 * Version: 1.0.0
 * Author: OriginaryTrace Team
 * Author URI: https://trace.originary.xyz
 * License: Apache-2.0
 * License URI: https://www.apache.org/licenses/LICENSE-2.0
 * Text Domain: originary_trace
 */

if (!defined('ABSPATH')) {
    exit; // Exit if accessed directly
}

// Define plugin constants
define('ORIGINARY_TRACE_VERSION', '1.0.0');
define('ORIGINARY_TRACE_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('ORIGINARY_TRACE_PLUGIN_URL', plugin_dir_url(__FILE__));

class OriginaryTrace {
    private static $instance = null;
    private $api_endpoint = 'https://api.trace.originary.xyz';
    private $api_key = '';
    private $api_secret = '';

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        // Load options
        $this->api_key = get_option('originary_trace_api_key', '');
        $this->api_secret = get_option('originary_trace_api_secret', '');
        $this->api_endpoint = get_option('originary_trace_api_endpoint', $this->api_endpoint);

        // Hooks
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'register_settings'));
        add_action('wp_footer', array($this, 'add_policy_headers'), 1);
        add_action('shutdown', array($this, 'log_request'), 0);

        // Add widget
        add_action('widgets_init', array($this, 'register_widget'));
    }

    public function add_admin_menu() {
        add_options_page(
            'OriginaryTrace Settings',
            'OriginaryTrace',
            'manage_options',
            'originary_trace',
            array($this, 'render_settings_page')
        );
    }

    public function register_settings() {
        register_setting('originary_trace_settings', 'originary_trace_api_key');
        register_setting('originary_trace_settings', 'originary_trace_api_secret');
        register_setting('originary_trace_settings', 'originary_trace_api_endpoint');
        register_setting('originary_trace_settings', 'originary_trace_show_widget');
    }

    public function render_settings_page() {
        if (!current_user_can('manage_options')) {
            return;
        }

        // Save settings if form submitted
        if (isset($_POST['originary_trace_submit'])) {
            check_admin_referer('originary_trace_settings');
            update_option('originary_trace_api_key', sanitize_text_field($_POST['originary_trace_api_key']));
            update_option('originary_trace_api_secret', sanitize_text_field($_POST['originary_trace_api_secret']));
            update_option('originary_trace_api_endpoint', esc_url_raw($_POST['originary_trace_api_endpoint']));
            update_option('originary_trace_show_widget', isset($_POST['originary_trace_show_widget']) ? '1' : '0');
            echo '<div class="updated"><p>Settings saved.</p></div>';
        }

        $api_key = get_option('originary_trace_api_key', '');
        $api_secret = get_option('originary_trace_api_secret', '');
        $api_endpoint = get_option('originary_trace_api_endpoint', $this->api_endpoint);
        $show_widget = get_option('originary_trace_show_widget', '0');

        ?>
        <div class="wrap">
            <h1>OriginaryTrace Settings</h1>
            <p>Configure OriginaryTrace to track AI crawler traffic on your WordPress site.</p>

            <form method="post" action="">
                <?php wp_nonce_field('originary_trace_settings'); ?>

                <table class="form-table">
                    <tr>
                        <th scope="row">
                            <label for="originary_trace_api_key">API Key</label>
                        </th>
                        <td>
                            <input type="text"
                                   id="originary_trace_api_key"
                                   name="originary_trace_api_key"
                                   value="<?php echo esc_attr($api_key); ?>"
                                   class="regular-text"
                                   placeholder="Your OriginaryTrace API key ID">
                            <p class="description">Get your API key from your OriginaryTrace dashboard.</p>
                        </td>
                    </tr>

                    <tr>
                        <th scope="row">
                            <label for="originary_trace_api_secret">API Secret</label>
                        </th>
                        <td>
                            <input type="password"
                                   id="originary_trace_api_secret"
                                   name="originary_trace_api_secret"
                                   value="<?php echo esc_attr($api_secret); ?>"
                                   class="regular-text"
                                   placeholder="Your OriginaryTrace API secret">
                            <p class="description">Keep this secret secure. Never share it publicly.</p>
                        </td>
                    </tr>

                    <tr>
                        <th scope="row">
                            <label for="originary_trace_api_endpoint">API Endpoint</label>
                        </th>
                        <td>
                            <input type="url"
                                   id="originary_trace_api_endpoint"
                                   name="originary_trace_api_endpoint"
                                   value="<?php echo esc_attr($api_endpoint); ?>"
                                   class="regular-text">
                            <p class="description">Default: https://api.trace.originary.xyz</p>
                        </td>
                    </tr>

                    <tr>
                        <th scope="row">
                            <label for="originary_trace_show_widget">Show Bot Stats Widget</label>
                        </th>
                        <td>
                            <input type="checkbox"
                                   id="originary_trace_show_widget"
                                   name="originary_trace_show_widget"
                                   value="1"
                                   <?php checked($show_widget, '1'); ?>>
                            <p class="description">Display bot traffic percentage in footer.</p>
                        </td>
                    </tr>
                </table>

                <p class="submit">
                    <input type="submit"
                           name="originary_trace_submit"
                           id="submit"
                           class="button button-primary"
                           value="Save Settings">
                </p>
            </form>

            <hr>

            <h2>Status</h2>
            <?php if ($api_key && $api_secret): ?>
                <p>✅ OriginaryTrace is configured and tracking bot traffic.</p>
                <p><a href="<?php echo esc_url(admin_url('admin.php?page=originary_trace-stats')); ?>" class="button">View Stats</a></p>
            <?php else: ?>
                <p>⚠️ Please configure your API credentials above to start tracking.</p>
                <p><a href="https://trace.originary.xyz/signup" class="button" target="_blank">Get API Key</a></p>
            <?php endif; ?>
        </div>
        <?php
    }

    public function add_policy_headers() {
        if (!headers_sent()) {
            header('PEAC-Policy: access=allowed; train=no; retain=7d');
            header('Link: </.well-known/peac.txt>; rel="policy"');
        }
    }

    public function log_request() {
        // Skip if not configured
        if (empty($this->api_key) || empty($this->api_secret)) {
            return;
        }

        // Skip admin, AJAX, and cron requests
        if (is_admin() || wp_doing_ajax() || wp_doing_cron()) {
            return;
        }

        // Detect bot
        $user_agent = isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : '';
        $is_bot = $this->detect_bot($user_agent);
        $crawler_family = $this->classify_crawler($user_agent);

        // Get client IP (privacy-safe prefix)
        $ip = $this->get_client_ip();
        $ip_prefix = $this->get_ip_prefix($ip);

        // Build event data
        $event = array(
            'ts' => time() * 1000,
            'host' => parse_url(home_url(), PHP_URL_HOST),
            'path' => $_SERVER['REQUEST_URI'],
            'method' => $_SERVER['REQUEST_METHOD'],
            'status' => http_response_code(),
            'ua' => $user_agent,
            'ip_prefix' => $ip_prefix,
            'accept_lang' => isset($_SERVER['HTTP_ACCEPT_LANGUAGE']) ? $_SERVER['HTTP_ACCEPT_LANGUAGE'] : '',
            'is_bot' => $is_bot,
            'crawler_family' => $crawler_family,
            'source' => 'wordpress'
        );

        // Send asynchronously
        $this->send_event_async($event);
    }

    private function detect_bot($user_agent) {
        $ua_lower = strtolower($user_agent);
        $bot_patterns = array('bot', 'crawler', 'spider', 'httpclient', 'fetch', 'curl', 'wget');

        foreach ($bot_patterns as $pattern) {
            if (strpos($ua_lower, $pattern) !== false) {
                return true;
            }
        }

        return false;
    }

    private function classify_crawler($user_agent) {
        $ua_lower = strtolower($user_agent);

        if (strpos($ua_lower, 'gptbot') !== false) return 'gptbot';
        if (strpos($ua_lower, 'claudebot') !== false) return 'claudebot';
        if (strpos($ua_lower, 'googlebot') !== false) return 'googlebot';
        if (strpos($ua_lower, 'bingbot') !== false) return 'bingbot';
        if (strpos($ua_lower, 'baiduspider') !== false) return 'baiduspider';

        if ($this->detect_bot($user_agent)) {
            return 'unknown-bot';
        }

        return 'humanish';
    }

    private function get_client_ip() {
        $ip_keys = array(
            'HTTP_CF_CONNECTING_IP',
            'HTTP_X_REAL_IP',
            'HTTP_X_FORWARDED_FOR',
            'REMOTE_ADDR'
        );

        foreach ($ip_keys as $key) {
            if (isset($_SERVER[$key])) {
                $ip = $_SERVER[$key];
                // Get first IP if comma-separated
                if (strpos($ip, ',') !== false) {
                    $ip = trim(explode(',', $ip)[0]);
                }
                return $ip;
            }
        }

        return '';
    }

    private function get_ip_prefix($ip) {
        if (empty($ip)) return '';

        // IPv6
        if (strpos($ip, ':') !== false) {
            $parts = explode(':', $ip);
            if (count($parts) >= 3) {
                return implode(':', array_slice($parts, 0, 3)) . '::/48';
            }
            return $ip;
        }

        // IPv4
        $parts = explode('.', $ip);
        if (count($parts) >= 3) {
            return $parts[0] . '.' . $parts[1] . '.' . $parts[2] . '.0/24';
        }

        return $ip;
    }

    private function send_event_async($event) {
        $body = json_encode($event);
        $signature = base64_encode(hash_hmac('sha256', $body, $this->api_secret, true));

        wp_remote_post($this->api_endpoint . '/v1/events', array(
            'blocking' => false,
            'timeout' => 1,
            'headers' => array(
                'Content-Type' => 'application/json',
                'X-Peac-Key' => $this->api_key,
                'X-Peac-Signature' => $signature,
                'X-Peac-Timestamp' => $event['ts']
            ),
            'body' => $body
        ));
    }

    public function register_widget() {
        if (get_option('originary_trace_show_widget') === '1') {
            register_widget('OriginaryTrace_Widget');
        }
    }
}

// Widget class
class OriginaryTrace_Widget extends WP_Widget {
    public function __construct() {
        parent::__construct(
            'originary_trace_widget',
            'OriginaryTrace Stats',
            array('description' => 'Display bot traffic statistics')
        );
    }

    public function widget($args, $instance) {
        echo $args['before_widget'];
        echo '<div id="originary_trace-widget" style="padding:10px;background:#f9f9f9;border:1px solid #ddd;border-radius:5px;">';
        echo '<strong>Bot Traffic:</strong> <span id="originary_trace-percentage">Loading...</span>';
        echo '</div>';
        echo '<script>
        fetch("https://api.trace.originary.xyz/v1/public/stats?tenant=' . parse_url(home_url(), PHP_URL_HOST) . '")
            .then(r => r.json())
            .then(d => {
                const pct = d.total ? Math.round((d.bots / d.total) * 100) : 0;
                document.getElementById("originary_trace-percentage").textContent = pct + "%";
            });
        </script>';
        echo $args['after_widget'];
    }
}

// Initialize plugin
OriginaryTrace::get_instance();
