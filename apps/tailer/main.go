package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/nxadm/tail"
)

var lineRe = regexp.MustCompile(`^(\d+\.\d+)\s+"(\w+)\s+([^\s]+)\s+HTTP/[\d.]+"\s+(\d+)\s+(\d+)\s+"([^"]*)"\s+([^\s]+)\s+([^\s]*)\s+([\d.]+)\s+([^\s]+)\s+([^\s]+)`)

type Config struct {
	LogFile  string
	Endpoint string
	APIKey   string
	Secret   string
}

type CrawlEvent struct {
	Timestamp     int64  `json:"ts"`
	Host          string `json:"host"`
	Path          string `json:"path"`
	Method        string `json:"method"`
	Status        int    `json:"status"`
	UserAgent     string `json:"ua"`
	IPPrefix      string `json:"ip_prefix"`
	AcceptLang    string `json:"accept_lang,omitempty"`
	CrawlerFamily string `json:"crawler_family"`
	Source        string `json:"source"`
}

func main() {
	cfg := Config{}
	flag.StringVar(&cfg.LogFile, "file", "/var/log/nginx/peac.log", "Path to nginx log file")
	flag.StringVar(&cfg.Endpoint, "endpoint", "http://localhost:8787", "Originary Trace API endpoint")
	flag.StringVar(&cfg.APIKey, "key", "", "Originary Trace API key ID")
	flag.StringVar(&cfg.Secret, "secret", "", "Originary Trace HMAC secret")
	flag.Parse()

	if cfg.APIKey == "" || cfg.Secret == "" {
		log.Fatal("Error: -key and -secret are required")
	}

	log.Printf("Originary Trace Nginx Tailer starting...")
	log.Printf("Watching: %s", cfg.LogFile)
	log.Printf("Endpoint: %s", cfg.Endpoint)

	// Tail the log file
	t, err := tail.TailFile(cfg.LogFile, tail.Config{
		Follow:    true,
		ReOpen:    true,
		MustExist: false,
		Poll:      true,
	})
	if err != nil {
		log.Fatalf("Failed to tail file: %v", err)
	}

	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	for line := range t.Lines {
		if line.Err != nil {
			log.Printf("Error reading line: %v", line.Err)
			continue
		}

		event, err := parseLine(line.Text)
		if err != nil {
			log.Printf("Failed to parse line: %v", err)
			continue
		}

		if err := sendEvent(client, cfg, event); err != nil {
			log.Printf("Failed to send event: %v", err)
		}
	}
}

func parseLine(line string) (*CrawlEvent, error) {
	matches := lineRe.FindStringSubmatch(strings.TrimSpace(line))
	if matches == nil {
		return nil, fmt.Errorf("line did not match expected format")
	}

	status, _ := strconv.Atoi(matches[4])

	uri := matches[3]
	path := strings.Split(uri, "?")[0]

	return &CrawlEvent{
		Timestamp:     time.Now().UnixMilli(),
		Host:          matches[10],
		Path:          path,
		Method:        matches[2],
		Status:        status,
		UserAgent:     matches[6],
		IPPrefix:      toPrefix(matches[7]),
		AcceptLang:    matches[8],
		CrawlerFamily: matches[11],
		Source:        "nginx",
	}, nil
}

func toPrefix(ip string) string {
	if strings.Contains(ip, ":") {
		// IPv6
		parts := strings.Split(ip, ":")
		if len(parts) >= 3 {
			return strings.Join(parts[:3], ":") + "::/48"
		}
		return ip
	}
	// IPv4
	parts := strings.Split(ip, ".")
	if len(parts) >= 3 {
		return parts[0] + "." + parts[1] + "." + parts[2] + ".0/24"
	}
	return ip
}

func sendEvent(client *http.Client, cfg Config, event *CrawlEvent) error {
	body, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("marshal event: %w", err)
	}

	signature := sign([]byte(cfg.Secret), body)

	req, err := http.NewRequest("POST", cfg.Endpoint+"/v1/events", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Peac-Key", cfg.APIKey)
	req.Header.Set("X-Peac-Timestamp", fmt.Sprintf("%d", event.Timestamp))
	req.Header.Set("X-Peac-Signature", signature)

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("API returned status %d", resp.StatusCode)
	}

	return nil
}

func sign(secret, body []byte) string {
	h := hmac.New(sha256.New, secret)
	h.Write(body)
	return base64.StdEncoding.EncodeToString(h.Sum(nil))
}
