package app

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
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
			cmdline, how := removeCommand()
			p.Raw(p.Muted("To finish, " + how + ":"))
			p.Raw("  " + p.Code(cmdline))
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

// removeCommand is how to remove this wallpy, judged from where it's
// installed: a package manager's command, or deleting the file.
func removeCommand() (cmdline, how string) {
	exe, err := os.Executable()
	if err != nil {
		return "", "remove the wallpy program"
	}
	if real, err := filepath.EvalSymlinks(exe); err == nil {
		exe = real
	}
	lower := strings.ToLower(exe)
	switch {
	case strings.Contains(lower, "/cellar/") || strings.Contains(lower, "/caskroom/") || strings.Contains(lower, "linuxbrew"):
		return "brew uninstall wallpy", "remove it with Homebrew"
	case strings.Contains(lower, `\scoop\`):
		return "scoop uninstall wallpy", "remove it with Scoop"
	case strings.Contains(lower, `\winget\`):
		return "winget uninstall siphyshu.Wallpy", "remove it with winget"
	}
	if runtime.GOOS == "linux" {
		for _, pm := range []struct {
			query  []string
			remove string
		}{
			{[]string{"pacman", "-Qo", exe}, "sudo pacman -R wallpy-bin"},
			{[]string{"dpkg", "-S", exe}, "sudo apt remove wallpy"},
			{[]string{"rpm", "-qf", exe}, "sudo dnf remove wallpy"},
			{[]string{"apk", "info", "--who-owns", exe}, "sudo apk del wallpy"},
		} {
			if _, err := exec.LookPath(pm.query[0]); err == nil && exec.Command(pm.query[0], pm.query[1:]...).Run() == nil {
				return pm.remove, "remove the package"
			}
		}
	}
	if runtime.GOOS == "windows" {
		return fmt.Sprintf("del %q", exe), "delete the program"
	}
	return fmt.Sprintf("rm %q", exe), "delete the program"
}
