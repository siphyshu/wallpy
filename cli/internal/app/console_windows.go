//go:build windows

package app

import "golang.org/x/sys/windows"

// hideConsole hides the console window Task Scheduler opens for the agent.
func hideConsole() {
	user32 := windows.NewLazySystemDLL("user32.dll")
	kernel32 := windows.NewLazySystemDLL("kernel32.dll")
	if hwnd, _, _ := kernel32.NewProc("GetConsoleWindow").Call(); hwnd != 0 {
		user32.NewProc("ShowWindow").Call(hwnd, 0) // SW_HIDE
	}
}
