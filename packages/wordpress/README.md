# Originary Trace WordPress Plugin

Track AI crawler traffic and enforce PEAC policy compliance directly from WordPress.

## Features

- ✅ **Zero-code integration** - Install, paste API key, done
- ✅ **Privacy-first** - Respects DNT and GPC signals
- ✅ **Non-blocking** - Zero performance impact
- ✅ **Batch processing** - Events sent in batches for efficiency
- ✅ **Self-hosted friendly** - Configure custom API endpoint

## Installation

### Manual Installation

1. Download `trace.php`
2. Upload to `/wp-content/plugins/originary-trace/`
3. Activate the plugin from WordPress admin
4. Go to Settings → Originary Trace
5. Enter your API key and secret

### From ZIP

1. Go to Plugins → Add New → Upload Plugin
2. Upload `originary-trace.zip`
3. Activate and configure

## Configuration

1. **API Endpoint**: Default is `https://api.trace.originary.xyz` (change for self-hosted)
2. **API Key**: Get from Originary Trace dashboard → Settings → API Keys
3. **API Secret**: Shown once when creating the API key

## Privacy

Originary Trace respects user privacy:

- ✅ Respects DNT (Do Not Track) header
- ✅ Respects GPC (Global Privacy Control) header
- ✅ No cookies or localStorage
- ✅ No fingerprinting
- ✅ Tracks bots only, not human visitors

## Performance

- **Non-blocking requests** - Events sent asynchronously
- **Batch processing** - Reduces API calls
- **Transient caching** - Events persisted across requests
- **Auto-flush** - Sends batch when full or on shutdown

## Requirements

- WordPress 5.0+
- PHP 7.4+

## License

Apache 2.0

## Support

- [Documentation](https://trace.originary.xyz/docs)
- [GitHub](https://github.com/originaryx/trace)
- [Issues](https://github.com/originaryx/trace/issues)
