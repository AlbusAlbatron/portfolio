---
title: Attention Service
summary: A Windows service that blocks distracting websites and programs for a set time — and stops you from switching it off early.
year: 2026
tech: [C, Win32 API, Windows Services]
repo: https://github.com/AlbusAlbatron/Attention-Service
order: 2
---

## The problem

I procrastinate. Browser extensions and focus apps never worked for me, because closing them takes two
clicks. I wanted a blocker that was genuinely annoying to get around — so it had to live below the level
where I'd normally go to turn things off.

## How it works

Attention Service runs as a **Windows Service**: it starts in the background, has no window to close, and
runs with enough privileges to change system files. A small GUI lets you pick what to block and for how
long, then hands over to the service.

### Blocking websites

Windows checks the `hosts` file before it ever asks a DNS server where a domain lives. When a block starts,
the service backs up the existing hosts file, then writes the original contents back out with a marked
section of extra entries:

```txt
#Start of entries inserted by Attention Service
0.0.0.0 youtube.com
0.0.0.0 reddit.com
#End of entries inserted by Attention Service
```

Pointing a domain at `0.0.0.0` means every browser on the machine fails to reach it. When the timer runs out,
the backup is copied back over the hosts file.

### Blocking programs

For the length of the block, the service repeatedly takes a snapshot of every running process with
`CreateToolhelp32Snapshot`, walks the list, and compares each executable name against the blocklist. Anything
that matches is opened with `PROCESS_TERMINATE` rights and closed.

### Locking it down

A blocker is useless if you can just kill it. So alongside whatever the user adds, a fixed set of tools is
always on the blocklist while a session is running: `taskmgr.exe`, `cmd.exe`, `powershell.exe`, `mmc.exe`
(the Services console) and `regedit.exe`. Every obvious way to stop the service gets closed the moment it opens.

## What I learned

- **How Windows services work** — the service control manager, running without a desktop, and installing
  and removing a service with `sc`.
- **Wide strings and encodings.** The blocklist is stored as UTF-16 (`wchar_t`), but the hosts file wants
  plain UTF-8, so every entry goes through `WideCharToMultiByte` on its way in.
- **Failure modes matter more when you have admin rights.** If the service is killed mid-block, the
  entries stay in the hosts file. That's documented in the README for now; making restore crash-safe is the
  next thing I want to fix.

## What's next

- Restore the hosts file on startup if a previous session didn't end cleanly.
- Replace the busy polling loop with process-creation events, so it isn't burning CPU while it waits.
