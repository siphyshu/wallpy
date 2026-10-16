package ui

import (
	"charm.land/huh/v2"
	"charm.land/lipgloss/v2"
)

// Ask runs a question (a Huh field) dressed in the design system: the sky
// accent for the question and the choice, monochrome for the rest.
func (p *Printer) Ask(field huh.Field) error {
	return huh.NewForm(huh.NewGroup(field)).WithTheme(p.huhTheme()).WithShowHelp(false).Run()
}

func (p *Printer) huhTheme() huh.Theme {
	l := p.look
	return huh.ThemeFunc(func(bool) *huh.Styles {
		t := huh.ThemeBase(true)
		sky, text, muted, faint := l.Sky(), l.Text, l.Muted, l.Faint
		f := &t.Focused
		f.Base = f.Base.BorderForeground(faint).PaddingLeft(1)
		f.Card = f.Base
		f.Title = lipgloss.NewStyle().Foreground(text).Bold(true)
		f.Description = lipgloss.NewStyle().Foreground(muted)
		f.ErrorIndicator = lipgloss.NewStyle().Foreground(l.Error).SetString(" *")
		f.ErrorMessage = lipgloss.NewStyle().Foreground(l.Error)
		f.SelectSelector = lipgloss.NewStyle().Foreground(sky).SetString(SymHint + " ")
		f.Option = lipgloss.NewStyle().Foreground(muted)
		f.SelectedOption = lipgloss.NewStyle().Foreground(text)
		f.NextIndicator = lipgloss.NewStyle().Foreground(faint)
		f.PrevIndicator = lipgloss.NewStyle().Foreground(faint)
		f.FocusedButton = lipgloss.NewStyle().Foreground(l.Surface).Background(sky).Padding(0, 2).MarginRight(1)
		f.BlurredButton = lipgloss.NewStyle().Foreground(muted).Background(l.Surface).Padding(0, 2).MarginRight(1)
		f.Next = f.FocusedButton
		f.TextInput.Cursor = lipgloss.NewStyle().Foreground(sky)
		f.TextInput.Placeholder = lipgloss.NewStyle().Foreground(faint)
		f.TextInput.Prompt = lipgloss.NewStyle().Foreground(sky)
		f.TextInput.Text = lipgloss.NewStyle().Foreground(text)
		t.Blurred = *f
		t.Blurred.Base = f.Base.BorderStyle(lipgloss.HiddenBorder())
		t.Group.Title = f.Title
		t.Group.Description = f.Description
		return t
	})
}
