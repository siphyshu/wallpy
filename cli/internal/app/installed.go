package app

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/siphyshu/wallpy/cli/internal/update"
)

// installMethod is how this wallpy was installed, and so how to upgrade
// or remove it.
type installMethod struct {
	upgrade   string // a command, or a page to download from
	remove    string
	removeHow string // "remove it with Homebrew"
}

// howInstalled judges from where the binary lives.
func howInstalled() installMethod {
	download := installMethod{upgrade: "download it from " + update.ReleasesURL}
	exe, err := os.Executable()
	if err != nil {
		download.remove, download.removeHow = "wallpy", "remove the wallpy program"
		return download
	}
	if real, err := filepath.EvalSymlinks(exe); err == nil {
		exe = real
	}
	lower := strings.ToLower(exe)
	switch {
	case strings.Contains(lower, "/cellar/") || strings.Contains(lower, "/caskroom/") || strings.Contains(lower, "linuxbrew"):
		return installMethod{"brew upgrade wallpy", "brew uninstall wallpy", "remove it with Homebrew"}
	case strings.Contains(lower, `\scoop\`):
		return installMethod{"scoop update wallpy", "scoop uninstall wallpy", "remove it with Scoop"}
	case strings.Contains(lower, `\winget\`):
		return installMethod{"winget upgrade siphyshu.Wallpy", "winget uninstall siphyshu.Wallpy", "remove it with winget"}
	}
	if runtime.GOOS == "linux" {
		for _, pm := range []struct {
			query           []string
			upgrade, remove string
		}{
			{[]string{"pacman", "-Qo", exe}, "update wallpy-bin from the AUR (yay -Syu wallpy-bin)", "sudo pacman -R wallpy-bin"},
			{[]string{"dpkg", "-S", exe}, download.upgrade, "sudo apt remove wallpy"},
			{[]string{"rpm", "-qf", exe}, download.upgrade, "sudo dnf remove wallpy"},
			{[]string{"apk", "info", "--who-owns", exe}, download.upgrade, "sudo apk del wallpy"},
		} {
			if _, err := exec.LookPath(pm.query[0]); err == nil && exec.Command(pm.query[0], pm.query[1:]...).Run() == nil {
				return installMethod{pm.upgrade, pm.remove, "remove the package"}
			}
		}
	}
	download.removeHow = "delete the program"
	download.remove = fmt.Sprintf("rm %q", exe)
	if runtime.GOOS == "windows" {
		download.remove = fmt.Sprintf("del %q", exe)
	}
	return download
}
