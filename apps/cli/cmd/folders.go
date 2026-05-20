package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

var foldersCmd = &cobra.Command{
	Use:   "folders",
	Short: "Manage folders",
}

var foldersVaultFlag string

var foldersListCmd = &cobra.Command{
	Use:   "list",
	Short: "List folders",
	RunE: func(cmd *cobra.Command, args []string) error {
		path := "folders"
		if foldersVaultFlag != "" {
			path += "?vaultId=" + foldersVaultFlag
		}

		var result []map[string]any
		unmarshal(get(path), &result)

		if pretty {
			if len(result) == 0 {
				fmt.Println("No folders.")
				return nil
			}
			fmt.Printf("%-36s  %-30s  %s\n", "ID", "Name", "Vault")
			fmt.Printf("%-36s  %-30s  %s\n", "----", "----", "-----")
			for _, f := range result {
				id, _ := f["id"].(string)
				name, _ := f["name"].(string)
				vaultId, _ := f["vaultId"].(string)
				fmt.Printf("%-36s  %-30s  %s\n", id, name, vaultId)
			}
		} else {
			printJSON(result)
		}
		return nil
	},
}

func init() {
	foldersListCmd.Flags().StringVar(&foldersVaultFlag, "vault", "", "Filter by vault ID")
	foldersCmd.AddCommand(foldersListCmd)
	rootCmd.AddCommand(foldersCmd)
}
