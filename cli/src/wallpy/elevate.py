"""
This is a fork of pyuac with customizations for wallpy.
"""

import os
import sys
from subprocess import list2cmdline

def isUserAdmin():
    """Check if the current OS user is an Administrator or root.

    :return: True if the current user is an 'Administrator', otherwise False.
    """
    if os.name == 'nt':
        import win32security

        try:
            adminSid = win32security.CreateWellKnownSid(
                win32security.WinBuiltinAdministratorsSid, None)
            rv = win32security.CheckTokenMembership(None, adminSid)
            return rv
        except Exception as e:
            return False
    else:
        # Check for root on Posix
        return os.getuid() == 0


def runAsAdmin(cmdLine=None, wait=True, showCmd=True, showOutput=True):
    """
    Attempt to relaunch the current script as an admin using the same command line parameters.

    WARNING: this function only works on Windows. Future support for Posix might be possible.
    Calling this from other than Windows will raise a RuntimeError.

    :param cmdLine: set to override the command line of the program being launched as admin.
    Otherwise it defaults to the current process command line! It must be a list in
    [command, arg1, arg2...] format. Note that if you're overriding cmdLine, you normally should
    make the first element of the list sys.executable

    :param wait: Set to False to avoid waiting for the sub-process to finish. You will not
    be able to fetch the exit code of the process if wait is False.

    :returns: the sub-process return code, unless wait is False, in which case it returns None.
    """

    if os.name != 'nt':
        raise RuntimeError("This function is only implemented on Windows.")

    import win32con
    import win32event
    import win32process
    # noinspection PyUnresolvedReferences
    from win32com.shell.shell import ShellExecuteEx
    # noinspection PyUnresolvedReferences
    from win32com.shell import shellcon

    if not cmdLine:
        cmdLine = [sys.executable] + sys.argv
        print("Defaulting to runAsAdmin command line: %r", cmdLine)
    elif type(cmdLine) not in (tuple, list):
        raise ValueError("cmdLine is not a sequence.")

    if showCmd:
        showCmd = win32con.SW_SHOWNORMAL
    else:
        showCmd = win32con.SW_HIDE

    lpVerb = 'runas'  # causes UAC elevation prompt.

    cmd = cmdLine[0]
    params = list2cmdline(cmdLine[1:])

    if showOutput:
        print("Running command %r - %r", cmd, params)

    try:
        procInfo = ShellExecuteEx(
            nShow=showCmd,
            fMask=shellcon.SEE_MASK_NOCLOSEPROCESS,
            lpVerb=lpVerb,
            lpFile=cmd,
            lpParameters=params)
    except Exception as e:
        return None

    if wait:
        procHandle = procInfo['hProcess']
        _ = win32event.WaitForSingleObject(procHandle, win32event.INFINITE)
        rc = win32process.GetExitCodeProcess(procHandle)
        if showOutput:
            print("Process handle %s returned code %s", procHandle, rc)
    else:
        rc = None

    return rc
