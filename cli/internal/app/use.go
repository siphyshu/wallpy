package app

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/siphyshu/wallpy/cli/internal/engine"
	"github.com/siphyshu/wallpy/cli/internal/library"
	"github.com/siphyshu/wallpy/cli/internal/remote"
	"github.com/siphyshu/wallpy/cli/internal/spec"
	"github.com/siphyshu/wallpy/cli/internal/state"
	"github.com/siphyshu/wallpy/cli/internal/ui"
)

func newUse(version string) *cobra.Command {
	return &cobra.Command{
		Use:   "use <pack>",
		Short: "Make a pack your wallpaper",
		Long: "Make a pack your wallpaper. Downloads it first if needed, sets the right\n" +
			"image now, and keeps it changing in the background.\n\n" +
			"<pack> is a pack name, a link from the gallery, or a pack folder.",
		ValidArgsFunction: completeInstalledOrFolder,
		Example:           "wallpy use zelda-wind-waker\nwallpy use https://wallpy.siphyshu.me/packs/ocean-hours\nwallpy use ./my-pack",
		Args: func(_ *cobra.Command, args []string) error {
			if len(args) != 1 {
				return &problem{msg: "Which pack?", fix: run("For example: ", "wallpy use zelda-wind-waker", ". Or find one with wallpy browse.")}
			}
			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			return use(cmd.Context(), version, args[0])
		},
	}
}

// use makes a pack (a slug, a gallery link or a folder) the wallpaper.
func use(ctx context.Context, version, ref string) error {
	lib, err := library.Open()
	if err != nil {
		return err
	}
	st, err := state.Load()
	if err != nil {
		return err
	}
	now := time.Now()
	p := printerAt(now, st.Location())
	p.Blank()

	// An installed pack's name wins over a folder of the same name here;
	// "./name" always means the folder.
	var pack *library.Pack
	installed, installedErr := lib.Get(ref)
	if info, err := os.Stat(ref); err == nil && info.IsDir() && (installedErr != nil || strings.ContainsAny(ref, `/\`)) {
		if pack, err = lib.Import(ref); err != nil {
			return &problem{msg: sentence(err.Error()), err: err}
		}
	} else if installedErr == nil {
		pack = installed
	} else {
		c := remote.New(version)
		slug, err := c.Resolve(ref)
		if err != nil {
			return &problem{msg: sentence(err.Error()), fix: say("Use a pack name, a link from the gallery, or a pack folder."), err: err}
		}
		var m *remote.Manifest
		var fresh bool
		if pack, m, fresh, err = fetch(ctx, p, c, lib, slug, false); err != nil {
			return err
		}
		if fresh {
			p.Success(p.Muted("Downloaded ") + p.Plain(m.Title) + p.Faint(fmt.Sprintf("  %d images · %s · verified", len(m.Files), ui.Bytes(m.Size()))))
		}
	}

	if _, err := state.Update(func(s *state.State) { s.Active, s.Paused = pack.Slug, false }); err != nil {
		return err
	}
	cur, _, err := engine.Apply(lib, now, true)
	if err != nil {
		return &problem{msg: "Couldn't set the wallpaper: " + sentence(err.Error()), fix: run("Run ", "wallpy doctor", " to see what's wrong."), err: err}
	}
	p.Success(p.Muted("Now using ") + p.Link(p.Strong(pack.Title()), pack.GalleryURL()))
	p.Raw("  " + p.Muted(fmt.Sprintf("%s until %s, then %s", cur.Active.Image,
		cur.Active.Until.Format("15:04"), next(cur, st.Location()))))
	agentNote(p)
	p.Blank()
	return nil
}

// next names what comes after the current image: the next image in the
// slot, or the next slot.
func next(cur *engine.Now, loc *spec.Location) string {
	a, err := cur.Schedule.Active(spec.Instant(cur.Active.Until, time.Local), loc)
	if err != nil {
		return "the next image"
	}
	if a.Slot != cur.Active.Slot {
		return engine.SlotName(cur.Schedule, a.Slot)
	}
	return a.Image
}
