package app

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"charm.land/huh/v2"
	"github.com/spf13/cobra"

	"github.com/siphyshu/wallpy/cli/internal/library"
	"github.com/siphyshu/wallpy/cli/internal/service"
	"github.com/siphyshu/wallpy/cli/internal/state"
	"github.com/siphyshu/wallpy/cli/internal/ui"
)

func newUninstall() *cobra.Command {
	var all, keep bool
	cmd := &cobra.Command{
		Use:   "uninstall",
		Short: "Remove Wallpy from this computer",
		Long: "Remove Wallpy's background agent, and optionally your packs and settings,\n" +
			"then shows the command that removes wallpy itself. Your wallpaper stays as it\n" +
			"is. To stop changes for a while instead, use wallpy pause.",
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			if all && keep {
				return &problem{msg: "Choose one: --all deletes your packs and settings, --keep keeps them."}
			}
			st, _ := state.Load()
			p := printerAt(time.Now(), st.Location())
			home, err := library.Home()
			if err != nil {
				return err
			}
			lib, err := library.Open()
			if err != nil {
				return err
			}
			packs, _ := lib.List()
			var size int64
			for _, pk := range packs {
				size += pk.Size()
			}

			// Decide about the data before changing anything.
			deleteData := all
			if !all && !keep && len(packs) > 0 && p.Styled() && ui.Interactive() {
				p.Blank()
				question := fmt.Sprintf("Also delete your %s and settings (%s)?", plural(len(packs), "pack"), ui.Bytes(size))
				if err := p.Ask(huh.NewConfirm().Title(question).
					Description("Keep them and a reinstall picks up where you left off.").
					Affirmative("Delete").Negative("Keep").Value(&deleteData)); err != nil {
					return quitIfAborted(err)
				}
			}

			agent, _ := service.Get()
			if err := service.Uninstall(); err != nil {
				return err
			}
			p.Blank()
			if agent.Installed || agent.Running {
				p.Success("Removed the background agent. Your wallpaper stays as it is.")
			} else {
				p.Success("No background agent to remove. Your wallpaper stays as it is.")
			}

			if deleteData {
				// The wallpaper on screen lives in a pack: keep a copy outside.
				kept := keepWallpaper(st, picturesDir(), "Wallpy wallpaper")
				if err := os.RemoveAll(home); err != nil {
					return err
				}
				p.Success(fmt.Sprintf("Deleted %s and your settings (%s).", plural(len(packs), "pack"), ui.Bytes(size)))
				if kept != "" {
					p.Raw("  " + p.Muted("Your current wallpaper is saved at ") + p.Plain(tilde(kept)))
				}
			} else if len(packs) > 0 {
				p.Raw("  " + p.Muted("Kept your packs and settings in ") + p.Plain(tilde(home)))
				p.Raw("  " + p.Faint("wallpy uninstall --all deletes them too."))
			}

			p.Blank()
			m := howInstalled()
			p.Raw(p.Muted("To finish, " + m.removeHow + ":"))
			p.Raw("  " + p.Code(m.remove))
			p.Blank()
			return nil
		},
	}
	cmd.Flags().BoolVar(&all, "all", false, "also delete your packs and settings, without asking")
	cmd.Flags().BoolVar(&keep, "keep", false, "keep your packs and settings, without asking")
	return cmd
}

// picturesDir is where a saved wallpaper goes: the Pictures folder if
// there is one, else the home folder.
func picturesDir() string {
	home, _ := os.UserHomeDir()
	if info, err := os.Stat(filepath.Join(home, "Pictures")); err == nil && info.IsDir() {
		return filepath.Join(home, "Pictures")
	}
	return home
}
