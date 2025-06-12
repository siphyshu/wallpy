# Get the Python executable path from the first argument
param(
    [Parameter(Mandatory=$true)]
    [string]$PythonPath
)

# Create the action
$Action = New-ScheduledTaskAction -Execute $PythonPath -Argument "-m wallpy.service"

# Create an array for triggers
$triggers = @()

# Add logon trigger
$triggers += New-ScheduledTaskTrigger -AtLogOn
$triggers += New-ScheduledTaskTrigger -AtStartup

# Add five 5-minute interval triggers, spaced 1 minute apart
$startTime = (Get-Date)  # Start 1 minute from now
for ($i = 0; $i -lt 5; $i++) {
    # For each 5-minute interval, create 6 triggers (one every 10 seconds)
    for ($j = 0; $j -lt 6; $j++) {
        $trigger = New-ScheduledTaskTrigger -Once -At $startTime.AddMinutes($i).AddSeconds($j * 10) -RepetitionInterval (New-TimeSpan -Minutes 5)
        $triggers += $trigger
    }
}

# Delete existing task if it exists
Unregister-ScheduledTask -TaskName "WallpyService" -Confirm:$false -ErrorAction SilentlyContinue

# Create the task settings
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

# Create the task definition
$taskDefinition = New-ScheduledTask -Action $Action -Trigger $triggers -Settings $settings

# Register the task with highest privileges
$taskDefinition.Principal.RunLevel = "Highest"

# Register the task
Register-ScheduledTask -TaskName "WallpyService" -InputObject $taskDefinition -User "$env:USERNAME" -Force

Write-Host "✅ Wallpy service task has been created successfully!" 