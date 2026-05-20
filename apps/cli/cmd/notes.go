package cmd

import (
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/spf13/cobra"
)

var notesCmd = &cobra.Command{
	Use:   "notes",
	Short: "Manage notes",
}

var (
	notesVaultFlag   string
	notesFolderFlag  string
	notesContentFlag string
	notesFileFlag    string
	notesTitleFlag   string
)

var notesListCmd = &cobra.Command{
	Use:   "list",
	Short: "List notes",
	RunE: func(cmd *cobra.Command, args []string) error {
		path := "notes"
		params := []string{}
		if notesVaultFlag != "" {
			params = append(params, "vaultId="+notesVaultFlag)
		}
		if notesFolderFlag != "" {
			params = append(params, "folderId="+notesFolderFlag)
		}
		if len(params) > 0 {
			path += "?" + strings.Join(params, "&")
		}

		var result []map[string]any
		unmarshal(get(path), &result)

		if pretty {
			if len(result) == 0 {
				fmt.Println("No notes.")
				return nil
			}
			fmt.Printf("%-36s  %-30s  %s\n", "ID", "Title", "Updated")
			fmt.Printf("%-36s  %-30s  %s\n", "----", "-----", "-------")
			for _, n := range result {
				id, _ := n["id"].(string)
				title, _ := n["title"].(string)
				updated, _ := n["updatedAt"].(string)
				fmt.Printf("%-36s  %-30s  %s\n", id, title, updated)
			}
		} else {
			printJSON(result)
		}
		return nil
	},
}

var notesGetFlag bool

var notesGetCmd = &cobra.Command{
	Use:   "get <id>",
	Short: "Get a note",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		id := args[0]
		var note map[string]any
		unmarshal(get("notes/"+id), &note)

		if notesGetFlag {
			var content map[string]any
			unmarshal(get("notes/"+id+"/content"), &content)
			note["content"] = content["content"]
		}

		if pretty {
			title, _ := note["title"].(string)
			updated, _ := note["updatedAt"].(string)
			fmt.Printf("ID:      %s\nTitle:   %s\nUpdated: %s\n", id, title, updated)
			if notesGetFlag {
				fmt.Printf("---\n%s\n", note["content"])
			}
		} else {
			printJSON(note)
		}
		return nil
	},
}

var notesCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create a note",
	RunE: func(cmd *cobra.Command, args []string) error {
		guardWrite("notes create")
		body := map[string]any{"title": notesTitleFlag}
		if notesVaultFlag != "" {
			body["vaultId"] = notesVaultFlag
		}
		if notesFolderFlag != "" {
			body["folderId"] = notesFolderFlag
		}

		var created map[string]any
		unmarshal(post("notes", body), &created)

		id, _ := created["id"].(string)

		content, err := resolveContent(notesContentFlag, notesFileFlag)
		if err != nil {
			return err
		}
		if content != "" {
			put("notes/"+id+"/content", map[string]string{"content": content})
		}

		if pretty {
			fmt.Printf("Created note %s\n", id)
		} else {
			printJSON(created)
		}
		return nil
	},
}

var notesUpdateCmd = &cobra.Command{
	Use:   "update <id>",
	Short: "Update a note",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		guardWrite("notes update")
		id := args[0]

		if notesTitleFlag != "" {
			patch("notes/"+id, map[string]string{"title": notesTitleFlag})
		}

		content, err := resolveContent(notesContentFlag, notesFileFlag)
		if err != nil {
			return err
		}
		if content != "" {
			put("notes/"+id+"/content", map[string]string{"content": content})
		}

		if pretty {
			fmt.Printf("Updated note %s\n", id)
		} else {
			printJSON(map[string]string{"status": "updated", "id": id})
		}
		return nil
	},
}

var notesDeleteCmd = &cobra.Command{
	Use:   "delete <id>",
	Short: "Delete a note",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		guardWrite("notes delete")
		del("notes/" + args[0])
		if pretty {
			fmt.Printf("Deleted note %s\n", args[0])
		} else {
			printJSON(map[string]string{"status": "deleted", "id": args[0]})
		}
		return nil
	},
}

// resolveContent reads content from --content, --content-file, or stdin ("-").
func resolveContent(content, file string) (string, error) {
	if content != "" {
		return content, nil
	}
	if file == "-" {
		data, err := io.ReadAll(os.Stdin)
		if err != nil {
			return "", fmt.Errorf("reading stdin: %w", err)
		}
		return string(data), nil
	}
	if file != "" {
		data, err := os.ReadFile(file)
		if err != nil {
			return "", fmt.Errorf("reading file %s: %w", file, err)
		}
		return string(data), nil
	}
	return "", nil
}

func init() {
	notesListCmd.Flags().StringVar(&notesVaultFlag, "vault", "", "Filter by vault ID")
	notesListCmd.Flags().StringVar(&notesFolderFlag, "folder", "", "Filter by folder ID")

	notesGetCmd.Flags().BoolVar(&notesGetFlag, "content", false, "Include note body (Markdown)")

	notesCreateCmd.Flags().StringVar(&notesTitleFlag, "title", "", "Note title (required)")
	notesCreateCmd.Flags().StringVar(&notesVaultFlag, "vault", "", "Vault ID")
	notesCreateCmd.Flags().StringVar(&notesFolderFlag, "folder", "", "Folder ID")
	notesCreateCmd.Flags().StringVar(&notesContentFlag, "content", "", "Note body (Markdown text)")
	notesCreateCmd.Flags().StringVar(&notesFileFlag, "content-file", "", "Path to Markdown file, or - for stdin")
	_ = notesCreateCmd.MarkFlagRequired("title")

	notesUpdateCmd.Flags().StringVar(&notesTitleFlag, "title", "", "New title")
	notesUpdateCmd.Flags().StringVar(&notesContentFlag, "content", "", "New body (Markdown text)")
	notesUpdateCmd.Flags().StringVar(&notesFileFlag, "content-file", "", "Path to Markdown file, or - for stdin")

	notesCmd.AddCommand(notesListCmd, notesGetCmd, notesCreateCmd, notesUpdateCmd, notesDeleteCmd)
	rootCmd.AddCommand(notesCmd)
}
