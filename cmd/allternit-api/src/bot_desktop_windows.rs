//! Windows-specific guest commands for bot desktops.
//!
//! These are used by the desktop endpoints when the sandbox record has
//! `os == "windows"`. They rely on PowerShell and the Incus guest agent
//! (QEMU GA) being present in the Windows image.

use allternit_driver_interface::{CommandSpec, ExecResult};
use std::collections::HashMap;

/// Screenshot: capture the primary screen and write it to a temp path as PNG.
pub fn screenshot_command() -> CommandSpec {
    let ps = r#"
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bitmap = New-Object System.Drawing.Bitmap $screen.Width, $screen.Height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
$path = "C:\Windows\Temp\allternit-screen.png"
$bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()
[Convert]::ToBase64String([IO.File]::ReadAllBytes($path))
"#;
    CommandSpec {
        command: vec![
            "powershell.exe".to_string(),
            "-NoProfile".to_string(),
            "-ExecutionPolicy".to_string(),
            "Bypass".to_string(),
            "-Command".to_string(),
            ps.to_string(),
        ],
        env_vars: HashMap::new(),
        working_dir: None,
        stdin_data: None,
        capture_stdout: true,
        capture_stderr: true,
    }
}

/// Read the screenshot PNG bytes produced by `screenshot_command` as base64.
pub fn screenshot_read_command() -> CommandSpec {
    CommandSpec {
        command: vec![
            "powershell.exe".to_string(),
            "-NoProfile".to_string(),
            "-Command".to_string(),
            "[Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\\Windows\\Temp\\allternit-screen.png'))".to_string(),
        ],
        env_vars: HashMap::new(),
        working_dir: None,
        stdin_data: None,
        capture_stdout: true,
        capture_stderr: true,
    }
}

/// Run a shell command inside the Windows guest.
pub fn shell_command(cmd: &str) -> CommandSpec {
    CommandSpec {
        command: vec![
            "powershell.exe".to_string(),
            "-NoProfile".to_string(),
            "-Command".to_string(),
            cmd.to_string(),
        ],
        env_vars: HashMap::new(),
        working_dir: None,
        stdin_data: None,
        capture_stdout: true,
        capture_stderr: true,
    }
}

/// Move the mouse cursor to an absolute position.
pub fn mouse_move_command(x: i32, y: i32) -> CommandSpec {
    let ps = format!(
        r#"
Add-Type -MemberDefinition '
[DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
' -Name WinAPI -Namespace Native
[Native.WinAPI]::SetCursorPos({x}, {y})
"#
    );
    CommandSpec {
        command: vec![
            "powershell.exe".to_string(),
            "-NoProfile".to_string(),
            "-Command".to_string(),
            ps,
        ],
        env_vars: HashMap::new(),
        working_dir: None,
        stdin_data: None,
        capture_stdout: true,
        capture_stderr: true,
    }
}

/// Left mouse click at the current cursor position.
pub fn mouse_click_command() -> CommandSpec {
    let ps = r#"
Add-Type -MemberDefinition '
[DllImport("user32.dll",CharSet=CharSet.Auto, CallingConvention=CallingConvention.StdCall)]
public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint cButtons, uint dwExtraInfo);
' -Name WinAPI -Namespace Native
$leftDown = 0x00000002
$leftUp = 0x00000004
[Native.WinAPI]::mouse_event($leftDown, 0, 0, 0, 0)
[Native.WinAPI]::mouse_event($leftUp, 0, 0, 0, 0)
"#;
    CommandSpec {
        command: vec![
            "powershell.exe".to_string(),
            "-NoProfile".to_string(),
            "-Command".to_string(),
            ps.to_string(),
        ],
        env_vars: HashMap::new(),
        working_dir: None,
        stdin_data: None,
        capture_stdout: true,
        capture_stderr: true,
    }
}

/// Type literal text via SendKeys.
pub fn keyboard_type_command(text: &str) -> CommandSpec {
    let escaped = text
        .replace('"', "`\"")
        .replace('{', "`{")
        .replace('}', "`}");
    let ps = format!(
        r#"
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait("{escaped}")
"#
    );
    CommandSpec {
        command: vec![
            "powershell.exe".to_string(),
            "-NoProfile".to_string(),
            "-Command".to_string(),
            ps,
        ],
        env_vars: HashMap::new(),
        working_dir: None,
        stdin_data: None,
        capture_stdout: true,
        capture_stderr: true,
    }
}

/// Write file bytes to a Windows path (base64-decoded inside the guest).
pub fn file_upload_command(remote_path: &str, base64_data: &str) -> CommandSpec {
    let ps = format!(
        r#"
$data = [Convert]::FromBase64String("{base64_data}")
$dir = Split-Path -Parent "{remote_path}"
if ($dir -and -not (Test-Path $dir)) {{ New-Item -ItemType Directory -Path $dir -Force | Out-Null }}
[IO.File]::WriteAllBytes("{remote_path}", $data)
"#
    );
    CommandSpec {
        command: vec![
            "powershell.exe".to_string(),
            "-NoProfile".to_string(),
            "-Command".to_string(),
            ps,
        ],
        env_vars: HashMap::new(),
        working_dir: None,
        stdin_data: None,
        capture_stdout: true,
        capture_stderr: true,
    }
}

/// Read a file from the Windows guest and return it as base64.
pub fn file_download_command(remote_path: &str) -> CommandSpec {
    let ps = format!(
        r#"
[Convert]::ToBase64String([IO.File]::ReadAllBytes("{remote_path}"))
"#
    );
    CommandSpec {
        command: vec![
            "powershell.exe".to_string(),
            "-NoProfile".to_string(),
            "-Command".to_string(),
            ps,
        ],
        env_vars: HashMap::new(),
        working_dir: None,
        stdin_data: None,
        capture_stdout: true,
        capture_stderr: true,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn screenshot_command_uses_powershell() {
        let cmd = screenshot_command();
        assert_eq!(cmd.command[0], "powershell.exe");
        assert!(cmd.command.join(" ").contains("allternit-screen.png"));
    }

    #[test]
    fn keyboard_command_escapes_quotes() {
        let cmd = keyboard_type_command(r#"say "hi""#);
        let joined = cmd.command.join(" ");
        assert!(joined.contains("`\""));
    }
}
