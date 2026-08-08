package cmd

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"syscall"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"golang.org/x/term"
)

var loginTokenFlag string

var loginCmd = &cobra.Command{
	Use:   "login",
	Short: "Authenticate with a Nodeira server",
	RunE: func(cmd *cobra.Command, args []string) error {
		if loginTokenFlag != "" {
			saveConfig("token", loginTokenFlag)
			fmt.Println("Token saved.")
			return nil
		}
		return interactiveLogin()
	},
}

func init() {
	loginCmd.Flags().StringVar(&loginTokenFlag, "token", "", "Store a token directly (non-interactive)")
	rootCmd.AddCommand(loginCmd)
}

func interactiveLogin() error {
	reader := bufio.NewReader(os.Stdin)

	serverURL := viper.GetString("url")
	if serverURL == "" {
		fmt.Print("Server URL: ")
		url, _ := reader.ReadString('\n')
		serverURL = strings.TrimSpace(url)
		if serverURL == "" {
			exitErr("server URL is required")
		}
		saveConfig("url", serverURL)
	}

	fmt.Print("Email: ")
	email, _ := reader.ReadString('\n')
	email = strings.TrimSpace(email)

	fmt.Print("Password: ")
	passwordBytes, err := term.ReadPassword(int(syscall.Stdin))
	fmt.Println()
	if err != nil {
		exitErr("failed to read password: " + err.Error())
	}
	password := string(passwordBytes)

	body, _ := json.Marshal(map[string]any{
		"email":      email,
		"password":   password,
		"rememberMe": true,
	})

	resp, err := http.Post(
		// Not apiURL(): login runs before a server URL is stored in config.
		strings.TrimRight(serverURL, "/")+apiBasePath+"auth/login",
		"application/json",
		strings.NewReader(string(body)),
	)
	if err != nil {
		exitErr("login request failed: " + err.Error())
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 && resp.StatusCode != 201 {
		exitErr(fmt.Sprintf("login failed (HTTP %d)", resp.StatusCode))
	}

	var result map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		exitErr("invalid login response")
	}

	token, ok := result["access_token"].(string)
	if !ok || token == "" {
		exitErr("no access_token in response")
	}

	saveConfig("token", token)
	fmt.Println("Logged in successfully.")
	return nil
}
