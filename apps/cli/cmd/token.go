package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

var tokenCmd = &cobra.Command{
	Use:   "token",
	Short: "Manage API tokens",
}

var (
	tokenName    string
	tokenVault   string
	tokenExpires string
)

var tokenCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create a new API token",
	RunE: func(cmd *cobra.Command, args []string) error {
		guardWrite("token create")
		body := map[string]any{"name": tokenName}
		if tokenVault != "" {
			body["vaultId"] = tokenVault
		}
		if tokenExpires != "" {
			body["expiresAt"] = tokenExpires
		}

		var result map[string]any
		unmarshal(post("auth/tokens", body), &result)

		if pretty {
			token, _ := result["token"].(string)
			id, _ := result["id"].(string)
			name, _ := result["name"].(string)
			fmt.Printf("Token created:\n  ID:    %s\n  Name:  %s\n  Token: %s\n\nSave this token — it will not be shown again.\n", id, name, token)
		} else {
			printJSON(result)
		}
		return nil
	},
}

var tokenListCmd = &cobra.Command{
	Use:   "list",
	Short: "List API tokens",
	RunE: func(cmd *cobra.Command, args []string) error {
		var result []map[string]any
		unmarshal(get("auth/tokens"), &result)

		if pretty {
			if len(result) == 0 {
				fmt.Println("No tokens.")
				return nil
			}
			fmt.Printf("%-36s  %-20s  %-24s  %s\n", "ID", "Name", "Created", "Vault")
			fmt.Printf("%-36s  %-20s  %-24s  %s\n", "----", "----", "-------", "-----")
			for _, t := range result {
				id, _ := t["id"].(string)
				name, _ := t["name"].(string)
				created, _ := t["createdAt"].(string)
				vaultId, _ := t["vaultId"].(string)
				if vaultId == "" {
					vaultId = "(all)"
				}
				fmt.Printf("%-36s  %-20s  %-24s  %s\n", id, name, created, vaultId)
			}
		} else {
			printJSON(result)
		}
		return nil
	},
}

var tokenRevokeCmd = &cobra.Command{
	Use:   "revoke <id>",
	Short: "Revoke an API token",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		guardWrite("token revoke")
		del("auth/tokens/" + args[0])
		if pretty {
			fmt.Println("Token revoked.")
		} else {
			printJSON(map[string]string{"status": "revoked", "id": args[0]})
		}
		return nil
	},
}

func init() {
	tokenCreateCmd.Flags().StringVar(&tokenName, "name", "", "Token name (required)")
	tokenCreateCmd.Flags().StringVar(&tokenVault, "vault", "", "Restrict token to a specific vault ID")
	tokenCreateCmd.Flags().StringVar(&tokenExpires, "expires", "", "Expiry date/time (RFC3339)")
	_ = tokenCreateCmd.MarkFlagRequired("name")

	tokenCmd.AddCommand(tokenCreateCmd, tokenListCmd, tokenRevokeCmd)
	rootCmd.AddCommand(tokenCmd)
}
