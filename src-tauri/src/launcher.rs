use std::env;
use std::io::IsTerminal;
use std::process::{Command, Stdio};

const DETACHED_ENV_VAR: &str = "LENZ_DETACHED";

pub fn detach_to_background() -> Result<bool, String> {
    if !should_detach_from_terminal() {
        return Ok(false);
    }

    let current_exe =
        env::current_exe().map_err(|error| format!("Failed to resolve current executable: {error}"))?;
    let current_dir =
        env::current_dir().map_err(|error| format!("Failed to resolve current directory: {error}"))?;
    let args: Vec<_> = env::args_os().skip(1).collect();

    let mut command = Command::new(current_exe);
    command
        .args(args)
        .current_dir(current_dir)
        .env(DETACHED_ENV_VAR, "1")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    configure_detached_command(&mut command);

    command
        .spawn()
        .map_err(|error| format!("Failed to relaunch lenz in the background: {error}"))?;

    Ok(true)
}

fn should_detach_from_terminal() -> bool {
    if cfg!(debug_assertions) {
        return false;
    }

    if env::var_os(DETACHED_ENV_VAR).is_some() {
        return false;
    }

    std::io::stdin().is_terminal()
        || std::io::stdout().is_terminal()
        || std::io::stderr().is_terminal()
}

#[cfg(windows)]
fn configure_detached_command(command: &mut Command) {
    use std::os::windows::process::CommandExt;

    const DETACHED_PROCESS: u32 = 0x0000_0008;
    const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;

    command.creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP);
}

#[cfg(unix)]
fn configure_detached_command(command: &mut Command) {
    use std::os::unix::process::CommandExt;

    command.process_group(0);
}
