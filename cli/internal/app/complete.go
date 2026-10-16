package app

import (
	"strings"

	"github.com/spf13/cobra"

	"github.com/siphyshu/wallpy/cli/internal/library"
)

// completeInstalled tab-completes installed pack names.
func completeInstalled(_ *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
	lib, err := library.Open()
	if err != nil {
		return nil, cobra.ShellCompDirectiveNoFileComp
	}
	packs, _ := lib.List()
	var out []string
	for _, p := range packs {
		if strings.HasPrefix(p.Slug, toComplete) {
			out = append(out, p.Slug+"\t"+p.Title())
		}
	}
	return out, cobra.ShellCompDirectiveNoFileComp
}

// completeInstalledOrFolder also offers folders (wallpy use ./my-pack).
func completeInstalledOrFolder(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
	if strings.ContainsAny(toComplete, "./~") {
		return nil, cobra.ShellCompDirectiveFilterDirs
	}
	out, _ := completeInstalled(cmd, args, toComplete)
	return out, cobra.ShellCompDirectiveNoFileComp
}
