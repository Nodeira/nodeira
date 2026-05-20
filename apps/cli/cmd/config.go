package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

var configCmd = &cobra.Command{
	Use:   "config",
	Short: "Manage CLI configuration",
}

var configSetURLCmd = &cobra.Command{
	Use:   "set-url <url>",
	Short: "Set the server URL",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		saveConfig("url", args[0])
		if pretty {
			fmt.Printf("Server URL set to: %s\n", args[0])
		} else {
			printJSON(map[string]string{"url": args[0]})
		}
		return nil
	},
}

func init() {
	configCmd.AddCommand(configSetURLCmd)
	rootCmd.AddCommand(configCmd)
}
