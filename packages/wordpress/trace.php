<?php
/**
 * Plugin Name: Originary Trace
 * Plugin URI: https://trace.originary.xyz
 * Description: Track AI crawler traffic and enforce PEAC policy compliance
 * Version: 0.1.0
 * Author: Originary
 * Author URI: https://originary.xyz
 * License: Apache 2.0
 * Requires at least: 5.0
 * Requires PHP: 7.4
 * Text Domain: originary-trace
 */

if (!defined('ABSPATH')) {
    exit; // Exit if accessed directly
}

class OriginaryTrace {
    private $api_endpoint;
    private $api_key;
    private $api_secret;
    private $batch_queue = [];

    const TRANSIENT_KEY = 'originary_trace_event_queue';
    const TRANSIENT_EXPIRY = 300; // 5 minutes
    const BATCH_SIZE = 10;

    public function __construct() {
        // Load settings
        $this->api_endpoint = get_option('originary_trace_api_endpoint', 'https://api.trace.originary.xyz');
        $this->api_key = get_option('originary_trace_api_key');
        $this->api_secret = get_option('originary_trace_api_secret');
        
        // Only track if configured
        if ($this->api_key && $this->api_secret) {
            add_action('template_redirect', [$this, 'capture_event']);
            add_action('shutdown', [$this, 'flush_queue']);
        }
        
        // Admin settings
        add_action('admin_menu', [$this, 'add_admin_menu']);
        add_action('admin_init', [$this, 'register_settings']);
    }
    
    /**
     * Capture event on template_redirect (before any output)
     */
    public function capture_event() {
        // Respect DNT and GPC
        if ($this->should_respect_privacy()) {
            return;
        }
        
        // Capture event data
        $event = [
            'ts' => time() * 1000, // milliseconds
            'host' => $_SERVER['HTTP_HOST'] ?? '',
            'path' => $_SERVER['REQUEST_URI'] ?? '/',
            'method' => $_SERVER['REQUEST_METHOD'] ?? 'GET',
            'status' => http_response_code() ?: 200,
            'ua' => $_SERVER['HTTP_USER_AGENT'] ?? '',
            'accept_lang' => $_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? '',
            'source' => 'wordpress',
        ];
        
        // Add to batch queue (in-memory for this request)
        $this->batch_queue[] = $event;
        
        // Also add to transient for persistence across requests
        $queue = get_transient(self::TRANSIENT_KEY) ?: [];
        $queue[] = $event;
        set_transient(self::TRANSIENT_KEY, $queue, self::TRANSIENT_EXPIRY);
        
        // Flush if batch is full
        if (count($queue) >= self::BATCH_SIZE) {
            $this->flush_queue();
        }
    }
    
    /**
     * Flush event queue to Originary Trace API
     */
    public function flush_queue() {
        $queue = get_transient(self::TRANSIENT_KEY);
        
        if (empty($queue)) {
            return;
        }
        
        // Send batch to API
        $this->send_events($queue);
        
        // Clear queue
        delete_transient(self::TRANSIENT_KEY);
    }
    
    /**
     * Send events to Originary Trace API
     */
    private function send_events($events) {
        $body = json_encode($events);
        $timestamp = time() * 1000;
        
        // Generate HMAC signature
        $signature = base64_encode(hash_hmac('sha256', $body, $this->api_secret, true));
        
        // Send non-blocking request
        wp_remote_post($this->api_endpoint . '/v1/events', [
            'blocking' => false, // Non-blocking for performance
            'timeout' => 2,
            'headers' => [
                'Content-Type' => 'application/json',
                'X-Peac-Key' => $this->api_key,
                'X-Peac-Signature' => $signature,
                'X-Peac-Timestamp' => (string)$timestamp,
            ],
            'body' => $body,
        ]);
    }
    
    /**
     * Check if we should respect privacy signals (DNT/GPC)
     */
    private function should_respect_privacy() {
        // Check DNT header
        if (isset($_SERVER['HTTP_DNT']) && $_SERVER['HTTP_DNT'] === '1') {
            return true;
        }
        
        // Check GPC header
        if (isset($_SERVER['HTTP_SEC_GPC']) && $_SERVER['HTTP_SEC_GPC'] === '1') {
            return true;
        }
        
        return false;
    }
    
    /**
     * Add admin menu
     */
    public function add_admin_menu() {
        add_options_page(
            'Originary Trace Settings',
            'Originary Trace',
            'manage_options',
            'originary-trace',
            [$this, 'render_settings_page']
        );
    }

    /**
     * Register settings
     */
    public function register_settings() {
        register_setting('originary_trace', 'originary_trace_api_endpoint');
        register_setting('originary_trace', 'originary_trace_api_key');
        register_setting('originary_trace', 'originary_trace_api_secret');
    }
    
    /**
     * Render settings page
     */
    public function render_settings_page() {
        ?>
        <div class="wrap">
            <h1>Originary Trace Settings</h1>
            <p>Track AI crawler traffic and enforce PEAC policy compliance.</p>

            <form method="post" action="options.php">
                <?php settings_fields('originary_trace'); ?>
                <?php do_settings_sections('originary_trace'); ?>

                <table class="form-table">
                    <tr>
                        <th scope="row">
                            <label for="originary_trace_api_endpoint">API Endpoint</label>
                        </th>
                        <td>
                            <input type="text"
                                   id="originary_trace_api_endpoint"
                                   name="originary_trace_api_endpoint"
                                   value="<?php echo esc_attr(get_option('originary_trace_api_endpoint', 'https://api.trace.originary.xyz')); ?>"
                                   class="regular-text" />
                            <p class="description">Self-hosted? Enter your API URL here.</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">
                            <label for="originary_trace_api_key">API Key</label>
                        </th>
                        <td>
                            <input type="text"
                                   id="originary_trace_api_key"
                                   name="originary_trace_api_key"
                                   value="<?php echo esc_attr(get_option('originary_trace_api_key')); ?>"
                                   class="regular-text"
                                   placeholder="key_..." />
                            <p class="description">Your Originary Trace API key.</p>
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
                                   value="<?php echo esc_attr(get_option('originary_trace_api_secret')); ?>"
                                   class="regular-text" />
                            <p class="description">Your Originary Trace API secret (shown once at creation).</p>
                        </td>
                    </tr>
                </table>

                <?php submit_button(); ?>
            </form>

            <hr>

            <h2>Privacy</h2>
            <p>Originary Trace respects user privacy:</p>
            <ul>
                <li>✅ Respects DNT (Do Not Track)</li>
                <li>✅ Respects GPC (Global Privacy Control)</li>
                <li>✅ No cookies or fingerprinting</li>
                <li>✅ Tracks bot traffic only (not human visitors)</li>
            </ul>

            <h2>Need Help?</h2>
            <p>
                <a href="https://trace.originary.xyz/docs" target="_blank">Documentation</a> |
                <a href="https://github.com/originaryx/trace" target="_blank">GitHub</a>
            </p>
        </div>
        <?php
    }
}

// Initialize plugin
new OriginaryTrace();
