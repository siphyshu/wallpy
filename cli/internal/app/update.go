package app

import (
	"errors"
	"fmt"
	"time"

	"github.com/spf13/cobra"

	"github.com/siphyshu/wallpy/cli/internal/engine"
	"github.com/siphyshu/wallpy/cli/internal/library"
	"github.com/siphyshu/wallpy/cli/internal/remote"
	"github.com/siphyshu/wallpy/cli/internal/state"
)

func newUpdate(version string) *cobra.Command {
	return &cobra.Command{
		Use:               "update [pack...]",
		ValidArgsFunction: completeInstalled,
		Short:             "Get new versions of installed packs",
		Long: "Check the gallery for new versions of your packs and install them. Images\n" +
			"that didn't change are reused, not downloaded again.",
		RunE: func(cmd *cobra.Command, args []string) error {
			lib, err := library.Open()
			if err != nil {
				return err
			}
			st, _ := state.Load()
			var packs []*library.Pack
			if len(args) == 0 {
				if packs, err = lib.List(); err != nil {
					return err
				}
			}
			for _, a := range args {
				pk, err := lib.Get(a)
				if err != nil {
					return &problem{msg: fmt.Sprintf("No pack called %q is installed.", a), fix: run("See what's installed with ", "wallpy list", ".")}
				}
				packs = append(packs, pk)
			}
			p := printerAt(time.Now(), st.Location())
			p.Blank()
			updated, current, local, failed := 0, 0, 0, 0
			for _, pk := range packs {
				if pk.Info == nil {
					local++
					continue
				}
				c := remote.New(version)
				c.Site = pk.Info.Source
				m, err := c.Manifest(cmd.Context(), pk.Slug)
				switch {
				case errors.Is(err, remote.ErrNotFound):
					p.Notice(pk.Title() + p.Muted(" is no longer in the gallery. Your copy stays."))
					continue
				case err != nil:
					failed++
					msg := explainNetwork(c, pk.Slug, err)
					p.Fail(pk.Title()+": "+msg.Error(), "")
					continue
				case m.Version <= pk.Info.Manifest.Version:
					current++
					continue
				}
				t := p.Transfer(m.Title)
				_, err = lib.Install(cmd.Context(), c, m, t.Update)
				t.Done()
				if err != nil {
					failed++
					p.Fail(pk.Title()+": "+explainNetwork(c, pk.Slug, err).Error(), "")
					continue
				}
				updated++
				p.Success(fmt.Sprintf("%s %s", p.Strong(m.Title), p.Muted(fmt.Sprintf("v%d → v%d", pk.Info.Manifest.Version, m.Version))))
				if pk.Slug == st.Active {
					engine.Apply(lib, time.Now(), true)
				}
			}
			switch {
			case len(packs) == 0:
				p.Raw(p.Muted("No packs installed yet."))
			case updated == 0 && failed == 0:
				p.Success(fmt.Sprintf("Everything is up to date (%s).", plural(current, "pack")))
			}
			if local > 0 {
				p.Raw("  " + p.Faint(plural(local, "local pack")+" not from the gallery, left as is."))
			}
			p.Blank()
			if failed > 0 {
				return errQuiet
			}
			return nil
		},
	}
}
