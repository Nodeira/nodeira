package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var (
	pretty bool
	cfgFile string
)

var rootCmd = &cobra.Command{
	Use:   "nodeira",
	Short: "Nodeira CLI — manage notes, vaults, and API tokens",
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

func init() {
	cobra.OnInitialize(initConfig)
	rootCmd.PersistentFlags().BoolVar(&pretty, "pretty", false, "Human-readable output instead of JSON")
}

func initConfig() {
	cfgDir, err := os.UserConfigDir()
	if err != nil {
		cfgDir = os.Getenv("HOME") + "/.config"
	}
	cfgFile = filepath.Join(cfgDir, "nodeira", "config.json")

	viper.SetConfigFile(cfgFile)
	viper.SetConfigType("json")

	// Env overrides
	viper.BindEnv("url", "NODEIRA_URL")
	viper.BindEnv("token", "NODEIRA_TOKEN")

	_ = viper.ReadInConfig()
}

// getServerURL returns the configured server URL, exiting if not set.
func getServerURL() string {
	url := viper.GetString("url")
	if url == "" {
		exitErr("server URL not configured; run: nodeira config set-url <url>")
	}
	return url
}

// getToken returns the configured auth token, exiting if not set.
func getToken() string {
	token := viper.GetString("token")
	if token == "" {
		exitErr("not authenticated; run: nodeira login")
	}
	return token
}

// isReadOnly returns true when NODEIRA_MODE=ro.
func isReadOnly() bool {
	return os.Getenv("NODEIRA_MODE") == "ro"
}

// guardWrite exits with code 2 if in read-only mode.
func guardWrite(operation string) {
	if isReadOnly() {
		fmt.Fprintf(os.Stderr, "error: %s is not allowed in read-only mode (NODEIRA_MODE=ro)\n", operation)
		os.Exit(2)
	}
}

// printJSON writes v as compact JSON to stdout.
func printJSON(v any) {
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	if err := enc.Encode(v); err != nil {
		exitErr(err.Error())
	}
}

// exitErr prints msg to stderr as JSON (or plain text with --pretty) and exits 1.
func exitErr(msg string) {
	if pretty {
		fmt.Fprintln(os.Stderr, "error:", msg)
	} else {
		_ = json.NewEncoder(os.Stderr).Encode(map[string]string{"error": msg})
	}
	os.Exit(1)
}

// saveConfig writes url and/or token to the config file.
func saveConfig(key, value string) {
	cfgDir := filepath.Dir(cfgFile)
	if err := os.MkdirAll(cfgDir, 0700); err != nil {
		exitErr("cannot create config dir: " + err.Error())
	}
	viper.Set(key, value)
	if err := viper.WriteConfigAs(cfgFile); err != nil {
		exitErr("cannot write config: " + err.Error())
	}
}
