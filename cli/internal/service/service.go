// Package service keeps `wallpy run` going in the background: a launchd
// agent on macOS, an XDG autostart entry on Linux, a logon task on Windows.
// Whichever starts it, the agent holds agent.lock while it runs, so
// "is it running?" has one answer everywhere.
package service

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/siphyshu/wallpy/cli/internal/library"
)

// Label names the agent in launchd and Task Scheduler.
const Label = "me.siphyshu.wallpy"

// Status is what `wallpy doctor` and the home screen report.
type Status struct {
	Installed bool   // starts at login
	Running   bool   // an agent holds the lock now
	PID       int    // when running
	Where     string // where the definition lives
}

// Get reports the agent's status.
func Get() (Status, error) {
	st, err := installed()
	if err != nil {
		return st, err
	}
	pid, running := holder()
	st.Running, st.PID = running, pid
	return st, nil
}

// Current reports whether the installed agent runs this wallpy. After an
// upgrade or a move it may point at a binary that's gone or older.
func Current() bool {
	st, err := installed()
	if err != nil || !st.Installed {
		return false
	}
	exe, err := Executable()
	if err != nil {
		return false
	}
	def, err := os.ReadFile(st.Where)
	if err != nil {
		return true // Windows keeps it in Task Scheduler; assume current
	}
	return strings.Contains(string(def), exe)
}

// Install makes the agent start at login, and starts it now.
func Install() error {
	exe, err := Executable()
	if err != nil {
		return err
	}
	return install(exe)
}

// Uninstall stops the agent and stops it starting at login.
func Uninstall() error {
	if err := uninstall(); err != nil {
		return err
	}
	if pid, running := holder(); running {
		if p, err := os.FindProcess(pid); err == nil {
			p.Kill()
		}
	}
	return nil
}

// Executable is the path the agent should run: the command on PATH when
// it's this same binary (stays valid when Homebrew upgrades into a new
// Cellar folder), else this binary itself.
func Executable() (string, error) {
	self, err := os.Executable()
	if err != nil {
		return "", err
	}
	if onPath, err := exec.LookPath("wallpy"); err == nil {
		a, errA := os.Stat(onPath)
		b, errB := os.Stat(self)
		if errA == nil && errB == nil && os.SameFile(a, b) {
			abs, _ := filepath.Abs(onPath)
			return abs, nil
		}
	}
	if strings.Contains(self, string(filepath.Separator)+"go-build") {
		return "", errors.New("this is a `go run` build, which disappears when it exits; build wallpy and run that instead")
	}
	return self, nil
}

// LogPath is where the agent writes what it does.
func LogPath() string {
	home, _ := library.Home()
	return filepath.Join(home, "agent.log")
}

func lockPath() string {
	home, _ := library.Home()
	return filepath.Join(home, "agent.lock")
}

// holder is the PID of the running agent, if one holds the lock.
func holder() (int, bool) {
	l, err := TryLock()
	if err == nil {
		l.Release()
		return 0, false
	}
	data, _ := os.ReadFile(lockPath())
	pid, _ := strconv.Atoi(strings.TrimSpace(string(data)))
	return pid, true
}

// ErrRunning means another agent already holds the lock.
var ErrRunning = errors.New("another wallpy agent is running")

// envFor passes development overrides on to the agent.
func envFor() map[string]string {
	env := map[string]string{}
	for _, k := range []string{"WALLPY_HOME", "WALLPY_SITE"} {
		if v := os.Getenv(k); v != "" {
			env[k] = v
		}
	}
	return env
}

func run(name string, args ...string) error {
	out, err := exec.Command(name, args...).CombinedOutput()
	if err != nil {
		return fmt.Errorf("%s %s: %v: %s", name, strings.Join(args, " "), err, strings.TrimSpace(string(out)))
	}
	return nil
}
