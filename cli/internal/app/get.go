package app

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"

	"github.com/siphyshu/wallpy/cli/internal/library"
	"github.com/siphyshu/wallpy/cli/internal/remote"
	"github.com/siphyshu/wallpy/cli/internal/ui"
)

func newGet(version string) *cobra.Command {
	var force bool
	cmd := &cobra.Command{
		Use:     "get <pack>",
		Aliases: []string{"download"},
		Short:   "Download a pack without switching to it",
		Long: "Download a pack from the gallery. Every image is checked against the\n" +
			"size and SHA-256 the site publishes, and nothing is installed unless\n" +
			"all of them match.",
		Example: "wallpy get zelda-wind-waker\nwallpy get https://wallpy.siphyshu.me/packs/zelda-wind-waker",
		Args: func(_ *cobra.Command, args []string) error {
			if len(args) != 1 {
				return &problem{msg: "Which pack?", fix: run("For example: ", "wallpy get zelda-wind-waker", "")}
			}
			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			return get(cmd, ui.Stdout(), remote.New(version), args[0], force)
		},
	}
	cmd.Flags().BoolVarP(&force, "force", "f", false, "reinstall, re-checking every file (damaged ones are downloaded again)")
	return cmd
}

func get(cmd *cobra.Command, p *ui.Printer, c *remote.Client, ref string, force bool) error {
	ctx := cmd.Context()
	slug, err := c.Resolve(ref)
	if err != nil {
		return &problem{msg: sentence(err.Error()), err: err}
	}
	lib, err := library.Open()
	if err != nil {
		return err
	}
	m, err := c.Manifest(ctx, slug)
	if err != nil {
		return explainNetwork(c, slug, err)
	}

	if old, err := lib.Get(m.Slug); err == nil && old.Info != nil && old.Info.Manifest.Version == m.Version && !force {
		p.Blank()
		p.Success(p.Strong(m.Title) + "  " + p.Faint(fmt.Sprintf("v%d", m.Version)) + p.Muted(" is already installed."))
		p.Blank()
		p.Hints([2]string{"wallpy get " + m.Slug + " --force", "reinstall and re-check every file"})
		p.Blank()
		return nil
	}

	p.Blank()
	t := p.Transfer(m.Title)
	pack, err := lib.Install(ctx, c, m, t.Update)
	t.Done()
	if err != nil {
		return explainNetwork(c, slug, err)
	}
	c.CountDownload(ctx, m.Slug)

	p.Success(p.Strong(m.Title) + "  " + p.Faint(fmt.Sprintf("v%d", m.Version)))
	p.Raw("  " + p.Muted(fmt.Sprintf("%d images · %s · verified", len(m.Files), ui.Bytes(m.Size()))))
	p.Raw("  " + p.Muted(credit(m)))
	p.Raw("  " + p.Faint(tilde(pack.Dir)))
	p.Blank()
	return nil
}

// credit is the attribution line, as the site shows it: "by <name>", the
// licence, and any AI disclosure.
func credit(m *remote.Manifest) string {
	parts := []string{"by " + m.Credit.Name}
	if l := licenses[m.License]; l != "" {
		parts = append(parts, l)
	}
	if m.AIUse != nil {
		if a := aiUse[*m.AIUse]; a != "" {
			parts = append(parts, a)
		}
	}
	return strings.Join(parts, " · ")
}

// Labels from site/components (PackMetadata.jsx, AiUseLabel.tsx).
var (
	licenses = map[string]string{
		"personal-use": "Personal use only", "cc-by-4.0": "CC BY 4.0", "cc-by-nc-4.0": "CC BY-NC 4.0",
		"cc0": "CC0", "other": "Custom licence",
	}
	aiUse = map[string]string{"assisted": "AI-assisted", "generated": "AI-generated"}
)

// tilde shortens a path in the home folder to ~/….
func tilde(path string) string {
	home, err := os.UserHomeDir()
	if err != nil {
		return path
	}
	if rel, err := filepath.Rel(home, path); err == nil && !strings.HasPrefix(rel, "..") {
		return filepath.Join("~", rel)
	}
	return path
}
