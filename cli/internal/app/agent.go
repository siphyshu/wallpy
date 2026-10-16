package app

import (
	"errors"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/spf13/cobra"

	"github.com/siphyshu/wallpy/cli/internal/engine"
	"github.com/siphyshu/wallpy/cli/internal/library"
	"github.com/siphyshu/wallpy/cli/internal/service"
	"github.com/siphyshu/wallpy/cli/internal/spec"
	"github.com/siphyshu/wallpy/cli/internal/state"
	"github.com/siphyshu/wallpy/cli/internal/ui"
)

// newRun is the background agent. launchd, the autostart entry or Task
// Scheduler start it; people don't need to.
func newRun() *cobra.Command {
	return &cobra.Command{
		Use:    "run",
		Short:  "Run the background agent (Wallpy starts this for you)",
		Hidden: true,
		Args:   cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			hideConsole()
			lock, err := service.TryLock()
			// An agent that's being replaced (wallpy stop then resume, or an
			// upgrade on Windows) may still be letting go: wait a little.
			for i := 0; errors.Is(err, service.ErrRunning) && i < 10; i++ {
				time.Sleep(time.Second)
				lock, err = service.TryLock()
			}
			if errors.Is(err, service.ErrRunning) {
				return nil // one agent is enough; exiting cleanly stops launchd restarting us
			}
			if err != nil {
				return err
			}
			defer lock.Release()
			return agent(cmd)
		},
	}
}

// agent sets the wallpaper whenever the schedule says so: it sleeps until
// the next change, waking at least once a minute to notice sleep, clock
// changes and other commands' edits.
func agent(cmd *cobra.Command) error {
	logger := agentLog()
	logger.Printf("started (pid %d)", os.Getpid())
	lib, err := library.Open()
	if err != nil {
		return err
	}
	exe, _ := os.Executable()
	built := fileStamp(exe)
	lastErr := ""
	for {
		if stamp := fileStamp(exe); built != "" && stamp != "" && stamp != built {
			logger.Printf("wallpy was updated; restarting into the new version")
			return restartSelf(exe)
		}
		now := time.Now()
		wait := time.Minute
		cur, changed, err := engine.Apply(lib, now, false)
		switch {
		case errors.Is(err, engine.ErrNoActive):
			// Nothing chosen yet: keep watching for `wallpy use`.
		case err != nil:
			if err.Error() != lastErr {
				logger.Printf("error: %v", err)
				lastErr = err.Error()
			}
		default:
			lastErr = ""
			if changed {
				logger.Printf("set %s (%s)", cur.Active.Image, cur.Pack.Slug)
			}
			wait = min(max(cur.Active.Until.Sub(spec.Wall(now))+500*time.Millisecond, time.Second), time.Minute)
		}
		select {
		case <-cmd.Context().Done():
			logger.Printf("stopped")
			return nil
		case <-time.After(wait):
		}
	}
}

// agentLog appends to agent.log, starting over when it passes 1 MB.
func agentLog() *log.Logger {
	path := service.LogPath()
	if info, err := os.Stat(path); err == nil && info.Size() > 1<<20 {
		os.Remove(path)
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return log.New(os.Stderr, "", log.LstdFlags)
	}
	return log.New(f, "", log.LstdFlags)
}

// agentNote makes sure the agent runs, and says so in one line.
func agentNote(p *ui.Printer) {
	st, err := service.Get()
	if err == nil && st.Running && service.Current() {
		p.Raw("  " + p.Faint("Changes happen in the background."))
		return
	}
	if err := service.Install(); err != nil {
		p.Notice("Couldn't start background changes: " + err.Error())
		p.Hints([2]string{"wallpy doctor", "find out what's wrong"})
		return
	}
	p.Raw("  " + p.Faint("Changes happen in the background from now on, including after you log in."))
}

func newPause() *cobra.Command {
	return &cobra.Command{
		Use:   "pause",
		Short: "Stop changing the wallpaper for now",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			if _, err := state.Update(func(s *state.State) { s.Paused = true }); err != nil {
				return err
			}
			p := ui.Stdout()
			p.Blank()
			p.Success("Paused. Your wallpaper stays as it is.")
			p.Hints([2]string{"wallpy resume", "start changing again"})
			p.Blank()
			return nil
		},
	}
}

func newResume() *cobra.Command {
	return &cobra.Command{
		Use:   "resume",
		Short: "Start changing the wallpaper again",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			st, err := state.Update(func(s *state.State) { s.Paused = false })
			if err != nil {
				return err
			}
			lib, err := library.Open()
			if err != nil {
				return err
			}
			p := printerAt(time.Now(), st.Location())
			p.Blank()
			cur, _, err := engine.Apply(lib, time.Now(), true)
			if errors.Is(err, engine.ErrNoActive) {
				p.Success("Resumed.")
				p.Hints([2]string{"wallpy use <pack>", "pick a pack to show"})
				p.Blank()
				return nil
			}
			if err != nil {
				return &problem{msg: "Couldn't set the wallpaper: " + sentence(err.Error()), fix: run("Run ", "wallpy doctor", " to see what's wrong."), err: err}
			}
			p.Success(fmt.Sprintf("Resumed. Showing %s until %s.", cur.Active.Image, cur.Active.Until.Format("15:04")))
			agentNote(p)
			p.Blank()
			return nil
		},
	}
}

func newStop() *cobra.Command {
	return &cobra.Command{
		Use:   "stop",
		Short: "Stop the background agent and remove it from login",
		Long: "Stop the background agent and stop it starting at login. Your packs stay;\n" +
			"wallpy use or wallpy resume starts it again. Run this before uninstalling.",
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			if err := service.Uninstall(); err != nil {
				return err
			}
			p := ui.Stdout()
			p.Blank()
			p.Success("Stopped. Wallpy won't change your wallpaper until you start it again.")
			p.Hints([2]string{"wallpy resume", "start again"})
			p.Blank()
			return nil
		},
	}
}

// fileStamp identifies a version of a file by its size and modification
// time ("" if it can't be read).
func fileStamp(path string) string {
	info, err := os.Stat(path)
	if err != nil {
		return ""
	}
	return fmt.Sprintf("%d-%d", info.Size(), info.ModTime().UnixNano())
}
