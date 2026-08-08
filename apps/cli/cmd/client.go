package cmd

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

var httpClient = &http.Client{}

// apiBasePath is the server's global prefix plus its URI version segment. main.ts sets
// setGlobalPrefix("api") with enableVersioning({type: URI, defaultVersion: "1"}), so every
// route lives under /api/v1. Without the version segment every request 404s.
const apiBasePath = "/api/v1/"

func apiURL(path string) string {
	base := strings.TrimRight(getServerURL(), "/")
	return base + apiBasePath + strings.TrimLeft(path, "/")
}

func doRequest(method, path string, body any) ([]byte, int) {
	var bodyReader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			exitErr("failed to marshal request: " + err.Error())
		}
		bodyReader = bytes.NewReader(data)
	}

	req, err := http.NewRequest(method, apiURL(path), bodyReader)
	if err != nil {
		exitErr("failed to create request: " + err.Error())
	}

	req.Header.Set("Authorization", "Bearer "+getToken())
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		exitErr(fmt.Sprintf("request failed: %v", err))
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		exitErr("failed to read response: " + err.Error())
	}

	if resp.StatusCode >= 400 {
		var errResp map[string]any
		if json.Unmarshal(respBody, &errResp) == nil {
			if msg, ok := errResp["message"]; ok {
				exitErr(fmt.Sprintf("server error %d: %v", resp.StatusCode, msg))
			}
		}
		exitErr(fmt.Sprintf("server error %d: %s", resp.StatusCode, string(respBody)))
	}

	return respBody, resp.StatusCode
}

func get(path string) []byte {
	data, _ := doRequest("GET", path, nil)
	return data
}

func post(path string, body any) []byte {
	data, _ := doRequest("POST", path, body)
	return data
}

func patch(path string, body any) []byte {
	data, _ := doRequest("PATCH", path, body)
	return data
}

func put(path string, body any) []byte {
	data, _ := doRequest("PUT", path, body)
	return data
}

func del(path string) {
	doRequest("DELETE", path, nil)
}

func unmarshal(data []byte, v any) {
	if err := json.Unmarshal(data, v); err != nil {
		exitErr("failed to parse response: " + err.Error())
	}
}
