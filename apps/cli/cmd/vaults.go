package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

var vaultsCmd = &cobra.Command{
	Use:   "vaults",
	Short: "Manage vaults",
}

var vaultsListCmd = &cobra.Command{
	Use:   "list",
	Short: "List vaults",
	RunE: func(cmd *cobra.Command, args []string) error {
		var result []map[string]any
		unmarshal(get("vaults"), &result)

		if pretty {
			if len(result) == 0 {
				fmt.Println("No vaults.")
				return nil
			}
			fmt.Printf("%-36s  %s\n", "ID", "Name")
			fmt.Printf("%-36s  %s\n", "----", "----")
			for _, v := range result {
				id, _ := v["id"].(string)
				name, _ := v["name"].(string)
				fmt.Printf("%-36s  %s\n", id, name)
			}
		} else {
			printJSON(result)
		}
		return nil
	},
}

func init() {
	vaultsCmd.AddCommand(vaultsListCmd)
	rootCmd.AddCommand(vaultsCmd)
}
